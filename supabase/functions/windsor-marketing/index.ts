declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const windsorApiKey = Deno.env.get("WINDSOR_API_KEY") || "";

type ProviderKey = {
  id: string;
  label: string;
  apiKey: string;
  maxAccounts: number;
  softLimit: number;
  status: string;
  legacy: boolean;
};

type Identity = {
  licenseKey?: string;
  machineUuid?: string;
  deviceId?: string;
  accountIdents?: Array<{
    easy_email?: string;
    khod_email?: string;
  }>;
};

async function pLimit<T, R>(concurrency: number, items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const iterator = items.entries();
  const workers = Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
    for (const [index, item] of iterator) {
      results[index] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}

type RequestBody = {
  clientRequestId?: string;
  diagnosticsRequested?: boolean;
  action?: "connect" | "status" | "claim_source_account" | "release_source_account" | "save_mapping" | "save_mappings" | "sync" | "sync_all";
  mode?: "cached" | "revalidate" | "force" | "incremental" | "full";
  recomposeOnly?: boolean;
  platform?: string;
  dashboardAccountId?: string;
  dashboardAccountKey?: string;
  dashboardAccountLabel?: string;
  sourceAccountId?: string;
  sourceAccountIds?: string[];
  sourceAccounts?: Array<{ id?: string; currency?: string }>;
  mappings?: Array<{ dashboardAccountId?: string; dashboardAccountKey?: string; sourceAccounts?: Array<{ id?: string; currency?: string }> }>;
  targetCurrency?: string;
  exchangeRates?: Record<string, number>;
  egpRate?: number;
  accountSettings?: Array<{ dashboardAccountId?: string; dashboardAccountKey?: string; dashboardAccountKeys?: string[]; currency?: string; exchangeRates?: Record<string, number>; egpRate?: number }>;
  dateFrom?: string;
  dateTo?: string;
  identity?: Identity;
};

type SourceAccount = { id: string; name: string; currency: string; providerKeyId?: string };
type DailyMetricRow = {
  license_key_hash: string;
  provider_key_ref: string;
  platform: string;
  source_account_id: string;
  report_date: string;
  source_account_name: string;
  source_currency: string;
  raw_spend: number;
  impressions: number;
  clicks: number;
  row_count: number;
  campaign_breakdown: any[];
  fetched_at: string;
  updated_at: string;
};

const PLATFORM_CONFIG: Record<string, { dsId: string; label: string }> = {
  tiktok: { dsId: "tiktok", label: "TikTok" },
  snapchat: { dsId: "snapchat", label: "Snapchat" },
  facebook: { dsId: "facebook", label: "Facebook" },
};
const DEFAULT_MARKETING_ACCOUNT_LIMIT = 2;
const TRAFFIC_VIEW_SCHEMA_VERSION = 2;
const DAILY_METRIC_CACHE_SCHEMA_VERSION = 2;
const WINDSOR_MAX_REPORT_ROWS = 100000;
const WINDSOR_STATUS_TIMEOUT_MS = 20_000;
const WINDSOR_REPORT_TIMEOUT_MS = 75_000;

function platformConfig(platform: string) {
  return PLATFORM_CONFIG[platform] || null;
}

function trafficViewFieldGroups(platform: string) {
  if (platform === "facebook") {
    return {
      landing: ["actions_landing_page_view"],
      content: ["actions_offsite_conversion_fb_pixel_view_content", "actions_view_content", "actions_omni_view_content"],
    };
  }
  if (platform === "tiktok") return { landing: ["total_landing_page_view", "total_pageview"], content: ["page_content_view_events"] };
  if (platform === "snapchat") return { landing: ["conversion_page_views"], content: ["conversion_view_content"] };
  return { landing: [] as string[], content: [] as string[] };
}

function trafficViewFields(platform: string) {
  const groups = trafficViewFieldGroups(platform);
  return [...groups.landing, ...groups.content];
}

function platformPurchaseFields(platform: string) {
  if (platform === "facebook") {
    return [
      "actions_omni_purchase",
      "actions_offsite_conversion_fb_pixel_purchase",
      "actions_purchase",
    ];
  }
  if (platform === "snapchat") return ["conversion_purchases"];
  if (platform === "tiktok") {
    return [
      "complete_payment",
      "onsite_total_purchase",
      "total_purchase",
      "conversions",
    ];
  }
  return [] as string[];
}

function metricFromFields(row: any, fields: string[]) {
  let available = false;
  let firstAvailableField = "";
  for (const field of fields) {
    if (!row || !Object.prototype.hasOwnProperty.call(row, field) || row[field] == null || row[field] === "") continue;
    available = true;
    if (!firstAvailableField) firstAvailableField = field;
    const value = metricNumber(row[field]);
    if (value > 0) return { value, available: true, field };
  }
  return { value: 0, available, field: firstAvailableField };
}

function trafficViewMetrics(row: any, platform: string) {
  const groups = trafficViewFieldGroups(platform);
  const landing = metricFromFields(row, groups.landing);
  const content = metricFromFields(row, groups.content);
  const landingPageViews = landing.value;
  const contentViews = content.value;
  return {
    landingPageViews,
    contentViews,
    trafficViews: landingPageViews > 0 ? landingPageViews : contentViews,
    trafficViewAvailable: landing.available || content.available,
    trafficViewSource: landingPageViews > 0 ? landing.field : content.field || landing.field,
    trafficViewSchemaVersion: TRAFFIC_VIEW_SCHEMA_VERSION,
  };
}

function platformPurchaseMetric(row: any, platform: string) {
  const fields = platformPurchaseFields(platform);
  const result = metricFromFields(row, fields);
  return {
    purchases: result.value,
    purchaseMetric: result.field || fields[0] || "",
    purchaseMetricAvailable: result.available,
  };
}

function marketingReportFields(platform: string, includeDate: boolean) {
  return [
    includeDate ? "date" : "",
    "account_id,account_name,campaign_id,campaign,spend,impressions,clicks",
    trafficViewFields(platform).join(","),
    platformPurchaseFields(platform).join(","),
  ].filter(Boolean).join(",");
}

function configureWindsorReportUrl(url: URL) {
  url.searchParams.set("_renderer", "json");
  url.searchParams.set("_max_rows", String(WINDSOR_MAX_REPORT_ROWS));
}

function windsorReportRows(report: any) {
  const rows = Array.isArray(report && report.data) ? report.data : (Array.isArray(report) ? report : []);
  if (rows.length >= WINDSOR_MAX_REPORT_ROWS) throw new Error("WINDSOR_REPORT_ROW_LIMIT_REACHED");
  return rows;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stableAccountKey(value: unknown) {
  return safeText(value).toLowerCase();
}

function khodAccountIdents(identity: Identity) {
  const rows = Array.isArray(identity.accountIdents) ? identity.accountIdents : [];
  return rows.map((row) => ({
    easy_email: stableAccountKey(row && row.easy_email),
    khod_email: stableAccountKey(row && row.khod_email),
  })).filter((row) => row.easy_email || row.khod_email);
}

const SUPPORTED_CURRENCIES = new Set(["SAR", "USD", "EGP", "AED", "IQD", "OMR"]);
let lastFetchedRatesAt = 0;
const RATES_TTL = 12 * 60 * 60 * 1000; // 12 hours
let USD_RATES: Record<string, number> = { USD: 1, SAR: 3.75, EGP: 52, AED: 3.6725, IQD: 1310, OMR: 0.385 };

async function getLiveRates() {
  const now = Date.now();
  if (now - lastFetchedRatesAt < RATES_TTL) return;
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.result === "success" && data.rates) {
      for (const cur of SUPPORTED_CURRENCIES) {
        if (typeof data.rates[cur] === "number") {
          USD_RATES[cur] = data.rates[cur];
        }
      }
      lastFetchedRatesAt = now;
      console.log("windsor-marketing: updated live rates", USD_RATES);
    }
  } catch (err) {
    console.error("windsor-marketing: failed to fetch live rates", err);
  }
}

function safeCurrency(value: unknown) {
  const currency = safeText(value).toUpperCase();
  return SUPPORTED_CURRENCIES.has(currency) ? currency : "";
}

function normalizeExchangeRates(value: unknown, egpRateValue?: unknown) {
  const supplied = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rates: Record<string, number> = {};
  for (const currency of SUPPORTED_CURRENCIES) {
    const rate = Number(supplied[currency]);
    rates[currency] = Number.isFinite(rate) && rate > 0 ? rate : Number(USD_RATES[currency] || 1);
  }
  const legacyEgp = Number(egpRateValue);
  if (!(Number(supplied.EGP) > 0) && legacyEgp > 0) rates.EGP = legacyEgp;
  rates.USD = 1;
  return rates;
}

function usefulAccountName(value: unknown, id: unknown) {
  const name = safeText(value);
  const sourceId = safeText(id);
  return name && name !== sourceId ? name : "";
}

function debug(event: string, data: Record<string, unknown> = {}) {
  try {
    console.log("windsor-marketing", JSON.stringify({
      event,
      at: new Date().toISOString(),
      ...data,
    }));
  } catch (_) {
    console.log("windsor-marketing", event);
  }
}

class WindsorApiError extends Error {
  status: number;
  code: string;
  reconnectRequired: boolean;

  constructor(message: string, status: number, code = "", reconnectRequired = false) {
    super(message);
    this.name = "WindsorApiError";
    this.status = status;
    this.code = code;
    this.reconnectRequired = reconnectRequired;
  }
}

class MarketingLimitError extends Error {
  platform: string;
  accountId: string;
  max: number;
  selected: number;

  constructor(platform: string, accountId: string, max: number, selected: number) {
    super("MARKETING_ACCOUNT_LIMIT_EXCEEDED");
    this.name = "MarketingLimitError";
    this.platform = platform;
    this.accountId = accountId;
    this.max = max;
    this.selected = selected;
  }
}

function isWindsorReconnectMessage(message: string, code: string) {
  const text = `${message || ""} ${code || ""}`.toLowerCase();
  return /\b(expired|revoked|reauthori[sz]e|reconnect|session|oauth|token)\b/.test(text);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function supabaseRest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceRoleKey}`,
      "apikey": serviceRoleKey,
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error(typeof data === "string" ? data : (data && data.message) || `supabase_${response.status}`);
  }
  return data;
}

async function validateLicense(identity: Identity) {
  const licenseKey = safeText(identity.licenseKey).toUpperCase();
  if (!licenseKey) return null;
  const response = await supabaseRest("/rest/v1/rpc/khod_check_license_with_identity", {
    method: "POST",
    body: JSON.stringify({
      p_license_key: licenseKey,
      p_machine_uuid: safeText(identity.machineUuid),
      p_device_id: safeText(identity.deviceId),
      p_account_idents: khodAccountIdents(identity),
    }),
  });
  if (!response || response.valid !== true || response.dashboard_enabled !== true) return null;
  return { licenseKey, licenseHash: await sha256(licenseKey) };
}

async function getConnection(licenseHash: string, accountId: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    dashboard_account_id: `eq.${accountId}`,
    platform: `eq.${platform}`,
    select: "*",
    limit: "1",
  });
  const rows = await supabaseRest(`/rest/v1/marketing_connections?${query.toString()}`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getAnyConnection(licenseHash: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    select: "*",
    order: "updated_at.desc",
    limit: "1",
  });
  const rows = await supabaseRest(`/rest/v1/marketing_connections?${query.toString()}`);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function upsertConnection(row: Record<string, unknown>) {
  await supabaseRest("/rest/v1/marketing_connections?on_conflict=license_key_hash,dashboard_account_id,platform", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
}

function legacyProviderKey(): ProviderKey {
  if (!windsorApiKey) throw new Error("MARKETING_BACKEND_NOT_CONFIGURED");
  return {
    id: "",
    label: "Legacy Windsor API key",
    apiKey: windsorApiKey,
    maxAccounts: 75,
    softLimit: 70,
    status: "active",
    legacy: true,
  };
}

function normalizeProviderKey(row: any): ProviderKey | null {
  if (!row || typeof row !== "object") return null;
  const apiKey = safeText(row.api_key);
  if (!apiKey) return null;
  const maxAccounts = Number(row.max_accounts || 75) || 75;
  const softLimit = Number(row.soft_limit || Math.min(70, maxAccounts)) || Math.min(70, maxAccounts);
  return {
    id: safeText(row.id),
    label: safeText(row.label) || "Windsor API key",
    apiKey,
    maxAccounts,
    softLimit,
    status: safeText(row.status) || "active",
    legacy: false,
  };
}

function providerKeyIdValue(providerKey: ProviderKey | null) {
  return providerKey && !providerKey.legacy && providerKey.id ? providerKey.id : null;
}

function providerKeyFields(providerKey: ProviderKey | null) {
  const providerKeyId = providerKeyIdValue(providerKey);
  return providerKeyId ? { provider_key_id: providerKeyId } : {};
}

function providerKeyRef(providerKey: ProviderKey | null) {
  return providerKey && !providerKey.legacy && providerKey.id ? providerKey.id : "legacy";
}

async function trySupabaseRest(path: string, init: RequestInit = {}) {
  try {
    return await supabaseRest(path, init);
  } catch (error) {
    debug("provider:rest_fallback", { path: path.split("?")[0], error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function getProviderKeyById(providerKeyId: string) {
  const id = safeText(providerKeyId);
  if (!id) return null;
  const query = new URLSearchParams({ id: `eq.${id}`, provider: "eq.windsor", select: "*", limit: "1" });
  const rows = await trySupabaseRest(`/rest/v1/marketing_provider_keys?${query.toString()}`);
  return Array.isArray(rows) && rows.length ? normalizeProviderKey(rows[0]) : null;
}

async function getProviderAssignment(licenseHash: string, accountId: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    dashboard_account_id: `eq.${accountId}`,
    select: "provider_key_id",
    limit: "1",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_provider_assignments?${query.toString()}`);
  return Array.isArray(rows) && rows.length ? safeText(rows[0].provider_key_id) : "";
}

async function providerUsageCount(providerKeyId: string) {
  const id = safeText(providerKeyId);
  if (!id) return 0;
  const key = await getProviderKeyById(id);
  if (!key || !key.apiKey) return 0;

  const platforms = ["tiktok", "snapchat", "facebook"];
  const seen = new Set<string>();
  for (const platform of platforms) {
    try {
      const workspaceResult = await getMarketingAccountsFromWorkspace(platform, key.apiKey);
      (workspaceResult.accounts || []).forEach((acc: any) => {
        if (acc && acc.id) seen.add(`${platform}:${acc.id}`);
      });
    } catch (e) {
      // ignore
    }
    try {
      const reportResult = await getMarketingAccountsFromData(platform, key.apiKey);
      (reportResult.accounts || []).forEach((acc: any) => {
        if (acc && acc.id) seen.add(`${platform}:${acc.id}`);
      });
    } catch (e) {
      // ignore
    }
  }
  return seen.size;
}

async function chooseActiveProviderKey() {
  const query = new URLSearchParams({
    provider: "eq.windsor",
    status: "eq.active",
    select: "*",
    order: "created_at.asc",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_provider_keys?${query.toString()}`);
  const keys = (Array.isArray(rows) ? rows : []).map(normalizeProviderKey).filter(Boolean) as ProviderKey[];
  if (!keys.length) return legacyProviderKey();
  for (const key of keys) {
    const used = await providerUsageCount(key.id);
    if (used >= key.softLimit) continue;
    return key;
  }
  throw new Error("MARKETING_PROVIDER_CAPACITY_FULL");
}

async function listProviderKeysForLookup() {
  const query = new URLSearchParams({
    provider: "eq.windsor",
    select: "*",
    order: "created_at.asc",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_provider_keys?${query.toString()}`);
  const keys = (Array.isArray(rows) ? rows : []).map(normalizeProviderKey).filter(Boolean) as ProviderKey[];
  if (keys.length) return keys;
  return [legacyProviderKey()];
}

function providerLookupOrder(keys: ProviderKey[], preferred: ProviderKey | null) {
  const preferredRef = providerKeyRef(preferred);
  const out: ProviderKey[] = [];
  keys.forEach((key) => {
    if (providerKeyRef(key) === preferredRef) out.unshift(key);
    else out.push(key);
  });
  if (preferred && !out.some((key) => providerKeyRef(key) === preferredRef)) out.unshift(preferred);
  return out;
}

async function findSourceAccountProvider(
  licenseHash: string,
  platform: string,
  source: MappedSourceAccount,
  preferredProviderKey: ProviderKey | null,
  clientRequestId = "",
) {
  const sourceId = safeText(source && source.id);
  if (!sourceId) return { source, providerKey: preferredProviderKey, changed: false, found: false };
  const keys = providerLookupOrder(await listProviderKeysForLookup(), preferredProviderKey);
  for (const key of keys) {
    try {
      const result = await getAllWindsorAccounts(platform, key.apiKey);
      const account = mergeSourceAccounts(result.accounts).find((item) => item.id === sourceId);
      debug("provider:source_lookup_attempt", {
        clientRequestId,
        platform,
        sourceAccountId: sourceId,
        providerKeyId: key.id || "legacy",
        providerKeyLabel: key.label,
        found: !!account,
        accountCount: Array.isArray(result.accounts) ? result.accounts.length : 0,
      });
      if (!account) continue;
      const providerRef = providerKeyRef(key);
      const nextSource = {
        id: sourceId,
        name: usefulAccountName(account.name, sourceId) || usefulAccountName(source.name, sourceId) || sourceId,
        currency: safeCurrency(source.currency) || safeCurrency(account.currency),
        providerKeyId: providerRef,
      };
      await upsertKnownSourceAccounts(licenseHash, platform, [nextSource], key, "sync_provider_lookup", true);
      return {
        source: nextSource,
        providerKey: key,
        changed: sourceProviderRef(source, preferredProviderKey) !== providerRef,
        found: true,
      };
    } catch (error) {
      debug("provider:source_lookup_failed", {
        clientRequestId,
        platform,
        sourceAccountId: sourceId,
        providerKeyId: key.id || "legacy",
        providerKeyLabel: key.label,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { source, providerKey: preferredProviderKey, changed: false, found: false };
}

async function saveProviderAssignment(licenseHash: string, accountId: string, providerKey: ProviderKey) {
  const providerKeyId = providerKeyIdValue(providerKey);
  if (!providerKeyId || !accountId || accountId === "__all__") return;
  await trySupabaseRest("/rest/v1/marketing_provider_assignments?on_conflict=license_key_hash,dashboard_account_id", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      license_key_hash: licenseHash,
      dashboard_account_id: accountId,
      provider_key_id: providerKeyId,
      updated_at: new Date().toISOString(),
    }),
  });
}

async function resolveProviderKey(
  licenseHash: string,
  accountId: string,
  options: { createAssignment?: boolean; connection?: any } = {},
) {
  if (accountId && accountId !== "__all__") {
    const assignedProviderKeyId = await getProviderAssignment(licenseHash, accountId);
    if (assignedProviderKeyId) {
      const key = await getProviderKeyById(assignedProviderKeyId);
      if (key) return key;
    }
  }
  if (options.createAssignment && accountId === "__connection__") {
    const key = await chooseActiveProviderKey();
    await saveProviderAssignment(licenseHash, accountId, key);
    return key;
  }
  if (options.createAssignment && accountId && accountId !== "__all__" && accountId !== "__connection__") {
    const key = await chooseActiveProviderKey();
    await saveProviderAssignment(licenseHash, accountId, key);
    return key;
  }
  const existingProviderKeyId = safeText(options.connection && options.connection.provider_key_id);
  if (existingProviderKeyId) {
    const key = await getProviderKeyById(existingProviderKeyId);
    if (key) return key;
  }
  if (accountId === "__connection__") {
    return await chooseActiveProviderKey();
  }
  return legacyProviderKey();
}

type MappedSourceAccount = { id: string; name: string; currency: string; providerKeyId?: string };
type MarketingMapping = Record<string, MappedSourceAccount[]>;

type SourceAccountLookup = Map<string, SourceAccount>;

async function getKnownSourceAccountLookup(licenseHash: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    status: "eq.known",
    select: "source_account_id,source_account_name,source_currency,provider_key_id",
    order: "updated_at.desc",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_source_accounts?${query.toString()}`);
  const lookup: SourceAccountLookup = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row: any) => {
    const account = normalizeSourceAccount({
      id: row.source_account_id,
      name: row.source_account_name,
      currency: row.source_currency,
      provider_key_id: row.provider_key_id,
    });
    if (account && !lookup.has(account.id)) lookup.set(account.id, account);
  });
  return lookup;
}

function addMappingRows(grouped: MarketingMapping, rows: any[], knownLookup: SourceAccountLookup = new Map()) {
  (Array.isArray(rows) ? rows : []).forEach((row: any) => {
    const dashboardAccountId = safeText(row.dashboard_account_id);
    const id = safeText(row.source_account_id);
    if (!dashboardAccountId || !id) return;
    const known = knownLookup.get(id);
    if (!grouped[dashboardAccountId]) grouped[dashboardAccountId] = [];
    if (grouped[dashboardAccountId].some((source) => source.id === id)) return;
    grouped[dashboardAccountId].push({
      id,
      name: usefulAccountName(known && known.name, id) || usefulAccountName(row.source_account_name, id) || id,
      currency: safeCurrency(row.source_currency) || safeCurrency(known && known.currency),
      providerKeyId: safeText(known && known.providerKeyId) || safeText(row.provider_key_id),
    });
  });
}

async function getMappings(licenseHash: string, platform: string, sharedAccountId = "") {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    select: "dashboard_account_id,source_account_id,source_account_name,source_currency,provider_key_id",
  });
  const knownLookup = await getKnownSourceAccountLookup(licenseHash, platform);
  const rows = await supabaseRest(`/rest/v1/marketing_account_mappings?${query.toString()}`);
  const grouped: MarketingMapping = {};
  addMappingRows(grouped, rows, knownLookup);
  const sharedId = stableAccountKey(sharedAccountId);
  if (sharedId && sharedId !== "__all__") {
    const sharedQuery = new URLSearchParams({
      license_key_hash: `eq.${licenseHash}`,
      dashboard_account_id: `eq.${sharedId}`,
      platform: `eq.${platform}`,
      select: "dashboard_account_id,source_account_id,source_account_name,source_currency,provider_key_id",
    });
    const sharedRows = await supabaseRest(`/rest/v1/marketing_account_mappings?${sharedQuery.toString()}`);
    addMappingRows(grouped, sharedRows, knownLookup);
  }
  return grouped;
}

function normalizeSourceAccount(account: any): SourceAccount | null {
  const id = safeText(account && (account.id || account.source_account_id || account.account_id || account.accountId));
  if (!id) return null;
  return {
    id,
    name: usefulAccountName(account && account.account_name, id) ||
      usefulAccountName(account && account.accountName, id) ||
      usefulAccountName(account && account.source_account_name, id) ||
      usefulAccountName(account && account.name, id) ||
      id,
    currency: safeCurrency(account && (account.currency || account.source_currency || account.account_currency || account.accountCurrency)),
    providerKeyId: safeText(account && (account.providerKeyId || account.provider_key_id)),
  };
}

function mergeSourceAccounts(...groups: any[][]) {
  const byId = new Map<string, SourceAccount>();
  groups.forEach((group) => {
    (Array.isArray(group) ? group : []).forEach((account) => {
      const normalized = normalizeSourceAccount(account);
      if (!normalized) return;
      const existing = byId.get(normalized.id);
      byId.set(normalized.id, {
        id: normalized.id,
        name: usefulAccountName(normalized.name, normalized.id) ||
          usefulAccountName(existing && existing.name, normalized.id) ||
          normalized.id,
        currency: normalized.currency || (existing && existing.currency) || "",
        providerKeyId: normalized.providerKeyId || (existing && existing.providerKeyId) || "",
      });
    });
  });
  return Array.from(byId.values());
}

async function getMappedSourceAccounts(licenseHash: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    select: "source_account_id,source_account_name,source_currency,provider_key_id",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_account_mappings?${query.toString()}`);
  return mergeSourceAccounts((Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: row.source_account_id,
    name: row.source_account_name,
    currency: row.source_currency,
    provider_key_id: row.provider_key_id,
  })));
}

async function getKnownSourceAccounts(licenseHash: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    status: "eq.known",
    select: "source_account_id,source_account_name,source_currency,provider_key_id",
    order: "updated_at.desc",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_source_accounts?${query.toString()}`);
  const pooled = mergeSourceAccounts((Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: row.source_account_id,
    name: row.source_account_name,
    currency: row.source_currency,
    provider_key_id: row.provider_key_id,
  })));
  const hiddenIds = await getHiddenSourceAccountIds(licenseHash, platform);
  const mapped = await getMappedSourceAccounts(licenseHash, platform);
  return excludeSourceAccountIds(mergeSourceAccounts(pooled, mapped), hiddenIds);
}

async function getHiddenSourceAccountIds(licenseHash: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    status: "eq.hidden",
    select: "source_account_id",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_source_accounts?${query.toString()}`);
  return new Set((Array.isArray(rows) ? rows : [])
    .map((row: any) => safeText(row && row.source_account_id))
    .filter(Boolean));
}

function excludeSourceAccountIds(accounts: any[], hiddenIds: Set<string>) {
  if (!hiddenIds || hiddenIds.size === 0) return mergeSourceAccounts(accounts);
  return mergeSourceAccounts(accounts).filter((account) => !hiddenIds.has(account.id));
}

function removeSourceAccountIds(hiddenIds: Set<string>, visibleIds: Set<string>) {
  if (!hiddenIds || hiddenIds.size === 0 || !visibleIds || visibleIds.size === 0) return hiddenIds;
  const next = new Set<string>();
  hiddenIds.forEach((id) => {
    if (!visibleIds.has(id)) next.add(id);
  });
  return next;
}

function filterMappingsWithoutSourceIds(mappings: MarketingMapping, hiddenIds: Set<string>) {
  if (!hiddenIds || hiddenIds.size === 0) return mappings;
  const filtered: MarketingMapping = {};
  Object.keys(mappings || {}).forEach((accountId) => {
    const rows = (Array.isArray(mappings[accountId]) ? mappings[accountId] : [])
      .filter((source) => source && source.id && !hiddenIds.has(source.id));
    if (rows.length) filtered[accountId] = rows;
  });
  return filtered;
}

async function upsertKnownSourceAccounts(
  licenseHash: string,
  platform: string,
  accounts: any[],
  providerKey: ProviderKey | null,
  discoveredBy: string,
  includeHidden = false,
) {
  const hiddenIds = includeHidden ? new Set<string>() : await getHiddenSourceAccountIds(licenseHash, platform);
  const providerKeyId = providerKeyIdValue(providerKey);
  const providerRef = providerKeyRef(providerKey);
  const now = new Date().toISOString();
  const rows = mergeSourceAccounts(accounts)
    .filter((account) => !hiddenIds.has(account.id))
    .map((account) => ({
      license_key_hash: licenseHash,
      platform,
      source_account_id: account.id,
      provider_key_id: providerKeyId,
      source_account_name: account.name || account.id,
      source_currency: safeCurrency(account.currency) || null,
      status: "known",
      discovered_by: discoveredBy,
      last_seen_at: now,
      updated_at: now,
    }));
  if (!rows.length) return [];
  await supabaseRest("/rest/v1/marketing_source_accounts?on_conflict=license_key_hash,platform,provider_key_id,source_account_id", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  return rows.map((row) => ({
    id: safeText(row.source_account_id),
    name: safeText(row.source_account_name),
    currency: safeCurrency(row.source_currency),
    providerKeyId: providerRef,
  }));
}

function sourceAccountSnapshot(accounts: any[], diagnostics: Record<string, unknown> = {}) {
  const lookupReliable = !(diagnostics.workspaceError && diagnostics.reportError);
  return {
    sourceAccountIds: mergeSourceAccounts(accounts).map((account) => account.id),
    capturedAt: new Date().toISOString(),
    lookupReliable,
  };
}

function newAccountsSinceSnapshot(accounts: any[], snapshot: any) {
  if (!snapshot || !Array.isArray(snapshot.sourceAccountIds)) return [];
  if (snapshot.lookupReliable === false) return [];
  const before = new Set((Array.isArray(snapshot && snapshot.sourceAccountIds) ? snapshot.sourceAccountIds : [])
    .map((id: unknown) => safeText(id)).filter(Boolean));
  return mergeSourceAccounts(accounts).filter((account) => !before.has(account.id));
}

function mappedSourcesForAccount(mappings: MarketingMapping, candidates: unknown[]) {
  const selected: MappedSourceAccount[] = [];
  const seen = new Set<string>();
  candidates.forEach((candidate) => {
    const keys = [safeText(candidate), stableAccountKey(candidate)].filter(Boolean);
    keys.forEach((key) => {
      (Array.isArray(mappings[key]) ? mappings[key] : []).forEach((source) => {
        if (!source.id || seen.has(source.id)) return;
        seen.add(source.id);
        selected.push(source);
      });
    });
  });
  return selected;
}

function filterMappingsToSourceIds(mappings: MarketingMapping, sourceIds: Set<string>) {
  const filtered: MarketingMapping = {};
  Object.keys(mappings || {}).forEach((accountId) => {
    const rows = (Array.isArray(mappings[accountId]) ? mappings[accountId] : [])
      .filter((source) => source && source.id && sourceIds.has(source.id));
    if (rows.length) filtered[accountId] = rows;
  });
  return filtered;
}

function liveSourceLookupReliable(status: any) {
  const diagnostics = status && status.diagnostics || {};
  const optionsError = safeText(diagnostics.optionsError).toLowerCase();
  return !optionsError.includes("workspace:");
}

function mappingSourceIds(mappings: MarketingMapping) {
  const ids = new Set<string>();
  Object.keys(mappings || {}).forEach((accountId) => {
    (Array.isArray(mappings[accountId]) ? mappings[accountId] : []).forEach((source) => {
      const id = safeText(source && source.id);
      if (id) ids.add(id);
    });
  });
  return ids;
}

function mappingProviderRefs(mappings: MarketingMapping, fallbackProviderKey: ProviderKey | null) {
  const refs = new Set<string>();
  Object.keys(mappings || {}).forEach((accountId) => {
    (Array.isArray(mappings[accountId]) ? mappings[accountId] : []).forEach((source) => {
      refs.add(sourceProviderRef(source, fallbackProviderKey));
    });
  });
  return refs;
}

function pruneMappingsForLiveStatus(
  mappings: MarketingMapping,
  status: any,
  liveAccounts: any[],
  forceMode: boolean,
  providerKey: ProviderKey | null = null,
) {
  if (!forceMode || !liveSourceLookupReliable(status)) {
    return { mappings, prunedCount: 0, reliable: false, reason: forceMode ? "live_lookup_unreliable" : "not_force_mode" };
  }
  const providerRefs = mappingProviderRefs(mappings, providerKey);
  if (providerRefs.size > 1) {
    return { mappings, prunedCount: 0, reliable: false, reason: "mixed_provider_mappings" };
  }
  const allowedIds = new Set(mergeSourceAccounts(liveAccounts).map((account) => account.id).filter(Boolean));
  if (!allowedIds.size) {
    return { mappings, prunedCount: 0, reliable: false, reason: "empty_live_account_list" };
  }
  const beforeIds = mappingSourceIds(mappings);
  const nextMappings = filterMappingsToSourceIds(mappings, allowedIds);
  const afterIds = mappingSourceIds(nextMappings);
  let prunedCount = 0;
  beforeIds.forEach((id) => {
    if (!afterIds.has(id)) prunedCount += 1;
  });
  return { mappings: nextMappings, prunedCount, reliable: true };
}

function limitPayload(platform: string, max: number, used: number) {
  const safeMax = Number(max) > 0 ? Number(max) : DEFAULT_MARKETING_ACCOUNT_LIMIT;
  const safeUsed = Math.max(0, Number(used) || 0);
  return {
    platform,
    max: safeMax,
    used: safeUsed,
    remaining: Math.max(0, safeMax - safeUsed),
  };
}

async function getMarketingAccountLimit(licenseHash: string, accountId: string, platform: string) {
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    dashboard_account_id: `eq.${accountId}`,
    platform: `eq.${platform}`,
    select: "max_source_accounts",
    limit: "1",
  });
  const rows = await trySupabaseRest(`/rest/v1/marketing_account_limits?${query.toString()}`);
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return Number(row && row.max_source_accounts) > 0
    ? Number(row.max_source_accounts)
    : DEFAULT_MARKETING_ACCOUNT_LIMIT;
}

async function getMarketingLimitInfo(licenseHash: string, accountId: string, platform: string, used: number) {
  const max = await getMarketingAccountLimit(licenseHash, accountId, platform);
  return limitPayload(platform, max, used);
}

async function enforceMarketingAccountLimit(licenseHash: string, accountId: string, platform: string, selectedCount: number) {
  const max = await getMarketingAccountLimit(licenseHash, accountId, platform);
  if (selectedCount > max) throw new MarketingLimitError(platform, accountId, max, selectedCount);
  return limitPayload(platform, max, selectedCount);
}

function mappingRows(
  licenseHash: string,
  accountId: string,
  platform: string,
  sources: Array<{ id?: string; currency?: string }>,
  linkedAccounts: any[],
  providerKey: ProviderKey | null = null,
) {
  const selectedById = new Map<string, string>();
  sources.forEach((source) => {
    const id = safeText(source && source.id);
    if (id) selectedById.set(id, safeCurrency(source && source.currency));
  });
  const uniqueIds = Array.from(selectedById.keys());
  const allowed = new Map(linkedAccounts.map((account: any) => [account.id, account]));
  return uniqueIds.filter((id) => allowed.has(id)).map((id) => {
    const linked = allowed.get(id) as any;
    const detectedCurrency = safeCurrency(linked && linked.currency);
    const sourceProviderKeyId = safeText(linked && (linked.providerKeyId || linked.provider_key_id));
    const sourceProviderField = sourceProviderKeyId && sourceProviderKeyId !== "legacy"
      ? sourceProviderKeyId
      : providerKeyIdValue(providerKey);
    return {
      license_key_hash: licenseHash,
      dashboard_account_id: accountId,
      provider_key_id: sourceProviderField || null,
      platform,
      source_account_id: id,
      source_account_name: usefulAccountName(linked.name, id) || id,
      source_currency: selectedById.get(id) || detectedCurrency || null,
      updated_at: new Date().toISOString(),
    };
  });
}

function assertUniformObjectKeys(rows: any[], context: string) {
  if (!Array.isArray(rows) || rows.length < 2) return;
  const expected = Object.keys(rows[0] || {}).sort().join("|");
  const mismatchIndex = rows.findIndex((row) => Object.keys(row || {}).sort().join("|") !== expected);
  if (mismatchIndex !== -1) {
    debug("mapping:row_key_mismatch", {
      context,
      expectedKeys: expected,
      mismatchIndex,
      mismatchKeys: Object.keys(rows[mismatchIndex] || {}).sort().join("|"),
    });
    throw new Error("MARKETING_MAPPING_ROW_KEYS_MISMATCH");
  }
}

function mappingStorageRows(
  licenseHash: string,
  platform: string,
  mappings: MarketingMapping,
  accountIds: string[] = [],
) {
  const wanted = new Set((Array.isArray(accountIds) ? accountIds : [])
    .map((value) => stableAccountKey(value) || safeText(value))
    .filter(Boolean));
  const rows: any[] = [];
  Object.keys(mappings || {}).forEach((accountId) => {
    const ownerKey = stableAccountKey(accountId) || safeText(accountId);
    if (wanted.size && !wanted.has(ownerKey)) return;
    (Array.isArray(mappings[accountId]) ? mappings[accountId] : []).forEach((source) => {
      const providerRef = safeText(source && source.providerKeyId);
      rows.push({
        license_key_hash: licenseHash,
        dashboard_account_id: ownerKey,
        provider_key_id: providerRef && providerRef !== "legacy" ? providerRef : null,
        platform,
        source_account_id: safeText(source && source.id),
        source_account_name: safeText(source && source.name) || null,
        source_currency: safeCurrency(source && source.currency) || null,
        updated_at: new Date().toISOString(),
      });
    });
  });
  assertUniformObjectKeys(rows, "mapping_storage_rows");
  return rows.filter((row) => row.dashboard_account_id && row.source_account_id);
}

async function insertMappingRows(rows: any[]) {
  if (!rows.length) return;
  assertUniformObjectKeys(rows, "insert_mapping_rows");
  await supabaseRest("/rest/v1/marketing_account_mappings", {
    method: "POST",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function deleteMappingRowsForOwners(licenseHash: string, platform: string, ownerKeys: string[]) {
  for (const ownerKey of Array.from(ownerKeys)) {
    const cleanOwner = stableAccountKey(ownerKey) || safeText(ownerKey);
    if (!cleanOwner) continue;
    const query = new URLSearchParams({
      license_key_hash: `eq.${licenseHash}`,
      dashboard_account_id: `eq.${cleanOwner}`,
      platform: `eq.${platform}`,
    });
    await supabaseRest(`/rest/v1/marketing_account_mappings?${query.toString()}`, { method: "DELETE" });
  }
}

async function restoreMappingRowsAfterFailure(
  licenseHash: string,
  platform: string,
  ownerKeys: string[],
  rollbackRows: any[],
  error: unknown,
  context: string,
) {
  debug("mapping:write_failed_restore_started", {
    context,
    platform,
    ownerKeys,
    rollbackCount: rollbackRows.length,
    error: error instanceof Error ? error.message : String(error),
  });
  try {
    await deleteMappingRowsForOwners(licenseHash, platform, ownerKeys);
    await insertMappingRows(rollbackRows);
    debug("mapping:write_failed_restore_finished", { context, platform, rollbackCount: rollbackRows.length });
  } catch (restoreError) {
    debug("mapping:write_failed_restore_failed", {
      context,
      platform,
      restoreError: restoreError instanceof Error ? restoreError.message : String(restoreError),
    });
  }
}

async function linkedAccountsForSelectedSources(
  licenseHash: string,
  platform: string,
  sources: Array<{ id?: string; currency?: string }>,
  linkedAccounts: any[],
  providerKey: ProviderKey | null,
  clientRequestId = "",
) {
  const byId = new Map(mergeSourceAccounts(linkedAccounts).map((account) => [account.id, account]));
  for (const source of Array.isArray(sources) ? sources : []) {
    const sourceId = safeText(source && source.id);
    if (!sourceId || byId.has(sourceId)) continue;
    const lookup = await findSourceAccountProvider(
      licenseHash,
      platform,
      {
        id: sourceId,
        name: sourceId,
        currency: safeCurrency(source && source.currency),
        providerKeyId: "",
      },
      providerKey,
      clientRequestId,
    );
    const resolved = lookup.source;
    byId.set(sourceId, {
      ...resolved,
      currency: safeCurrency(source && source.currency) || safeCurrency(resolved.currency),
    });
  }
  return Array.from(byId.values());
}

function mappingSignature(sources: Array<{ id?: string; currency?: string; providerKeyId?: string; provider_key_id?: string }>) {
  return (Array.isArray(sources) ? sources : [])
    .map((source) => {
      const provider = safeText(source && (source.providerKeyId || source.provider_key_id));
      return `${safeText(source && source.id)}:${safeCurrency(source && source.currency)}:${provider}`;
    })
    .filter((value) => !value.startsWith(":"))
    .sort()
    .join("|");
}

function mappingsSignature(mappings: MarketingMapping) {
  return Object.keys(mappings || {}).sort().map((accountId) =>
    `${stableAccountKey(accountId) || safeText(accountId)}=${mappingSignature(mappings[accountId])}`
  ).join(";");
}

function sourceOwnerInMappings(mappings: MarketingMapping, sourceId: string) {
  const wantedSourceId = safeText(sourceId);
  if (!wantedSourceId) return "";
  return Object.keys(mappings || {}).find((ownerId) =>
    (Array.isArray(mappings[ownerId]) ? mappings[ownerId] : []).some((source) => safeText(source && source.id) === wantedSourceId)
  ) || "";
}

function assertSingleSourceOwner(rows: any[]) {
  const ownerBySourceId = new Map<string, string>();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const sourceId = safeText(row && row.source_account_id);
    const ownerId = stableAccountKey(row && row.dashboard_account_id) || safeText(row && row.dashboard_account_id);
    if (!sourceId || !ownerId) return;
    const existingOwner = ownerBySourceId.get(sourceId);
    if (existingOwner && existingOwner !== ownerId) throw new Error("SOURCE_ACCOUNT_ASSIGNED_ELSEWHERE");
    ownerBySourceId.set(sourceId, ownerId);
  });
}

async function saveMapping(
  licenseHash: string,
  accountId: string,
  platform: string,
  sources: Array<{ id?: string; currency?: string }>,
  linkedAccounts: any[],
  providerKey: ProviderKey | null = null,
  accountAliases: unknown[] = [],
  clientRequestId = "",
) {
  const usableLinkedAccounts = await linkedAccountsForSelectedSources(licenseHash, platform, sources, linkedAccounts, providerKey, clientRequestId);
  const rows = mappingRows(licenseHash, accountId, platform, sources, usableLinkedAccounts, providerKey);
  debug("mapping:rows_built", {
    clientRequestId,
    dashboardAccountId: accountId,
    platform,
    selectedCount: Array.isArray(sources) ? sources.length : 0,
    rowCount: rows.length,
    providerRefs: Array.from(new Set(rows.map((row) => safeText(row.provider_key_id) || "legacy"))),
    droppedSourceIds: (Array.isArray(sources) ? sources : [])
      .map((source) => safeText(source && source.id))
      .filter((id) => id && !rows.some((row) => safeText(row.source_account_id) === id)),
  });
  if (rows.some((row) => !row.source_currency)) throw new Error("SOURCE_CURRENCY_REQUIRED");
  assertUniformObjectKeys(rows, "save_mapping");
  assertSingleSourceOwner(rows);
  const existing = await getMappings(licenseHash, platform);
  const ownerKeys = new Set([accountId, ...accountAliases].map((value) => stableAccountKey(value) || safeText(value)).filter(Boolean));
  const conflictingSource = rows.find((row) => {
    const ownerId = sourceOwnerInMappings(existing, safeText(row && row.source_account_id));
    return ownerId && !ownerKeys.has(stableAccountKey(ownerId) || safeText(ownerId));
  });
  if (conflictingSource) throw new Error("SOURCE_ACCOUNT_ASSIGNED_ELSEWHERE");
  const limit = await enforceMarketingAccountLimit(licenseHash, accountId, platform, rows.length);
  const existingForOwner = mappedSourcesForAccount(existing, Array.from(ownerKeys));
  if (mappingSignature(existingForOwner) === mappingSignature(rows.map((row) => ({
    id: row.source_account_id,
    currency: row.source_currency,
    provider_key_id: row.provider_key_id,
  })))) {
    return { count: rows.length, limit, unchanged: true };
  }
  const ownerKeyList = Array.from(ownerKeys);
  const rollbackRows = mappingStorageRows(licenseHash, platform, existing, ownerKeyList);
  try {
    await deleteMappingRowsForOwners(licenseHash, platform, ownerKeyList);
    await insertMappingRows(rows);
  } catch (error) {
    await restoreMappingRowsAfterFailure(licenseHash, platform, ownerKeyList, rollbackRows, error, "save_mapping");
    throw error;
  }
  for (const dashboardAccountId of Array.from(new Set(rows.map((row) => safeText(row.dashboard_account_id)).filter(Boolean)))) {
    if (providerKey) await saveProviderAssignment(licenseHash, dashboardAccountId, providerKey);
  }
  return { count: rows.length, limit, unchanged: false };
}

async function saveMappings(
  licenseHash: string,
  platform: string,
  mappings: Array<{ dashboardAccountId?: string; dashboardAccountKey?: string; sourceAccounts?: Array<{ id?: string; currency?: string }> }>,
  linkedAccounts: any[],
  providerKey: ProviderKey | null = null,
  clientRequestId = "",
) {
  const rows: any[] = [];
  const selectedByAccount = new Map<string, number>();
  for (const mapping of mappings) {
    const dashboardAccountId = stableAccountKey(mapping && (mapping.dashboardAccountKey || mapping.dashboardAccountId));
    if (!dashboardAccountId || dashboardAccountId === "__all__") continue;
    const sourceAccounts = Array.isArray(mapping.sourceAccounts) ? mapping.sourceAccounts : [];
    const usableLinkedAccounts = await linkedAccountsForSelectedSources(licenseHash, platform, sourceAccounts, linkedAccounts, providerKey, clientRequestId);
    const accountRows = mappingRows(licenseHash, dashboardAccountId, platform, sourceAccounts, usableLinkedAccounts, providerKey);
    debug("mapping:bulk_rows_built", {
      clientRequestId,
      dashboardAccountId,
      platform,
      selectedCount: sourceAccounts.length,
      rowCount: accountRows.length,
      providerRefs: Array.from(new Set(accountRows.map((row) => safeText(row.provider_key_id) || "legacy"))),
      droppedSourceIds: sourceAccounts
        .map((source) => safeText(source && source.id))
        .filter((id) => id && !accountRows.some((row) => safeText(row.source_account_id) === id)),
    });
    accountRows
      .forEach((row) => {
        rows.push(row);
        selectedByAccount.set(dashboardAccountId, (selectedByAccount.get(dashboardAccountId) || 0) + 1);
      });
  }
  if (rows.some((row) => !row.source_currency)) throw new Error("SOURCE_CURRENCY_REQUIRED");
  assertUniformObjectKeys(rows, "save_mappings");
  assertSingleSourceOwner(rows);
  const limits: Record<string, unknown> = {};
  for (const [dashboardAccountId, selectedCount] of selectedByAccount.entries()) {
    limits[dashboardAccountId] = await enforceMarketingAccountLimit(licenseHash, dashboardAccountId, platform, selectedCount);
  }
  const desiredMappings: MarketingMapping = {};
  rows.forEach((row) => {
    const accountId = safeText(row.dashboard_account_id);
    if (!desiredMappings[accountId]) desiredMappings[accountId] = [];
    desiredMappings[accountId].push({
      id: safeText(row.source_account_id),
      name: safeText(row.source_account_name),
      currency: safeCurrency(row.source_currency),
      providerKeyId: safeText(row.provider_key_id),
    });
  });
  const existingMappings = await getMappings(licenseHash, platform);
  if (mappingsSignature(existingMappings) === mappingsSignature(desiredMappings)) {
    return { count: rows.length, limits, unchanged: true };
  }
  const rollbackRows = mappingStorageRows(licenseHash, platform, existingMappings);
  const allOwnerKeys = Object.keys(existingMappings || {}).concat(Object.keys(desiredMappings || {}));
  try {
    const query = new URLSearchParams({ license_key_hash: `eq.${licenseHash}`, platform: `eq.${platform}` });
    await supabaseRest(`/rest/v1/marketing_account_mappings?${query.toString()}`, { method: "DELETE" });
    await insertMappingRows(rows);
  } catch (error) {
    await restoreMappingRowsAfterFailure(licenseHash, platform, allOwnerKeys, rollbackRows, error, "save_mappings");
    throw error;
  }
  for (const dashboardAccountId of Array.from(new Set(rows.map((row) => safeText(row.dashboard_account_id)).filter(Boolean)))) {
    if (providerKey) await saveProviderAssignment(licenseHash, dashboardAccountId, providerKey);
  }
  return { count: rows.length, limits, unchanged: false };
}

async function hideReleasedSourceAccount(
  licenseHash: string,
  platform: string,
  sourceAccountId: string,
  providerKey: ProviderKey | null = null,
) {
  const sourceId = safeText(sourceAccountId);
  if (!sourceId) return;
  const providerKeyId = providerKeyIdValue(providerKey);
  const now = new Date().toISOString();
  await supabaseRest("/rest/v1/marketing_source_accounts?on_conflict=license_key_hash,platform,provider_key_id,source_account_id", {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      license_key_hash: licenseHash,
      platform,
      provider_key_id: providerKeyId,
      source_account_id: sourceId,
      source_account_name: sourceId,
      source_currency: null,
      status: "hidden",
      discovered_by: "release",
      last_seen_at: now,
      updated_at: now,
    }),
  });
}

async function releaseSourceAccount(
  licenseHash: string,
  accountId: string,
  platform: string,
  sourceAccountId: string,
  accountAliases: unknown[] = [],
  providerKey: ProviderKey | null = null,
  clientRequestId = "",
) {
  const sourceId = safeText(sourceAccountId);
  if (!sourceId) throw new Error("SOURCE_ACCOUNT_ID_REQUIRED");
  if (!accountId || accountId === "__all__") throw new Error("SELECT_ACCOUNT_TO_RELEASE");
  const mappings = await getMappings(licenseHash, platform);
  let releasedSource: MappedSourceAccount | null = null;
  const ownerId = Object.keys(mappings).find((targetId) =>
    (Array.isArray(mappings[targetId]) ? mappings[targetId] : []).some((source) => {
      const match = source.id === sourceId;
      if (match) releasedSource = source;
      return match;
    }));
  if (!ownerId) throw new Error("SOURCE_ACCOUNT_NOT_ASSIGNED");
  const ownerKeys = new Set([accountId, ...accountAliases]
    .map((value) => stableAccountKey(value) || safeText(value)).filter(Boolean));
  if (!ownerKeys.has(stableAccountKey(ownerId) || safeText(ownerId))) {
    throw new Error("SOURCE_ACCOUNT_ASSIGNED_ELSEWHERE");
  }
  let releaseProviderKey = providerKey;
  try {
    releaseProviderKey = await resolveProviderKeyRef(sourceProviderRef(releasedSource || {
      id: sourceId,
      name: sourceId,
      currency: "",
      providerKeyId: "",
    }, providerKey), providerKey);
  } catch (_) {
    const lookup = await findSourceAccountProvider(
      licenseHash,
      platform,
      releasedSource || { id: sourceId, name: sourceId, currency: "", providerKeyId: "" },
      providerKey,
      clientRequestId,
    );
    releaseProviderKey = lookup.providerKey || providerKey;
  }
  debug("release:source_resolved", {
    clientRequestId,
    dashboardAccountId: accountId,
    platform,
    sourceAccountId: sourceId,
    ownerId,
    providerKeyId: releaseProviderKey && releaseProviderKey.id || "legacy",
    sourceProviderKeyId: releasedSource && releasedSource.providerKeyId || "",
  });
  const mappingQuery = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    platform: `eq.${platform}`,
    source_account_id: `eq.${sourceId}`,
  });
  await supabaseRest(`/rest/v1/marketing_account_mappings?${mappingQuery.toString()}`, { method: "DELETE" });
  await hideReleasedSourceAccount(licenseHash, platform, sourceId, releaseProviderKey);
  return { releasedSourceAccountId: sourceId, ownerId, providerKeyId: releaseProviderKey && releaseProviderKey.id || "legacy" };
}

async function windsorGet(url: URL, options: { timeoutMs?: number; timeoutLabel?: string } = {}) {
  const timeoutMs = Number(options.timeoutMs || WINDSOR_STATUS_TIMEOUT_MS);
  const timeoutLabel = safeText(options.timeoutLabel) || "WINDSOR_STATUS_TIMEOUT";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    if (error && typeof error === "object" && (error as any).name === "AbortError") {
      throw new WindsorApiError(timeoutLabel, 504, "TIMEOUT", false);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!response.ok) {
    const nestedMessage = data && typeof data.error === "object" ? safeText(data.error.message) : "";
    const nestedCode = data && typeof data.error === "object" ? safeText(data.error.code) : "";
    const directMessage = data && typeof data === "object" ? safeText(data.message) : "";
    const stringError = data && typeof data.error === "string" ? safeText(data.error) : "";
    const message = nestedMessage || directMessage || stringError || `windsor_${response.status}`;
    const code = nestedCode || stringError;
    throw new WindsorApiError(message, response.status, code, isWindsorReconnectMessage(message, code));
  }
  return data;
}

function firstUrl(payload: any) {
  if (typeof payload === "string" && payload.startsWith("http")) return payload;
  if (!payload || typeof payload !== "object") return "";
  return safeText(payload.url || payload.authorization_url || payload.authorizationUrl || payload.link ||
    (payload.data && (payload.data.url || payload.data.authorization_url || payload.data.link)));
}

function firstAccessToken(payload: any, authorizationUrl: string) {
  const direct = payload && typeof payload === "object"
    ? safeText(payload.access_token || payload.accessToken || (payload.data && (payload.data.access_token || payload.data.accessToken)))
    : "";
  if (direct) return direct;
  try { return new URL(authorizationUrl).searchParams.get("access_token") || ""; } catch { return ""; }
}

function linkedAccountRows(payload: any) {
  const rows = Array.isArray(payload)
    ? payload
    : (payload && Array.isArray(payload.data)
      ? payload.data
      : (payload && Array.isArray(payload.results) ? payload.results : []));
  const flattened: any[] = [];
  rows.forEach((row: any) => {
    if (row && Array.isArray(row.accounts)) {
      row.accounts.forEach((account: any) => flattened.push(account));
    } else {
      flattened.push(row);
    }
  });
  return flattened;
}

function normalizeLinkedAccounts(payload: any) {
  const seen = new Set<string>();
  return linkedAccountRows(payload).map((row: any) => ({
    id: safeText(row.account_id || row.accountId || row.ds_account_id || row.datasource_account_id || row.id),
    name: safeText(row.account_name || row.accountName || row.ds_account_name || row.name),
    currency: safeCurrency(row.currency || row.account_currency || row.accountCurrency),
  })).filter((account: any) => {
    if (!account.id || seen.has(account.id)) return false;
    seen.add(account.id);
    return true;
  });
}

function uniqueAccounts(rows: any[]) {
  const seen = new Set<string>();
  return rows.map((item: any) => {
    const id = safeText(item.account_id || item.accountId || item.id || item.value);
    return {
      id,
      name: usefulAccountName(item.account_name, id) ||
        usefulAccountName(item.accountName, id) ||
        usefulAccountName(item.name, id) ||
        usefulAccountName(item.label, id) ||
        id,
      currency: safeCurrency(item.currency || item.account_currency || item.accountCurrency),
    };
  }).filter((account: any) => {
    if (!account.id || seen.has(account.id)) return false;
    seen.add(account.id);
    return true;
  });
}

function mergeAccountDetails(primary: any[], fallback: any[]) {
  const fallbackById = new Map((Array.isArray(fallback) ? fallback : []).map((account: any) => [account.id, account]));
  const merged = (Array.isArray(primary) ? primary : []).map((account: any) => {
    const other = fallbackById.get(account.id) || {};
    return {
      id: account.id,
      name: usefulAccountName(account.name, account.id) || usefulAccountName(other.name, account.id) || account.id,
      currency: safeCurrency(account.currency) || safeCurrency(other.currency),
    };
  });
  const seen = new Set(merged.map((account: any) => account.id));
  (Array.isArray(fallback) ? fallback : []).forEach((account: any) => {
    if (account.id && !seen.has(account.id)) merged.push(account);
  });
  return merged;
}

async function getMarketingAccountsFromData(platform: string, apiKey = windsorApiKey) {
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  const url = new URL(`https://connectors.windsor.ai/${config.dsId}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", "account_id,account_name,currency");
  url.searchParams.set("date_preset", "last_year");
  configureWindsorReportUrl(url);
  const payload = await windsorGet(url, { timeoutMs: WINDSOR_STATUS_TIMEOUT_MS, timeoutLabel: "WINDSOR_ACCOUNT_DISCOVERY_TIMEOUT" });
  const rows = windsorReportRows(payload);
  return {
    accounts: uniqueAccounts(rows),
    diagnostics: {
      lookup: `${config.dsId}_report_account_fields`,
      rowCount: rows.length,
      rootKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).slice(0, 14) : [],
      firstRowKeys: rows.length && rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0, 14) : [],
    },
  };
}

async function getMarketingAccountsFromWorkspace(platform: string, apiKey = windsorApiKey) {
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  const url = new URL("https://onboard.windsor.ai/api/common/ds-accounts");
  url.searchParams.set("datasource", config.dsId);
  url.searchParams.set("api_key", apiKey);
  const payload = await windsorGet(url, { timeoutMs: WINDSOR_STATUS_TIMEOUT_MS, timeoutLabel: "WINDSOR_ACCOUNT_DISCOVERY_TIMEOUT" });
  const rows = Array.isArray(payload) ? payload : (payload && Array.isArray(payload.data) ? payload.data : []);
  return {
    accounts: uniqueAccounts(rows),
    diagnostics: {
      lookup: "workspace_ds_accounts",
      rowCount: rows.length,
      rootKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload).slice(0, 14) : [],
      firstRowKeys: rows.length && rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0, 14) : [],
    },
  };
}

async function getAllWindsorAccounts(platform: string, apiKey = windsorApiKey) {
  let accounts: any[] = [];
  let diagnostics: Record<string, unknown> = {};
  try {
    const workspaceResult = await getMarketingAccountsFromWorkspace(platform, apiKey);
    accounts = mergeSourceAccounts(accounts, workspaceResult.accounts);
    diagnostics.workspace = workspaceResult.diagnostics;
  } catch (error) {
    diagnostics.workspaceError = error instanceof Error ? error.message : String(error);
  }
  try {
    const reportResult = await getMarketingAccountsFromData(platform, apiKey);
    accounts = mergeSourceAccounts(accounts, reportResult.accounts);
    diagnostics.report = reportResult.diagnostics;
  } catch (error) {
    diagnostics.reportError = error instanceof Error ? error.message : String(error);
  }
  return { accounts, diagnostics };
}

async function getTikTokAccountsFromData(apiKey = windsorApiKey) {
  return getMarketingAccountsFromData("tiktok", apiKey);
}

async function getTikTokAccountsFromWorkspace(apiKey = windsorApiKey) {
  return getMarketingAccountsFromWorkspace("tiktok", apiKey);
}

async function checkConnectionStatus(connection: any, platform = "tiktok", apiKey = windsorApiKey, knownAccounts: any[] = []) {
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  if (!connection) {
    debug("status:no_saved_connection");
    const cachedAccounts = mergeSourceAccounts(knownAccounts);
    if (cachedAccounts.length) {
      return {
        status: "disconnected",
        linkedAccounts: [],
        claimableAccounts: cachedAccounts,
        diagnostics: {
          hasSavedConnection: false,
          tokenPresent: false,
          rawLinkedRows: 0,
          normalizedLinkedAccounts: cachedAccounts.length,
          connectionAccountRows: 0,
          optionsAccounts: cachedAccounts.length,
          optionsError: "",
          optionsShape: { lookup: "known_source_accounts" },
          workspaceAvailable: true,
          providerRequestCount: 0,
        },
      };
    }
    let linkedAccounts: any[] = [];
    let optionsError = "";
    let optionsShape = null;
    try {
      const workspaceResult = await getMarketingAccountsFromWorkspace(platform, apiKey);
      linkedAccounts = workspaceResult.accounts;
      optionsShape = workspaceResult.diagnostics;
    } catch (error) {
      optionsError = "workspace: " + (error instanceof Error ? error.message : String(error));
    }
    try {
      const reportResult = await getMarketingAccountsFromData(platform, apiKey);
      optionsShape = reportResult.diagnostics;
      linkedAccounts = linkedAccounts.length
        ? mergeAccountDetails(linkedAccounts, reportResult.accounts)
        : reportResult.accounts;
    } catch (error) {
      const reportError = error instanceof Error ? error.message : String(error);
      optionsError = (optionsError ? optionsError + "; " : "") + "report: " + reportError;
    }
    return {
      status: "disconnected",
      linkedAccounts: [],
      claimableAccounts: linkedAccounts,
      diagnostics: {
        hasSavedConnection: false,
        tokenPresent: false,
        rawLinkedRows: 0,
        normalizedLinkedAccounts: linkedAccounts.length,
        connectionAccountRows: 0,
        optionsAccounts: linkedAccounts.length,
        optionsError,
        optionsShape,
        workspaceAvailable: linkedAccounts.length > 0,
      },
    };
  }
  const url = new URL("https://onboard.windsor.ai/api/team/co-user-linked-accounts/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("ds_id", config.dsId);
  if (connection.windsor_access_token) url.searchParams.set("access_token", connection.windsor_access_token);
  const payload = await windsorGet(url, { timeoutMs: WINDSOR_STATUS_TIMEOUT_MS, timeoutLabel: "WINDSOR_PROVIDER_STATUS_TIMEOUT" });
  const rawRows = linkedAccountRows(payload);
  const linkedAccountsFromConnection = normalizeLinkedAccounts(payload);
  let linkedAccounts = linkedAccountsFromConnection.length
    ? mergeAccountDetails(linkedAccountsFromConnection, knownAccounts)
    : [];
  let optionsAccounts = 0;
  let optionsError = "";
  let optionsShape = null;
  if (!linkedAccountsFromConnection.length) {
    try {
      const workspaceResult = await getMarketingAccountsFromWorkspace(platform, apiKey);
      optionsAccounts = workspaceResult.accounts.length;
      optionsShape = workspaceResult.diagnostics;
      if (workspaceResult.accounts.length) linkedAccounts = mergeAccountDetails(workspaceResult.accounts, linkedAccounts);
    } catch (error) {
      optionsError = "workspace: " + (error instanceof Error ? error.message : String(error));
    }
    try {
      const reportResult = await getMarketingAccountsFromData(platform, apiKey);
      optionsAccounts = linkedAccounts.length || reportResult.accounts.length;
      optionsShape = reportResult.diagnostics;
      linkedAccounts = linkedAccounts.length
        ? mergeAccountDetails(linkedAccounts, reportResult.accounts)
        : reportResult.accounts;
    } catch (error) {
      const reportError = error instanceof Error ? error.message : String(error);
      optionsError = (optionsError ? optionsError + "; " : "") + "report: " + reportError;
    }
  } else {
    optionsAccounts = linkedAccounts.length;
    optionsShape = { lookup: "linked_accounts_with_known_source_cache" };
  }
  const diagnostics = {
    hasSavedConnection: true,
    tokenPresent: !!connection.windsor_access_token,
    rawLinkedRows: rawRows.length,
    connectionAccountIds: linkedAccountsFromConnection.map((account: any) => account.id),
    normalizedLinkedAccounts: linkedAccounts.length,
    connectionAccountRows: linkedAccountsFromConnection.length,
    optionsAccounts,
    optionsError,
    optionsShape,
    providerRequestCount: linkedAccountsFromConnection.length ? 1 : 3,
    firstRowKeys: rawRows.length && rawRows[0] && typeof rawRows[0] === "object" ? Object.keys(rawRows[0]).slice(0, 14) : [],
  };
  debug("status:linked_accounts", diagnostics);
  if (!rawRows.length && !linkedAccountsFromConnection.length) {
    const reconnectRequired = connection.status === "connected" && !!connection.windsor_access_token;
    return {
      status: connection.status === "pending" ? "pending" : "disconnected",
      linkedAccounts: [],
      claimableAccounts: linkedAccounts,
      diagnostics: {
        ...diagnostics,
        workspaceAvailable: linkedAccounts.length > 0,
        workspaceOnlyConnection: linkedAccounts.length > 0,
      },
      reconnectRequired,
      error: reconnectRequired ? "WINDSOR_RECONNECT_REQUIRED" : undefined,
    };
  }
  return {
    status: "connected",
    linkedAccounts,
    linkedAccountCount: linkedAccounts.length,
    diagnostics,
  };
}

function publicConnection(connection: any, update: any = {}, mappings: any = {}, platform = "tiktok") {
  const mappedAccounts = Array.isArray(update.mappedAccounts)
    ? update.mappedAccounts
    : (Array.isArray(update.linkedAccounts) ? update.linkedAccounts : []);
  const availableAccounts = Array.isArray(update.availableAccounts) ? update.availableAccounts : [];
  const status = update.status || (connection && connection.status) || "disconnected";
  const exposeStoredConnection = status === "connected" || mappedAccounts.length > 0;
  return {
    ok: true,
    platform,
    status,
    error: update.error || "",
    reconnectRequired: !!update.reconnectRequired,
    sourceAccountId: update.sourceAccountId || (exposeStoredConnection && connection && connection.source_account_id) || "",
    sourceAccountName: update.sourceAccountName || (exposeStoredConnection && connection && connection.source_account_name) || "",
    mappedAccounts,
    availableAccounts,
    linkedAccounts: update.linkedAccounts || mappedAccounts,
    linkedAccountCount: Array.isArray(update.linkedAccounts) ? update.linkedAccounts.length : mappedAccounts.length,
    claimableAccounts: Array.isArray(update.claimableAccounts) ? update.claimableAccounts : [],
    diagnostics: update.diagnostics || null,
    limit: update.limit || null,
    limits: update.limits || null,
    mappings,
    statusCheckedAt: update.statusCheckedAt || (connection && connection.status_checked_at) || null,
    lastSyncAt: update.lastSyncAt || (exposeStoredConnection && connection && connection.last_sync_at) || null,
    summary: update.summary || (exposeStoredConnection && connection && connection.last_summary) || null,
    cache: update.cache || null,
    stale: !!update.stale,
  };
}

function convertSpend(amount: number, from: string, to: string, egpRate: number, exchangeRates?: Record<string, number>) {
  const source = safeCurrency(from) || "USD";
  const target = safeCurrency(to) || source;
  if (source === target) return amount;
  const rates = normalizeExchangeRates(exchangeRates, egpRate);
  const sourceRate = Number(rates[source] || 1);
  const targetRate = Number(rates[target] || sourceRate);
  if (!sourceRate || !targetRate) return amount;
  return (amount / sourceRate) * targetRate;
}

function metricNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return Number(String(value || "0").replace(/,/g, "").trim()) || 0;
}

function isoDate(value: unknown) {
  const text = safeText(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function addUtcDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function datesBetween(dateFrom: string, dateTo: string) {
  const start = isoDate(dateFrom);
  const end = isoDate(dateTo);
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addUtcDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function contiguousDateRanges(dates: string[]) {
  const sorted = Array.from(new Set(dates.map(isoDate).filter(Boolean))).sort();
  const ranges: Array<{ dateFrom: string; dateTo: string }> = [];
  sorted.forEach((date) => {
    const current = ranges[ranges.length - 1];
    if (current && addUtcDays(current.dateTo, 1) === date) current.dateTo = date;
    else ranges.push({ dateFrom: date, dateTo: date });
  });
  return ranges;
}

function providerCacheRef(providerKey: ProviderKey | null) {
  return providerKeyRef(providerKey);
}

async function getDailyMetrics(
  licenseHash: string,
  providerKey: ProviderKey | null,
  platform: string,
  sourceAccountIds: string[],
  dateFrom: string,
  dateTo: string,
) {
  const wanted = new Set(sourceAccountIds.map(safeText).filter(Boolean));
  if (!wanted.size || !isoDate(dateFrom) || !isoDate(dateTo)) return [] as DailyMetricRow[];
  const query = new URLSearchParams({
    license_key_hash: `eq.${licenseHash}`,
    provider_key_ref: `eq.${providerCacheRef(providerKey)}`,
    platform: `eq.${platform}`,
    report_date: `gte.${dateFrom}`,
    order: "report_date.asc",
    select: "*",
  });
  query.append("report_date", `lte.${dateTo}`);
  const rows = await supabaseRest(`/rest/v1/marketing_daily_metrics?${query.toString()}`);
  return (Array.isArray(rows) ? rows : []).filter((row: any) => wanted.has(safeText(row.source_account_id))) as DailyMetricRow[];
}

async function saveDailyMetrics(rows: DailyMetricRow[]) {
  if (!rows.length) return;
  await supabaseRest(
    "/rest/v1/marketing_daily_metrics?on_conflict=license_key_hash,provider_key_ref,platform,source_account_id,report_date",
    {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    },
  );
}

function dailyMetricKey(sourceAccountId: string, reportDate: string) {
  return `${safeText(sourceAccountId)}|${isoDate(reportDate)}`;
}

function hasTrafficViewSchema(row: DailyMetricRow) {
  const campaigns = Array.isArray(row && row.campaign_breakdown) ? row.campaign_breakdown : [];
  const cacheMarker = campaigns.find((campaign: any) => campaign && campaign._dailyMetricCache === true);
  return !!cacheMarker &&
    cacheMarker.cacheSchemaVersion === DAILY_METRIC_CACHE_SCHEMA_VERSION &&
    campaigns.filter((campaign: any) => !(campaign && campaign._dailyMetricCache === true)).every((campaign: any) =>
      campaign &&
      campaign.trafficViewSchemaVersion === TRAFFIC_VIEW_SCHEMA_VERSION &&
      Object.prototype.hasOwnProperty.call(campaign, "landingPageViews") &&
      Object.prototype.hasOwnProperty.call(campaign, "contentViews") &&
      Object.prototype.hasOwnProperty.call(campaign, "trafficViewAvailable")
    );
}

function aggregateCampaigns(rows: DailyMetricRow[], source: SourceAccount, targetCurrency: string, egpRate: number, platform: string, dashboardAccountId: string, exchangeRates?: Record<string, number>) {
  const campaigns = new Map<string, any>();
  rows.forEach((row) => {
    (Array.isArray(row.campaign_breakdown) ? row.campaign_breakdown : []).forEach((campaign: any) => {
      if (campaign && campaign._dailyMetricCache === true) return;
      const campaignId = safeText(campaign && campaign.campaign_id);
      const campaignName = safeText(campaign && campaign.campaign);
      if (!campaignName) return;
      const key = campaignId || `name:${campaignName}`;
      const current = campaigns.get(key) || {
        platform,
        dashboardAccountId,
        accountId: source.id,
        accountName: source.name,
        campaign_id: campaignId,
        campaign: campaignName,
        currency: source.currency,
        rawSpend: 0,
        targetCurrency,
        convertedSpend: 0,
        impressions: 0,
        clicks: 0,
        landingPageViews: 0,
        contentViews: 0,
        trafficViewAvailable: false,
        trafficViewSource: "",
        trafficViewSchemaVersion: TRAFFIC_VIEW_SCHEMA_VERSION,
        purchases: 0,
        purchaseMetric: "",
        purchaseMetricAvailable: false,
        rowCount: 0,
      };
      current.rawSpend += metricNumber(campaign.rawSpend);
      current.impressions += metricNumber(campaign.impressions);
      current.clicks += metricNumber(campaign.clicks);
      current.landingPageViews += metricNumber(campaign.landingPageViews);
      current.contentViews += metricNumber(campaign.contentViews);
      current.trafficViewAvailable = current.trafficViewAvailable || campaign.trafficViewAvailable === true;
      if (!current.trafficViewSource && campaign.trafficViewSource) current.trafficViewSource = safeText(campaign.trafficViewSource);
      current.purchases += metricNumber(campaign.purchases);
      current.purchaseMetricAvailable = current.purchaseMetricAvailable || campaign.purchaseMetricAvailable === true;
      if (!current.purchaseMetric && campaign.purchaseMetric) current.purchaseMetric = safeText(campaign.purchaseMetric);
      current.rowCount += metricNumber(campaign.rowCount);
      campaigns.set(key, current);
    });
  });
  return Array.from(campaigns.values()).map((campaign) => ({
    ...campaign,
    rawSpend: Number(campaign.rawSpend.toFixed(2)),
    convertedSpend: Number(convertSpend(campaign.rawSpend, source.currency, targetCurrency, egpRate, exchangeRates).toFixed(2)),
    purchases: Number(campaign.purchases.toFixed(2)),
    trafficViews: campaign.landingPageViews > 0 ? campaign.landingPageViews : campaign.contentViews,
  }));
}

function sourceSummaryFromDailyRows(
  rows: DailyMetricRow[],
  source: SourceAccount,
  targetCurrency: string,
  egpRate: number,
  platform: string,
  dashboardAccountId: string,
  exchangeRates?: Record<string, number>,
) {
  const rawSpend = rows.reduce((sum, row) => sum + metricNumber(row.raw_spend), 0);
  const impressions = rows.reduce((sum, row) => sum + metricNumber(row.impressions), 0);
  const clicks = rows.reduce((sum, row) => sum + metricNumber(row.clicks), 0);
  const rowCount = rows.reduce((sum, row) => sum + metricNumber(row.row_count), 0);
  const campaigns = aggregateCampaigns(rows, source, targetCurrency, egpRate, platform, dashboardAccountId, exchangeRates);
  const purchases = campaigns.reduce((sum, campaign) => sum + metricNumber(campaign.purchases), 0);
  const purchaseMetric = campaigns.find((campaign) => campaign.purchaseMetric)?.purchaseMetric || platformPurchaseFields(platform)[0] || "";
  const purchaseMetricAvailable = campaigns.some((campaign) => campaign.purchaseMetricAvailable === true);
  const dailyBreakdown = rows.map((row) => {
    const campaignRows = (Array.isArray(row.campaign_breakdown) ? row.campaign_breakdown : [])
      .filter((campaign: any) => !(campaign && campaign._dailyMetricCache === true));
    const dayPurchases = campaignRows.reduce((sum: number, campaign: any) => sum + metricNumber(campaign && campaign.purchases), 0);
    const dayPurchaseMetric = campaignRows.find((campaign: any) => campaign && campaign.purchaseMetric)?.purchaseMetric || purchaseMetric;
    const dayPurchaseMetricAvailable = campaignRows.some((campaign: any) => campaign && campaign.purchaseMetricAvailable === true);
    const rawDaySpend = metricNumber(row.raw_spend);
    return {
      platform,
      date: isoDate(row.report_date),
      accountId: source.id,
      accountName: source.name,
      currency: source.currency,
      rawSpend: Number(rawDaySpend.toFixed(2)),
      targetCurrency,
      convertedSpend: Number(convertSpend(rawDaySpend, source.currency, targetCurrency, egpRate, exchangeRates).toFixed(2)),
      impressions: metricNumber(row.impressions),
      clicks: metricNumber(row.clicks),
      purchases: Number(dayPurchases.toFixed(2)),
      purchaseMetric: safeText(dayPurchaseMetric),
      purchaseMetricAvailable: dayPurchaseMetricAvailable,
      rowCount: metricNumber(row.row_count),
    };
  }).filter((row) => row.date);
  return {
    platform,
    id: source.id,
    name: source.name,
    currency: source.currency,
    rawSpend: Number(rawSpend.toFixed(2)),
    targetCurrency,
    convertedSpend: Number(convertSpend(rawSpend, source.currency, targetCurrency, egpRate, exchangeRates).toFixed(2)),
    impressions,
    clicks,
    purchases: Number(purchases.toFixed(2)),
    purchaseMetric,
    purchaseMetricAvailable,
    campaignCount: campaigns.length,
    rowCount,
    dailyBreakdown,
    campaigns,
  };
}

function aggregateDailyPlatformBreakdown(sourceBreakdown: any[]) {
  const byKey = new Map<string, any>();
  (Array.isArray(sourceBreakdown) ? sourceBreakdown : []).forEach((source: any) => {
    (Array.isArray(source && source.dailyBreakdown) ? source.dailyBreakdown : []).forEach((day: any) => {
      const platform = safeText(day && day.platform).toLowerCase() || safeText(source && source.platform).toLowerCase() || "unknown";
      const date = isoDate(day && day.date);
      if (!date) return;
      const key = `${platform}|${date}`;
      const current = byKey.get(key) || {
        platform,
        date,
        spend: 0,
        purchases: 0,
        impressions: 0,
        clicks: 0,
        purchaseMetric: "",
        purchaseMetricAvailable: false,
        rowCount: 0,
      };
      current.spend += metricNumber(day && (day.convertedSpend != null ? day.convertedSpend : day.adSpend));
      current.purchases += metricNumber(day && day.purchases);
      current.impressions += metricNumber(day && day.impressions);
      current.clicks += metricNumber(day && day.clicks);
      current.rowCount += metricNumber(day && day.rowCount);
      current.purchaseMetricAvailable = current.purchaseMetricAvailable || day && day.purchaseMetricAvailable === true;
      if (!current.purchaseMetric && day && day.purchaseMetric) current.purchaseMetric = safeText(day.purchaseMetric);
      byKey.set(key, current);
    });
  });
  return Array.from(byKey.values()).map((row) => ({
    ...row,
    spend: Number(row.spend.toFixed(2)),
    purchases: Number(row.purchases.toFixed(2)),
  })).sort((a, b) => a.date.localeCompare(b.date) || a.platform.localeCompare(b.platform));
}

async function fetchDailyMetricsRange(
  licenseHash: string,
  providerKey: ProviderKey | null,
  platform: string,
  source: SourceAccount,
  dateFrom: string,
  dateTo: string,
  apiKey: string,
  clientRequestId = "",
) {
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  const baseFields = marketingReportFields(platform, true);
  const reportUrl = new URL(`https://connectors.windsor.ai/${config.dsId}`);
  reportUrl.searchParams.set("api_key", apiKey);
  reportUrl.searchParams.set("fields", baseFields);
  configureWindsorReportUrl(reportUrl);
  reportUrl.searchParams.set("date_from", dateFrom);
  reportUrl.searchParams.set("date_to", dateTo);
  if (platform === "tiktok") reportUrl.searchParams.set("report_timezone", "Local");
  reportUrl.searchParams.set("filter", JSON.stringify([["account_id", "eq", source.id]]));
  debug("windsor:report_fetch_start", {
    clientRequestId,
    platform,
    providerKeyId: providerKeyRef(providerKey),
    sourceAccountId: source.id,
    dateFrom,
    dateTo,
  });
  const reportStartedAt = Date.now();
  const report = await windsorGet(reportUrl, { timeoutMs: WINDSOR_REPORT_TIMEOUT_MS, timeoutLabel: "WINDSOR_REPORT_TIMEOUT" });
  const reportFetchMs = Date.now() - reportStartedAt;
  const reportRows = windsorReportRows(report);
  debug("windsor:report_fetch_done", {
    clientRequestId,
    platform,
    providerKeyId: providerKeyRef(providerKey),
    sourceAccountId: source.id,
    rowCount: reportRows.length,
    durationMs: reportFetchMs,
  });
  const byDate = new Map<string, any[]>();
  reportRows.forEach((row: any) => {
    const reportDate = isoDate(row && row.date);
    if (!reportDate || reportDate < dateFrom || reportDate > dateTo) return;
    if (!byDate.has(reportDate)) byDate.set(reportDate, []);
    byDate.get(reportDate)!.push(row);
  });
  const now = new Date().toISOString();
  return datesBetween(dateFrom, dateTo).map((reportDate) => {
    const rows = byDate.get(reportDate) || [];
    const campaigns = new Map<string, any>();
    rows.forEach((row: any) => {
      const campaignId = safeText(row.campaign_id);
      const campaign = safeText(row.campaign);
      if (!campaign) return;
      const key = campaignId || `name:${campaign}`;
      const current = campaigns.get(key) || {
        campaign_id: campaignId,
        campaign,
        rawSpend: 0,
        impressions: 0,
        clicks: 0,
        landingPageViews: 0,
        contentViews: 0,
        trafficViewAvailable: false,
        trafficViewSource: "",
        trafficViewSchemaVersion: TRAFFIC_VIEW_SCHEMA_VERSION,
        purchases: 0,
        purchaseMetric: "",
        purchaseMetricAvailable: false,
        rowCount: 0,
      };
      const views = trafficViewMetrics(row, platform);
      const purchase = platformPurchaseMetric(row, platform);
      current.rawSpend += metricNumber(row.spend);
      current.impressions += metricNumber(row.impressions);
      current.clicks += metricNumber(row.clicks);
      current.landingPageViews += views.landingPageViews;
      current.contentViews += views.contentViews;
      current.trafficViewAvailable = current.trafficViewAvailable || views.trafficViewAvailable;
      if (!current.trafficViewSource && views.trafficViewSource) current.trafficViewSource = views.trafficViewSource;
      current.purchases += purchase.purchases;
      current.purchaseMetricAvailable = current.purchaseMetricAvailable || purchase.purchaseMetricAvailable;
      if (!current.purchaseMetric && purchase.purchaseMetric) current.purchaseMetric = purchase.purchaseMetric;
      current.rowCount += 1;
      campaigns.set(key, current);
    });
    const campaignBreakdown = [
      {
        _dailyMetricCache: true,
        cacheSchemaVersion: DAILY_METRIC_CACHE_SCHEMA_VERSION,
      },
      ...Array.from(campaigns.values()).map((campaign) => ({
        ...campaign,
        rawSpend: Number(campaign.rawSpend.toFixed(2)),
        purchases: Number(campaign.purchases.toFixed(2)),
        trafficViews: campaign.landingPageViews > 0 ? campaign.landingPageViews : campaign.contentViews,
      })),
    ];
    return {
      license_key_hash: licenseHash,
      provider_key_ref: providerCacheRef(providerKey),
      platform,
      source_account_id: source.id,
      report_date: reportDate,
      source_account_name: source.name,
      source_currency: source.currency,
      raw_spend: Number(rows.reduce((sum: number, row: any) => sum + metricNumber(row.spend), 0).toFixed(2)),
      impressions: rows.reduce((sum: number, row: any) => sum + metricNumber(row.impressions), 0),
      clicks: rows.reduce((sum: number, row: any) => sum + metricNumber(row.clicks), 0),
      row_count: rows.length,
      campaign_breakdown: campaignBreakdown,
      fetched_at: now,
      updated_at: now,
    } as DailyMetricRow;
  });
}

function incrementalRefreshDates(dateFrom: string, dateTo: string) {
  const today = new Date().toISOString().slice(0, 10);
  const todayRollingStart = addUtcDays(today, -2);
  const selectedRollingStart = addUtcDays(dateTo, -2);
  return datesBetween(dateFrom, dateTo).filter((date) =>
    (date >= todayRollingStart && date <= today) ||
    (date >= selectedRollingStart && date <= dateTo)
  );
}

async function syncDashboardAccountIncremental(
  licenseHash: string,
  accountId: string,
  platform: string,
  connection: any,
  mappings: MarketingMapping,
  body: RequestBody,
  targetCurrencyValue: unknown,
  egpRateValue: unknown,
  mappingAliases: unknown[] = [],
  apiKey = windsorApiKey,
  providerKey: ProviderKey | null = null,
) {
  const totalStartedAt = Date.now();
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  const dateFrom = isoDate(body.dateFrom);
  const dateTo = isoDate(body.dateTo);
  if (!dateFrom || !dateTo || dateFrom > dateTo) throw new Error("MARKETING_DATE_RANGE_REQUIRED");
  const targetCurrency = safeCurrency(targetCurrencyValue) || "SAR";
  const exchangeRates = normalizeExchangeRates(body.exchangeRates, egpRateValue);
  const egpRate = exchangeRates.EGP;
  const mappedSources = mappedSourcesForAccount(mappings, [accountId, ...mappingAliases]);
  if (!mappedSources.length) throw new Error("MAP_MARKETING_ACCOUNT_FIRST");
  if (mappedSources.some((source) => !safeCurrency(source.currency))) throw new Error("SOURCE_CURRENCY_REQUIRED");

  const selectedDates = datesBetween(dateFrom, dateTo);
  const refreshDates = body.mode === "full"
    ? selectedDates
    : (body.recomposeOnly ? [] : incrementalRefreshDates(dateFrom, dateTo));
  const cacheReadStartedAt = Date.now();
  const existingRows = await getDailyMetrics(
    licenseHash,
    providerKey,
    platform,
    mappedSources.map((source) => source.id),
    dateFrom,
    dateTo,
  );
  const cacheReadMs = Date.now() - cacheReadStartedAt;
  const rowsByKey = new Map(existingRows.map((row) => [dailyMetricKey(row.source_account_id, row.report_date), row]));
  const diagnostics = {
    mode: body.mode === "full" ? "full" : "incremental",
    reusedDays: 0,
    fetchedRanges: [] as Array<{ sourceAccountId: string; dateFrom: string; dateTo: string }>,
    refreshedDays: 0,
    stale: false,
    providerRequestCount: 0,
    reportFetchMs: 0,
    cacheReadMs,
    cacheWriteMs: 0,
    totalSyncMs: 0,
  };

  for (const source of mappedSources) {
    const missingDates = selectedDates.filter((date) => {
      const cached = rowsByKey.get(dailyMetricKey(source.id, date));
      return !cached || !hasTrafficViewSchema(cached);
    });
    const datesToFetch = body.mode === "full"
      ? selectedDates
      : Array.from(new Set([...missingDates, ...refreshDates])).sort();
    const ranges = contiguousDateRanges(datesToFetch);
    if (!ranges.length) {
      diagnostics.reusedDays += selectedDates.length;
      continue;
    }
    const pendingRows: DailyMetricRow[] = [];
    try {
      for (const range of ranges) {
        diagnostics.providerRequestCount += 1;
        diagnostics.fetchedRanges.push({ sourceAccountId: source.id, ...range });
        const reportStartedAt = Date.now();
        const fetched = await fetchDailyMetricsRange(
          licenseHash,
          providerKey,
          platform,
          source,
          range.dateFrom,
          range.dateTo,
          apiKey,
          safeText(body.clientRequestId),
        );
        diagnostics.reportFetchMs += Date.now() - reportStartedAt;
        pendingRows.push(...fetched);
      }
      const cacheWriteStartedAt = Date.now();
      await saveDailyMetrics(pendingRows);
      diagnostics.cacheWriteMs += Date.now() - cacheWriteStartedAt;
      pendingRows.forEach((row) => rowsByKey.set(dailyMetricKey(row.source_account_id, row.report_date), row));
      diagnostics.refreshedDays += pendingRows.length;
      diagnostics.reusedDays += Math.max(0, selectedDates.length - datesToFetch.length);
    } catch (error) {
      if (missingDates.length) throw error;
      diagnostics.stale = true;
      diagnostics.reusedDays += selectedDates.length;
    }
  }

  const sourceBreakdown = mappedSources.map((source) => {
    const rows = selectedDates.map((date) => rowsByKey.get(dailyMetricKey(source.id, date))).filter(Boolean) as DailyMetricRow[];
    if (rows.length !== selectedDates.length) throw new Error("MARKETING_CACHE_INCOMPLETE");
    return sourceSummaryFromDailyRows(rows, source, targetCurrency, egpRate, platform, accountId, exchangeRates);
  });
  const dailyPlatformBreakdown = aggregateDailyPlatformBreakdown(sourceBreakdown);
  const campaignBreakdown = sourceBreakdown.flatMap((source) => source.campaigns);
  const summary = sourceBreakdown.reduce((out: any, source: any) => {
    out.adSpend += source.convertedSpend;
    out.impressions += source.impressions;
    out.clicks += source.clicks;
    out.purchases += source.purchases || 0;
    out.campaignCount += source.campaignCount;
    out.rowCount += source.rowCount;
    if (!out.purchaseMetric && source.purchaseMetric) out.purchaseMetric = source.purchaseMetric;
    out.purchaseMetricAvailable = out.purchaseMetricAvailable || source.purchaseMetricAvailable === true;
    return out;
  }, {
    adSpend: 0,
    currency: targetCurrency,
    exchangeRates,
    egpRate,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    purchaseMetric: "",
    purchaseMetricAvailable: false,
    campaignCount: 0,
    rowCount: 0,
    dateFrom,
    dateTo,
    sourceBreakdown,
    dailyPlatformBreakdown,
    campaignBreakdown,
  });
  summary.adSpend = Number(summary.adSpend.toFixed(2));
  summary.purchases = Number(summary.purchases.toFixed(2));
  const now = new Date().toISOString();
  await upsertConnection({
    license_key_hash: licenseHash,
    dashboard_account_id: accountId,
    ...providerKeyFields(providerKey),
    platform,
    status: "connected",
    source_account_id: mappedSources.length === 1 ? mappedSources[0].id : null,
    source_account_name: mappedSources.length === 1 ? mappedSources[0].name || null : `${mappedSources.length} mapped ${config.label} accounts`,
    last_sync_at: now,
    last_summary: summary,
    updated_at: now,
  });
  const limit = await getMarketingLimitInfo(licenseHash, accountId, platform, mappedSources.length);
  diagnostics.totalSyncMs = Date.now() - totalStartedAt;
  return {
    ok: true,
    platform,
    status: "connected",
    sourceAccountId: mappedSources.length === 1 ? mappedSources[0].id : "",
    sourceAccountName: mappedSources.length === 1 ? mappedSources[0].name || "" : `${mappedSources.length} mapped ${config.label} accounts`,
    linkedAccounts: mappedSources,
    linkedAccountCount: mappedSources.length,
    mappedSourceAccountCount: mappedSources.length,
    mappings,
    lastSyncAt: now,
    summary,
    limit,
    cache: diagnostics,
    stale: diagnostics.stale,
    diagnostics: {
      cacheMode: diagnostics.mode,
      reusedDays: diagnostics.reusedDays,
      refreshedDays: diagnostics.refreshedDays,
      providerRequestCount: diagnostics.providerRequestCount,
      timings: {
        reportFetchMs: diagnostics.reportFetchMs,
        cacheReadMs: diagnostics.cacheReadMs,
        cacheWriteMs: diagnostics.cacheWriteMs,
        totalSyncMs: diagnostics.totalSyncMs,
      },
    },
  };
}

async function syncDashboardAccountLegacy(
  licenseHash: string,
  accountId: string,
  platform: string,
  connection: any,
  status: any,
  mappings: MarketingMapping,
  body: RequestBody,
  targetCurrencyValue: unknown,
  egpRateValue: unknown,
  mappingAliases: unknown[] = [],
  apiKey = windsorApiKey,
  providerKey: ProviderKey | null = null,
) {
  const totalStartedAt = Date.now();
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  const targetCurrency = safeCurrency(targetCurrencyValue) || "SAR";
  const exchangeRates = normalizeExchangeRates(body.exchangeRates, egpRateValue);
  const egpRate = exchangeRates.EGP;
  const mappedSources = mappedSourcesForAccount(mappings, [accountId, ...mappingAliases]);
  if (!mappedSources.length) throw new Error("MAP_MARKETING_ACCOUNT_FIRST");
  const missingCurrency = mappedSources.find((source) => !safeCurrency(source.currency));
  if (missingCurrency) throw new Error("SOURCE_CURRENCY_REQUIRED");

  const number = metricNumber;
  const sourceBreakdown: any[] = [];
  const campaignBreakdown: any[] = [];
  let reportFetchMs = 0;
  
  // Fetch Windsor report data for mapped sources in parallel with concurrency limit
  const reports = await pLimit(3, mappedSources, async (source) => {
    const baseFields = marketingReportFields(platform, false);
    const reportUrl = new URL(`https://connectors.windsor.ai/${config.dsId}`);
    reportUrl.searchParams.set("api_key", apiKey);
    reportUrl.searchParams.set("fields", baseFields);
    configureWindsorReportUrl(reportUrl);
    if (safeText(body.dateFrom)) reportUrl.searchParams.set("date_from", safeText(body.dateFrom));
    if (safeText(body.dateTo)) reportUrl.searchParams.set("date_to", safeText(body.dateTo));
    if (platform === "tiktok") reportUrl.searchParams.set("report_timezone", "Local");
    reportUrl.searchParams.set("filter", JSON.stringify([["account_id", "eq", source.id]]));
    debug("windsor:legacy_report_fetch_start", {
      clientRequestId: safeText(body.clientRequestId),
      platform,
      providerKeyId: providerKeyRef(providerKey),
      sourceAccountId: source.id,
      dateFrom: safeText(body.dateFrom),
      dateTo: safeText(body.dateTo),
    });
    const reportStartedAt = Date.now();
    const report = await windsorGet(reportUrl, { timeoutMs: WINDSOR_REPORT_TIMEOUT_MS, timeoutLabel: "WINDSOR_REPORT_TIMEOUT" });
    const sourceReportFetchMs = Date.now() - reportStartedAt;
    reportFetchMs += sourceReportFetchMs;
    const rows = windsorReportRows(report);
    debug("windsor:legacy_report_fetch_done", {
      clientRequestId: safeText(body.clientRequestId),
      platform,
      providerKeyId: providerKeyRef(providerKey),
      sourceAccountId: source.id,
      rowCount: rows.length,
      durationMs: sourceReportFetchMs,
    });
    return { source, report };
  });

  for (const { source, report } of reports) {
    const rows = windsorReportRows(report);
    const rawSpend = rows.reduce((sum: number, row: any) => sum + number(row.spend), 0);
    const impressions = rows.reduce((sum: number, row: any) => sum + number(row.impressions), 0);
    const clicks = rows.reduce((sum: number, row: any) => sum + number(row.clicks), 0);
    let sourcePurchases = 0;
    let sourcePurchaseMetric = "";
    let sourcePurchaseMetricAvailable = false;
    const currency = safeCurrency(source.currency);
    const campaigns = new Map<string, any>();
    rows.forEach((row: any) => {
      const campaignId = safeText(row.campaign_id);
      const campaign = safeText(row.campaign);
      if (!campaign) return;
      const campaignKey = campaignId || `name:${campaign}`;
      const current = campaigns.get(campaignKey) || {
        platform,
        dashboardAccountId: accountId,
        accountId: source.id,
        accountName: source.name,
        campaign_id: campaignId,
        campaign,
        currency,
        rawSpend: 0,
        targetCurrency,
        convertedSpend: 0,
        impressions: 0,
        clicks: 0,
        landingPageViews: 0,
        contentViews: 0,
        trafficViewAvailable: false,
        trafficViewSource: "",
        trafficViewSchemaVersion: TRAFFIC_VIEW_SCHEMA_VERSION,
        purchases: 0,
        purchaseMetric: "",
        purchaseMetricAvailable: false,
        rowCount: 0,
      };
      const views = trafficViewMetrics(row, platform);
      const purchase = platformPurchaseMetric(row, platform);
      current.rawSpend += number(row.spend);
      current.impressions += number(row.impressions);
      current.clicks += number(row.clicks);
      current.landingPageViews += views.landingPageViews;
      current.contentViews += views.contentViews;
      current.trafficViewAvailable = current.trafficViewAvailable || views.trafficViewAvailable;
      if (!current.trafficViewSource && views.trafficViewSource) current.trafficViewSource = views.trafficViewSource;
      current.purchases += purchase.purchases;
      current.purchaseMetricAvailable = current.purchaseMetricAvailable || purchase.purchaseMetricAvailable;
      if (!current.purchaseMetric && purchase.purchaseMetric) current.purchaseMetric = purchase.purchaseMetric;
      sourcePurchases += purchase.purchases;
      sourcePurchaseMetricAvailable = sourcePurchaseMetricAvailable || purchase.purchaseMetricAvailable;
      if (!sourcePurchaseMetric && purchase.purchaseMetric) sourcePurchaseMetric = purchase.purchaseMetric;
      current.rowCount += 1;
      campaigns.set(campaignKey, current);
    });
    const sourceCampaigns = Array.from(campaigns.values()).map((campaign: any) => {
      const convertedSpend = Number(convertSpend(campaign.rawSpend, currency, targetCurrency, egpRate, exchangeRates).toFixed(2));
      return {
        ...campaign,
        rawSpend: Number(campaign.rawSpend.toFixed(2)),
        convertedSpend,
        purchases: Number(campaign.purchases.toFixed(2)),
        trafficViews: campaign.landingPageViews > 0 ? campaign.landingPageViews : campaign.contentViews,
      };
    });
    sourceCampaigns.forEach((campaign) => campaignBreakdown.push(campaign));
    const convertedSpend = Number(convertSpend(rawSpend, currency, targetCurrency, egpRate, exchangeRates).toFixed(2));
    const sourceSummary = {
      platform,
      id: source.id,
      name: source.name,
      currency,
      rawSpend: Number(rawSpend.toFixed(2)),
      targetCurrency,
      convertedSpend,
      impressions,
      clicks,
      purchases: Number(sourcePurchases.toFixed(2)),
      purchaseMetric: sourcePurchaseMetric || platformPurchaseFields(platform)[0] || "",
      purchaseMetricAvailable: sourcePurchaseMetricAvailable,
      campaignCount: sourceCampaigns.length,
      rowCount: rows.length,
      campaigns: sourceCampaigns,
    };
    sourceBreakdown.push(sourceSummary);
    debug("sync:source_summary", {
      dashboardAccountId: accountId,
      sourceAccountId: source.id,
      sourceAccountName: source.name,
      sourceCurrency: currency,
      rawSpend: sourceSummary.rawSpend,
      targetCurrency,
      convertedSpend,
      rowCount: rows.length,
      dateFrom: safeText(body.dateFrom),
      dateTo: safeText(body.dateTo),
    });
  }

  const summary = sourceBreakdown.reduce((out: any, source: any) => {
    out.adSpend += source.convertedSpend;
    out.impressions += source.impressions;
    out.clicks += source.clicks;
    out.purchases += source.purchases || 0;
    out.campaignCount += source.campaignCount;
    out.rowCount += source.rowCount;
    if (!out.purchaseMetric && source.purchaseMetric) out.purchaseMetric = source.purchaseMetric;
    out.purchaseMetricAvailable = out.purchaseMetricAvailable || source.purchaseMetricAvailable === true;
    return out;
  }, {
    adSpend: 0,
    currency: targetCurrency,
    exchangeRates,
    egpRate,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    purchaseMetric: "",
    purchaseMetricAvailable: false,
    campaignCount: 0,
    rowCount: 0,
    dateFrom: body.dateFrom || "",
    dateTo: body.dateTo || "",
    sourceBreakdown,
    campaignBreakdown,
  });
  summary.adSpend = Number(summary.adSpend.toFixed(2));
  summary.purchases = Number(summary.purchases.toFixed(2));
  const now = new Date().toISOString();
  await upsertConnection({
    license_key_hash: licenseHash,
    dashboard_account_id: accountId,
    ...providerKeyFields(providerKey),
    platform,
    status: "connected",
    source_account_id: mappedSources.length === 1 ? mappedSources[0].id : null,
    source_account_name: mappedSources.length === 1 ? mappedSources[0].name || null : `${mappedSources.length} mapped ${config.label} accounts`,
    last_sync_at: now,
    last_summary: summary,
    updated_at: now,
  });
  const limit = await getMarketingLimitInfo(licenseHash, accountId, platform, mappedSources.length);
  debug("sync:account_summary", {
    dashboardAccountId: accountId,
    targetCurrency,
    adSpend: summary.adSpend,
    sourceAccountCount: mappedSources.length,
    rowCount: summary.rowCount,
  });
  return {
    ok: true,
    platform,
    status: "connected",
    sourceAccountId: mappedSources.length === 1 ? mappedSources[0].id : "",
    sourceAccountName: mappedSources.length === 1 ? mappedSources[0].name || "" : `${mappedSources.length} mapped ${config.label} accounts`,
    linkedAccounts: status.linkedAccounts || [],
    linkedAccountCount: Array.isArray(status.linkedAccounts) ? status.linkedAccounts.length : 0,
    mappedSourceAccountCount: mappedSources.length,
    mappings,
    lastSyncAt: now,
    summary,
    limit,
    cache: {
      mode: "legacy",
      reusedDays: 0,
      refreshedDays: 0,
      providerRequestCount: mappedSources.length,
      reportFetchMs,
      cacheReadMs: 0,
      cacheWriteMs: 0,
      totalSyncMs: Date.now() - totalStartedAt,
      stale: false,
      fetchedRanges: [],
    },
    diagnostics: {
      cacheMode: "legacy",
      reusedDays: 0,
      refreshedDays: 0,
      providerRequestCount: mappedSources.length,
      timings: {
        reportFetchMs,
        totalSyncMs: Date.now() - totalStartedAt,
      },
    },
  };
}

function sourceProviderRef(source: MappedSourceAccount, fallbackProviderKey: ProviderKey | null) {
  const sourceRef = safeText(source && source.providerKeyId);
  if (sourceRef) return sourceRef;
  return providerKeyRef(fallbackProviderKey);
}

async function resolveProviderKeyRef(providerRef: string, fallbackProviderKey: ProviderKey | null) {
  const ref = safeText(providerRef) || providerKeyRef(fallbackProviderKey);
  if (ref === providerKeyRef(fallbackProviderKey)) return fallbackProviderKey || legacyProviderKey();
  if (ref === "legacy") return legacyProviderKey();
  const key = await getProviderKeyById(ref);
  if (!key) throw new Error("MARKETING_PROVIDER_KEY_NOT_FOUND");
  return key;
}

function mappingForSources(accountId: string, sources: MappedSourceAccount[]) {
  return { [accountId]: sources };
}

function mergeSyncCache(results: any[]) {
  return results.reduce((cache: any, result: any) => {
    const source = result && result.cache || {};
    cache.reusedDays += Number(source.reusedDays || 0);
    cache.refreshedDays += Number(source.refreshedDays || 0);
    cache.providerRequestCount += Number(source.providerRequestCount || 0);
    cache.stale = cache.stale || !!source.stale || !!(result && result.stale);
    cache.fetchedRanges = cache.fetchedRanges.concat(Array.isArray(source.fetchedRanges) ? source.fetchedRanges : []);
    cache.reportFetchMs += Number(source.reportFetchMs || 0);
    cache.cacheReadMs += Number(source.cacheReadMs || 0);
    cache.cacheWriteMs += Number(source.cacheWriteMs || 0);
    cache.totalSyncMs += Number(source.totalSyncMs || 0);
    return cache;
  }, {
    mode: results.some((result: any) => result && result.cache && result.cache.mode === "incremental") ? "incremental" : "full",
    reusedDays: 0,
    refreshedDays: 0,
    providerRequestCount: 0,
    stale: false,
    fetchedRanges: [],
    reportFetchMs: 0,
    cacheReadMs: 0,
    cacheWriteMs: 0,
    totalSyncMs: 0,
  });
}

async function syncDashboardAccountAcrossProviders(
  licenseHash: string,
  accountId: string,
  platform: string,
  connection: any,
  status: any,
  mappings: MarketingMapping,
  body: RequestBody,
  targetCurrencyValue: unknown,
  egpRateValue: unknown,
  mappingAliases: unknown[] = [],
  fallbackApiKey = windsorApiKey,
  fallbackProviderKey: ProviderKey | null = null,
) {
  const config = platformConfig(platform);
  if (!config) throw new Error("PLATFORM_NOT_AVAILABLE");
  let mappedSources = mappedSourcesForAccount(mappings, [accountId, ...mappingAliases]);
  if (!mappedSources.length) throw new Error("MAP_MARKETING_ACCOUNT_FIRST");
  const clientRequestId = safeText(body.clientRequestId);
  const ownershipChecks = await pLimit(2, mappedSources, async (source) => {
    let preferredProviderKey = fallbackProviderKey;
    try {
      preferredProviderKey = await resolveProviderKeyRef(sourceProviderRef(source, fallbackProviderKey), fallbackProviderKey);
    } catch (_) {
      preferredProviderKey = fallbackProviderKey;
    }
    return await findSourceAccountProvider(licenseHash, platform, source, preferredProviderKey, clientRequestId);
  });
  const changedOwnership = ownershipChecks.filter((item) => item.changed);
  mappedSources = ownershipChecks.map((item) => item.source);
  if (changedOwnership.length) {
    debug("sync:provider_ownership_corrected", {
      clientRequestId,
      dashboardAccountId: accountId,
      platform,
      changedSourceIds: changedOwnership.map((item) => item.source.id),
      providerRefs: Array.from(new Set(mappedSources.map((source) => sourceProviderRef(source, fallbackProviderKey)))),
    });
    try {
      await saveMapping(
        licenseHash,
        accountId,
        platform,
        mappedSources.map((source) => ({ id: source.id, currency: source.currency })),
        mappedSources,
        fallbackProviderKey,
        mappingAliases,
        clientRequestId,
      );
    } catch (error) {
      debug("sync:provider_ownership_persist_failed", {
        clientRequestId,
        dashboardAccountId: accountId,
        platform,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  debug("sync:provider_groups_ready", {
    clientRequestId,
    dashboardAccountId: accountId,
    platform,
    sourceAccountIds: mappedSources.map((source) => source.id),
    providerRefs: mappedSources.map((source) => sourceProviderRef(source, fallbackProviderKey)),
  });

  const groups = new Map<string, MappedSourceAccount[]>();
  mappedSources.forEach((source) => {
    const ref = sourceProviderRef(source, fallbackProviderKey);
    if (!groups.has(ref)) groups.set(ref, []);
    groups.get(ref)!.push(source);
  });

  if (groups.size === 1) {
    const [providerRef, sources] = Array.from(groups.entries())[0];
    const groupProviderKey = await resolveProviderKeyRef(providerRef, fallbackProviderKey);
    const result: any = await syncDashboardAccount(
      licenseHash,
      accountId,
      platform,
      connection,
      { ...status, status: "connected", linkedAccounts: sources, mappedAccounts: sources },
      mappingForSources(accountId, sources),
      body,
      targetCurrencyValue,
      egpRateValue,
      [],
      groupProviderKey.apiKey,
      groupProviderKey,
    );
    return {
      ...result,
      linkedAccounts: mappedSources,
      linkedAccountCount: mappedSources.length,
      mappedSourceAccountCount: mappedSources.length,
      mappings,
      limit: await getMarketingLimitInfo(licenseHash, accountId, platform, mappedSources.length),
      diagnostics: {
        ...(result && result.diagnostics || {}),
        clientRequestId,
        providerGroupCount: 1,
        providerRefs: Array.from(groups.keys()),
        providerOwnershipCorrectedCount: changedOwnership.length,
        sourceProviderRefs: mappedSources.map((source) => ({
          id: source.id,
          providerKeyId: sourceProviderRef(source, fallbackProviderKey),
        })),
      },
    };
  }

  const groupEntries = Array.from(groups.entries());
  const results = await pLimit(3, groupEntries, async ([providerRef, sources]) => {
    const groupProviderKey = await resolveProviderKeyRef(providerRef, fallbackProviderKey);
    const groupMapping = mappingForSources(accountId, sources);
    return await syncDashboardAccount(
      licenseHash,
      accountId,
      platform,
      connection,
      { ...status, status: "connected", linkedAccounts: sources, mappedAccounts: sources },
      groupMapping,
      body,
      targetCurrencyValue,
      egpRateValue,
      [],
      groupProviderKey.apiKey,
      groupProviderKey,
    );
  });

  const targetCurrency = safeCurrency(targetCurrencyValue) || "SAR";
  const exchangeRates = normalizeExchangeRates(body.exchangeRates, egpRateValue);
  const egpRate = exchangeRates.EGP;
  const sourceBreakdown = results.flatMap((result: any) =>
    Array.isArray(result && result.summary && result.summary.sourceBreakdown) ? result.summary.sourceBreakdown : []
  );
  const campaignBreakdown = results.flatMap((result: any) =>
    Array.isArray(result && result.summary && result.summary.campaignBreakdown) ? result.summary.campaignBreakdown : []
  );
  const dailyPlatformBreakdown = aggregateDailyPlatformBreakdown(sourceBreakdown);
  const summary = results.reduce((out: any, result: any) => {
    const source = result && result.summary || {};
    out.adSpend += Number(source.adSpend || 0);
    out.impressions += Number(source.impressions || 0);
    out.clicks += Number(source.clicks || 0);
    out.purchases += Number(source.purchases || 0);
    out.campaignCount += Number(source.campaignCount || 0);
    out.rowCount += Number(source.rowCount || 0);
    if (!out.purchaseMetric && source.purchaseMetric) out.purchaseMetric = source.purchaseMetric;
    out.purchaseMetricAvailable = out.purchaseMetricAvailable || source.purchaseMetricAvailable === true;
    return out;
  }, {
    adSpend: 0,
    currency: targetCurrency,
    exchangeRates,
    egpRate,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    purchaseMetric: "",
    purchaseMetricAvailable: false,
    campaignCount: 0,
    rowCount: 0,
    dateFrom: body.dateFrom || "",
    dateTo: body.dateTo || "",
    sourceBreakdown,
    dailyPlatformBreakdown,
    campaignBreakdown,
  });
  summary.adSpend = Number(summary.adSpend.toFixed(2));
  summary.purchases = Number(summary.purchases.toFixed(2));
  const now = new Date().toISOString();
  await upsertConnection({
    license_key_hash: licenseHash,
    dashboard_account_id: accountId,
    ...providerKeyFields(fallbackProviderKey),
    platform,
    status: "connected",
    source_account_id: mappedSources.length === 1 ? mappedSources[0].id : null,
    source_account_name: mappedSources.length === 1 ? mappedSources[0].name || null : `${mappedSources.length} mapped ${config.label} accounts`,
    last_sync_at: now,
    last_summary: summary,
    updated_at: now,
  });
  const limit = await getMarketingLimitInfo(licenseHash, accountId, platform, mappedSources.length);
  const cache = mergeSyncCache(results);
  return {
    ok: true,
    platform,
    status: "connected",
    sourceAccountId: mappedSources.length === 1 ? mappedSources[0].id : "",
    sourceAccountName: mappedSources.length === 1 ? mappedSources[0].name || "" : `${mappedSources.length} mapped ${config.label} accounts`,
    linkedAccounts: mappedSources,
    linkedAccountCount: mappedSources.length,
    mappedSourceAccountCount: mappedSources.length,
    mappings,
    lastSyncAt: now,
    summary,
    limit,
    cache,
    stale: cache.stale,
    diagnostics: {
      clientRequestId,
      providerGroupCount: groupEntries.length,
      providerRefs: groupEntries.map(([providerRef]) => providerRef),
      providerOwnershipCorrectedCount: changedOwnership.length,
      sourceProviderRefs: mappedSources.map((source) => ({
        id: source.id,
        providerKeyId: sourceProviderRef(source, fallbackProviderKey),
      })),
      groupResults: results.map((result: any) => ({
        linkedAccountCount: Number(result && result.linkedAccountCount || 0),
        rowCount: Number(result && result.summary && result.summary.rowCount || 0),
        adSpend: Number(result && result.summary && result.summary.adSpend || 0),
        error: safeText(result && result.error),
      })),
    },
  };
}

async function syncDashboardAccount(
  licenseHash: string,
  accountId: string,
  platform: string,
  connection: any,
  status: any,
  mappings: MarketingMapping,
  body: RequestBody,
  targetCurrencyValue: unknown,
  egpRateValue: unknown,
  mappingAliases: unknown[] = [],
  apiKey = windsorApiKey,
  providerKey: ProviderKey | null = null,
) {
  if (body.mode === "incremental" || body.mode === "full") {
    return await syncDashboardAccountIncremental(
      licenseHash,
      accountId,
      platform,
      connection,
      mappings,
      body,
      targetCurrencyValue,
      egpRateValue,
      mappingAliases,
      apiKey,
      providerKey,
    );
  }
  return await syncDashboardAccountLegacy(
    licenseHash,
    accountId,
    platform,
    connection,
    status,
    mappings,
    body,
    targetCurrencyValue,
    egpRateValue,
    mappingAliases,
    apiKey,
    providerKey,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  await getLiveRates();
  if (request.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "MARKETING_BACKEND_NOT_CONFIGURED" }, 503);
  }

  try {
    const body: RequestBody = await request.json();
    debug("request:start", {
      action: body.action || "",
      platform: body.platform || "",
      dashboardAccountId: safeText(body.dashboardAccountId),
      requestedSourceAccountId: safeText(body.sourceAccountId),
    });
    const platform = safeText(body.platform || "tiktok").toLowerCase();
    const config = platformConfig(platform);
    if (!config) return json({ ok: false, error: "PLATFORM_NOT_AVAILABLE" }, 400);
    const rawAccountId = safeText(body.dashboardAccountId);
    const accountKey = stableAccountKey(body.dashboardAccountKey);
    const accountId = rawAccountId === "__all__" ? "__all__" : (accountKey || rawAccountId);
    if (!accountId) return json({ ok: false, error: "SELECT_ACCOUNT" }, 400);
    const auth = await validateLicense(body.identity || {});
    if (!auth) {
      debug("request:license_invalid", { action: body.action || "", dashboardAccountId: accountId });
      return json({ ok: false, error: "LICENSE_INVALID" }, 403);
    }

    const accountConnection = accountId === "__all__" ? null : await getConnection(auth.licenseHash, accountId, platform);
    const allAccountConnection = accountId === "__all__" ? await getConnection(auth.licenseHash, "__all__", platform) : null;
    let connection = accountId === "__all__" ? (allAccountConnection || await getAnyConnection(auth.licenseHash, platform)) : accountConnection;
    if (!connection) connection = await getAnyConnection(auth.licenseHash, platform);
    const providerAccountId = accountId === "__all__" ? "__connection__" : accountId;
    const providerKey = await resolveProviderKey(auth.licenseHash, providerAccountId, {
      createAssignment: body.action === "connect",
      connection,
    });
    if (accountId !== "__all__" && !accountConnection && providerKey.id && safeText(connection && connection.provider_key_id) !== providerKey.id) {
      connection = null;
    }
    debug("request:connection_loaded", { action: body.action || "", dashboardAccountId: accountId, found: !!connection, status: connection && connection.status || "" });
    debug("provider:resolved", { action: body.action || "", dashboardAccountId: accountId, providerKeyId: providerKey.id || "legacy", providerKeyLabel: providerKey.label, legacy: providerKey.legacy });
    if (body.action === "connect") {
      const beforeConnect = await getAllWindsorAccounts(platform, providerKey.apiKey);
      const authUrl = new URL("https://onboard.windsor.ai/api/team/generate-co-user-url/");
      authUrl.searchParams.set("allowed_sources", config.dsId);
      authUrl.searchParams.set("api_key", providerKey.apiKey);
      const response = await windsorGet(authUrl, { timeoutMs: WINDSOR_STATUS_TIMEOUT_MS, timeoutLabel: "WINDSOR_AUTHORIZATION_TIMEOUT" });
      const authorizationUrl = firstUrl(response);
      if (!authorizationUrl) throw new Error("windsor_authorization_url_missing");
      const accessToken = firstAccessToken(response, authorizationUrl);
      await upsertConnection({
        license_key_hash: auth.licenseHash,
        dashboard_account_id: accountId === "__all__" ? "__connection__" : accountId,
        ...providerKeyFields(providerKey),
        platform,
        status: "pending",
        windsor_access_token: accessToken || null,
        connect_snapshot: sourceAccountSnapshot(beforeConnect.accounts, beforeConnect.diagnostics),
        connect_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      debug("connect:pending_saved", { dashboardAccountId: accountId, tokenPresent: !!accessToken, snapshotCount: beforeConnect.accounts.length });
      return json({ ok: true, platform, status: "pending", authorizationUrl });
    }

    if (body.action === "status") {
      if (body.mode === "cached") {
        const mappings = await getMappings(auth.licenseHash, platform, accountId === "__all__" ? "" : accountId);
        const knownAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
        const displayedConnection = accountId === "__all__" ? allAccountConnection : accountConnection;
        if (accountId !== "__all__") {
          const mappedSources = mappedSourcesForAccount(mappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
          const limit = await getMarketingLimitInfo(auth.licenseHash, accountId, platform, mappedSources.length);
          const cachedStatus = mappedSources.length
            ? "connected"
            : (displayedConnection && displayedConnection.status === "pending" ? "pending" : "disconnected");
          return json(publicConnection(displayedConnection, {
            status: cachedStatus,
            mappedAccounts: mappedSources,
            availableAccounts: mappedSources,
            linkedAccounts: mappedSources,
            linkedAccountCount: mappedSources.length,
            claimableAccounts: [],
            limit,
            statusCheckedAt: displayedConnection && displayedConnection.status_checked_at || null,
            cache: { status: "cached", providerRequestCount: 0 },
          }, mappings, platform));
        }
        const requestedSettings = Array.isArray(body.accountSettings) ? body.accountSettings : [];
        const limits: Record<string, unknown> = {};
        let mappedAccountCount = 0;
        for (const setting of requestedSettings) {
          const requestedDashboardAccountId = safeText(setting && setting.dashboardAccountId);
          const dashboardAccountKey = stableAccountKey(setting && setting.dashboardAccountKey);
          const dashboardAccountKeys = Array.isArray(setting && setting.dashboardAccountKeys)
            ? setting.dashboardAccountKeys.map((key) => stableAccountKey(key)).filter(Boolean)
            : [];
          const storedDashboardAccountId = dashboardAccountKey || requestedDashboardAccountId;
          const lookupKeys = Array.from(new Set([requestedDashboardAccountId, dashboardAccountKey, ...dashboardAccountKeys].filter(Boolean)));
          if (!storedDashboardAccountId) continue;
          const mappedSources = mappedSourcesForAccount(mappings, lookupKeys);
          if (mappedSources.length) mappedAccountCount += 1;
          limits[requestedDashboardAccountId || storedDashboardAccountId] =
            await getMarketingLimitInfo(auth.licenseHash, storedDashboardAccountId, platform, mappedSources.length);
        }
        return json(publicConnection(displayedConnection, {
          status: mappedAccountCount
            ? "connected"
            : (displayedConnection && displayedConnection.status === "pending" ? "pending" : "disconnected"),
          mappedAccounts: [],
          availableAccounts: knownAccounts,
          linkedAccounts: knownAccounts,
          linkedAccountCount: knownAccounts.length,
          claimableAccounts: [],
          limits,
          statusCheckedAt: displayedConnection && displayedConnection.status_checked_at || null,
          cache: { status: "cached", providerRequestCount: 0 },
        }, mappings, platform));
      }
      const hiddenSourceIds = await getHiddenSourceAccountIds(auth.licenseHash, platform);
      const knownStatusAccounts = excludeSourceAccountIds(await getKnownSourceAccounts(auth.licenseHash, platform), hiddenSourceIds);
      const providerStatusStartedAt = Date.now();
      const rawStatus: any = await checkConnectionStatus(connection, platform, providerKey.apiKey, knownStatusAccounts);
      const providerStatusMs = Date.now() - providerStatusStartedAt;
      const hasActiveConnectSession = !!(connection && connection.connect_snapshot);
      const connectionAccountIds = new Set<string>((Array.isArray(rawStatus && rawStatus.diagnostics && rawStatus.diagnostics.connectionAccountIds)
        ? rawStatus.diagnostics.connectionAccountIds
        : [])
        .map((id: unknown) => safeText(id))
        .filter(Boolean));
      const visibleHiddenSourceIds = hasActiveConnectSession
        ? removeSourceAccountIds(hiddenSourceIds, connectionAccountIds)
        : hiddenSourceIds;
      const status = {
        ...rawStatus,
        linkedAccounts: excludeSourceAccountIds(rawStatus.linkedAccounts || [], visibleHiddenSourceIds),
        mappedAccounts: excludeSourceAccountIds(rawStatus.mappedAccounts || [], visibleHiddenSourceIds),
        availableAccounts: excludeSourceAccountIds(rawStatus.availableAccounts || [], visibleHiddenSourceIds),
        claimableAccounts: excludeSourceAccountIds(rawStatus.claimableAccounts || [], visibleHiddenSourceIds),
      };
      const statusCheckedAt = new Date().toISOString();
      let mappings = await getMappings(auth.licenseHash, platform, accountId === "__all__" ? "" : accountId);
      mappings = filterMappingsWithoutSourceIds(mappings, hiddenSourceIds);
      const windsorAccounts = hasActiveConnectSession
        ? mergeSourceAccounts(status.linkedAccounts || [])
        : mergeSourceAccounts(status.linkedAccounts || [], status.claimableAccounts || []);
      const discoveredAccounts = connection && connection.connect_snapshot
        ? newAccountsSinceSnapshot(windsorAccounts, connection.connect_snapshot)
        : [];
      const connectedSessionAccounts = hasActiveConnectSession
        ? mergeSourceAccounts(status.linkedAccounts || []).filter((account: any) => connectionAccountIds.has(account.id))
        : [];
      const sessionAccounts = mergeSourceAccounts(discoveredAccounts, connectedSessionAccounts);
      let clearConnectSnapshot = false;
      if (sessionAccounts.length) {
        await upsertKnownSourceAccounts(
          auth.licenseHash,
          platform,
          sessionAccounts,
          providerKey,
          accountId === "__all__" ? "all_connect" : "single_connect",
          true,
        );
        if (accountId !== "__all__") {
          const currentSources = mappedSourcesForAccount(mappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
          const selectedSources = mergeSourceAccounts(currentSources, sessionAccounts).map((source) => ({
            id: source.id,
            currency: safeCurrency(source.currency),
          }));
          if (selectedSources.every((source) => safeCurrency(source.currency))) {
            await saveMapping(
              auth.licenseHash,
              accountId,
              platform,
              selectedSources,
              mergeSourceAccounts(currentSources, sessionAccounts),
              providerKey,
              [rawAccountId, accountKey, body.dashboardAccountLabel],
              safeText(body.clientRequestId),
            );
            clearConnectSnapshot = true;
          }
          mappings = await getMappings(auth.licenseHash, platform, accountId);
        } else {
          mappings = await getMappings(auth.licenseHash, platform);
        }
      }
      const livePrune = pruneMappingsForLiveStatus(
        mappings,
        status,
        windsorAccounts,
        body.mode === "force" && !hasActiveConnectSession,
        providerKey,
      );
      mappings = livePrune.mappings;
      if (connection && status.status !== connection.status) {
        await upsertConnection({
          license_key_hash: auth.licenseHash,
          dashboard_account_id: connection.dashboard_account_id,
          ...providerKeyFields(providerKey),
          platform,
          status: status.status,
          status_checked_at: statusCheckedAt,
          connect_snapshot: clearConnectSnapshot ? null : connection.connect_snapshot || null,
          updated_at: new Date().toISOString(),
        });
        connection = { ...connection, status: status.status, status_checked_at: statusCheckedAt };
      } else if (connection && clearConnectSnapshot) {
        await upsertConnection({
          license_key_hash: auth.licenseHash,
          dashboard_account_id: connection.dashboard_account_id,
          ...providerKeyFields(providerKey),
          platform,
          status: status.status,
          status_checked_at: statusCheckedAt,
          connect_snapshot: null,
          updated_at: new Date().toISOString(),
        });
        connection = { ...connection, status: status.status, connect_snapshot: null, status_checked_at: statusCheckedAt };
      } else if (connection) {
        await upsertConnection({
          license_key_hash: auth.licenseHash,
          dashboard_account_id: connection.dashboard_account_id,
          ...providerKeyFields(providerKey),
          platform,
          status: status.status,
          status_checked_at: statusCheckedAt,
          updated_at: connection.updated_at || new Date().toISOString(),
        });
        connection = { ...connection, status: status.status, status_checked_at: statusCheckedAt };
      } else {
        await upsertConnection({
          license_key_hash: auth.licenseHash,
          dashboard_account_id: accountId,
          ...providerKeyFields(providerKey),
          platform,
          status: status.status,
          status_checked_at: statusCheckedAt,
          updated_at: new Date().toISOString(),
        });
        connection = {
          dashboard_account_id: accountId,
          platform,
          status: status.status,
          status_checked_at: statusCheckedAt,
        };
      }
      debug("status:response", { dashboardAccountId: accountId, status: status.status, linkedAccountCount: status.linkedAccountCount || 0 });
      const displayedConnection = accountId === "__all__" ? allAccountConnection : accountConnection;
      if (accountId !== "__all__") {
        const mappedSources = mappedSourcesForAccount(mappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
        const mappedIds = new Set(mappedSources.map((source) => source.id));
        const visibleAccounts = mergeSourceAccounts(mappedSources, windsorAccounts)
          .filter((account: any) => mappedIds.has(safeText(account && account.id)));
        const selectableAccounts = mergeSourceAccounts(visibleAccounts, sessionAccounts);
        const hasOwnConnectionIntent = !!accountConnection && safeText(accountConnection.dashboard_account_id) === accountId;
        const connectionAccountRows = Number(status && status.diagnostics && status.diagnostics.connectionAccountRows || 0);
        const hasOwnVerifiedConnection = hasOwnConnectionIntent && status.status === "connected" && connectionAccountRows > 0;
        const hasMappedSources = mappedSources.length > 0;
        const assignableAccounts = hasOwnVerifiedConnection ? sessionAccounts : [];
        const authorizationPending = !!(connection && connection.status === "pending" && status.status !== "connected" && !hasMappedSources);
        const accountConnected = hasMappedSources || (!authorizationPending && assignableAccounts.length > 0);
        const limit = await getMarketingLimitInfo(auth.licenseHash, accountId, platform, mappedSources.length);
        const visibleStatus = {
          ...status,
          status: authorizationPending ? "pending" : (accountConnected ? "connected" : "disconnected"),
          mappedAccounts: hasMappedSources ? visibleAccounts : [],
          availableAccounts: selectableAccounts.length ? selectableAccounts : assignableAccounts,
          linkedAccounts: hasMappedSources ? visibleAccounts : assignableAccounts,
          linkedAccountCount: hasMappedSources ? visibleAccounts.length : assignableAccounts.length,
          claimableAccounts: [],
          diagnostics: {
            ...(status.diagnostics || {}),
            accountConnectionPresent: hasOwnConnectionIntent,
            accountConnectionVerified: hasOwnVerifiedConnection,
            accountConnected,
            authorizationPending,
            connectionRequiresAssignment: hasOwnVerifiedConnection && !hasMappedSources,
            discoveredAccountCount: discoveredAccounts.length,
            sessionAccountCount: sessionAccounts.length,
            staleMappingPruneReliable: livePrune.reliable,
            staleMappingPrunedCount: livePrune.prunedCount,
            staleMappingPruneReason: livePrune.reason,
            workspaceAvailable: assignableAccounts.length > 0,
            workspaceConnectedAccounts: assignableAccounts.length,
            assignmentRequired: hasOwnVerifiedConnection && !hasMappedSources,
            timings: {
              ...((status.diagnostics && status.diagnostics.timings) || {}),
              providerStatusMs,
            },
          },
          limit,
          statusCheckedAt,
          cache: { status: "live", providerRequestCount: Number(status && status.diagnostics && status.diagnostics.providerRequestCount || 0) },
        };
        return json(publicConnection(displayedConnection, visibleStatus, mappings, platform));
      }
      const knownAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
      const limits: Record<string, unknown> = {};
      const requestedSettings = Array.isArray(body.accountSettings) ? body.accountSettings : [];
      let mappedAccountCount = 0;
      for (const setting of requestedSettings) {
        const requestedDashboardAccountId = safeText(setting && setting.dashboardAccountId);
        const dashboardAccountKey = stableAccountKey(setting && setting.dashboardAccountKey);
        const dashboardAccountKeys = Array.isArray(setting && setting.dashboardAccountKeys)
          ? setting.dashboardAccountKeys.map((key) => stableAccountKey(key)).filter(Boolean)
          : [];
        const storedDashboardAccountId = dashboardAccountKey || requestedDashboardAccountId;
        const lookupKeys = Array.from(new Set([requestedDashboardAccountId, dashboardAccountKey, ...dashboardAccountKeys].filter(Boolean)));
        if (!storedDashboardAccountId) continue;
        const mappedSources = mappedSourcesForAccount(mappings, lookupKeys);
        if (mappedSources.length) mappedAccountCount += 1;
        limits[requestedDashboardAccountId || storedDashboardAccountId] = await getMarketingLimitInfo(auth.licenseHash, storedDashboardAccountId, platform, mappedSources.length);
      }
      return json(publicConnection(displayedConnection, {
        ...status,
        status: mappedAccountCount || sessionAccounts.length
          ? "connected"
          : (connection && connection.status === "pending" && status.status !== "connected" ? "pending" : "disconnected"),
        mappedAccounts: [],
        availableAccounts: sessionAccounts,
        linkedAccounts: sessionAccounts,
        linkedAccountCount: sessionAccounts.length,
        claimableAccounts: [],
        limits,
        diagnostics: {
          ...(status.diagnostics || {}),
          knownSourceAccountCount: knownAccounts.length,
          discoveredAccountCount: discoveredAccounts.length,
          sessionAccountCount: sessionAccounts.length,
          staleMappingPruneReliable: livePrune.reliable,
          staleMappingPrunedCount: livePrune.prunedCount,
          staleMappingPruneReason: livePrune.reason,
          timings: {
            ...((status.diagnostics && status.diagnostics.timings) || {}),
            providerStatusMs,
          },
        },
        statusCheckedAt,
        cache: { status: "live", providerRequestCount: Number(status && status.diagnostics && status.diagnostics.providerRequestCount || 0) },
      }, mappings, platform));
    }

    if (body.action === "claim_source_account") {
      const sourceAccountId = safeText(body.sourceAccountId);
      if (!sourceAccountId) return json({ ok: false, error: "SOURCE_ACCOUNT_ID_REQUIRED" }, 400);
      const claimLookup = await findSourceAccountProvider(
        auth.licenseHash,
        platform,
        {
          id: sourceAccountId,
          name: sourceAccountId,
          currency: "",
          providerKeyId: "",
        },
        providerKey,
        safeText(body.clientRequestId),
      );
      const claimProviderKey = claimLookup.providerKey || providerKey;
      const sourceAccount = claimLookup.found ? claimLookup.source : null;
      if (!sourceAccount) {
        debug("claim:source_not_found", {
          clientRequestId: safeText(body.clientRequestId),
          dashboardAccountId: accountId,
          platform,
          sourceAccountId,
        });
        return json({ ok: false, error: "SOURCE_ACCOUNT_NOT_FOUND" }, 404);
      }
      debug("claim:source_resolved", {
        clientRequestId: safeText(body.clientRequestId),
        dashboardAccountId: accountId,
        platform,
        sourceAccountId,
        providerKeyId: claimProviderKey.id || "legacy",
        providerKeyLabel: claimProviderKey.label,
        changedProvider: claimLookup.changed,
      });
      const mappings = await getMappings(auth.licenseHash, platform, accountId === "__all__" ? "" : accountId);
      await upsertKnownSourceAccounts(
        auth.licenseHash,
        platform,
        [sourceAccount],
        claimProviderKey,
        accountId === "__all__" ? "all_claim" : "single_claim",
        true,
      );
      if (accountId !== "__all__") {
        const currentSources = mappedSourcesForAccount(mappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
        const selectedSources = mergeSourceAccounts(currentSources, [sourceAccount]).map((source) => ({
          id: source.id,
          currency: safeCurrency(source.currency),
        }));
        await saveMapping(
          auth.licenseHash,
          accountId,
          platform,
          selectedSources,
          mergeSourceAccounts(currentSources, [sourceAccount]),
          claimProviderKey,
          [rawAccountId, accountKey, body.dashboardAccountLabel],
          safeText(body.clientRequestId),
        );
        const nextMappings = await getMappings(auth.licenseHash, platform, accountId);
        const mappedSources = mappedSourcesForAccount(nextMappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
        const limit = await getMarketingLimitInfo(auth.licenseHash, accountId, platform, mappedSources.length);
        return json(publicConnection(accountConnection, {
          status: mappedSources.length ? "connected" : "disconnected",
          mappedAccounts: mappedSources,
          linkedAccounts: mappedSources,
          linkedAccountCount: mappedSources.length,
          availableAccounts: [],
          claimableAccounts: [],
          diagnostics: {
            claimedSourceAccountId: sourceAccountId,
            claimProviderKeyId: claimProviderKey.id || "legacy",
            claimProviderChanged: claimLookup.changed,
            knownSourceAccountCount: (await getKnownSourceAccounts(auth.licenseHash, platform)).length,
          },
          limit,
        }, nextMappings, platform));
      }
      const knownAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
      return json(publicConnection(allAccountConnection, {
        status: Object.keys(mappings).some((key) => Array.isArray(mappings[key]) && mappings[key].length) ? "connected" : "disconnected",
        mappedAccounts: [],
        availableAccounts: knownAccounts,
        linkedAccounts: knownAccounts,
        linkedAccountCount: knownAccounts.length,
        claimableAccounts: [],
        diagnostics: {
          claimedSourceAccountId: sourceAccountId,
          claimProviderKeyId: claimProviderKey.id || "legacy",
          claimProviderChanged: claimLookup.changed,
          knownSourceAccountCount: knownAccounts.length,
        },
      }, mappings, platform));
    }

    if (body.action === "release_source_account") {
      const sourceAccountId = safeText(body.sourceAccountId);
      if (!sourceAccountId) return json({ ok: false, error: "SOURCE_ACCOUNT_ID_REQUIRED" }, 400);
      if (accountId === "__all__") return json({ ok: false, error: "SELECT_ACCOUNT_TO_RELEASE" }, 400);
      const released = await releaseSourceAccount(
        auth.licenseHash,
        accountId,
        platform,
        sourceAccountId,
        [rawAccountId, accountKey, body.dashboardAccountLabel],
        providerKey,
        safeText(body.clientRequestId),
      );
      const nextMappings = await getMappings(auth.licenseHash, platform, accountId);
      const mappedSources = mappedSourcesForAccount(nextMappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
      const limit = await getMarketingLimitInfo(auth.licenseHash, accountId, platform, mappedSources.length);
      return json(publicConnection(accountConnection, {
        status: mappedSources.length ? "connected" : "disconnected",
        mappedAccounts: mappedSources,
        linkedAccounts: mappedSources,
        linkedAccountCount: mappedSources.length,
        availableAccounts: [],
        claimableAccounts: [],
        sourceAccountId: "",
        sourceAccountName: "",
        lastSyncAt: null,
        summary: null,
        diagnostics: {
          releasedSourceAccountId: released.releasedSourceAccountId,
          releasedOwnerAccountId: released.ownerId,
          releaseProviderKeyId: released.providerKeyId,
          knownSourceAccountCount: (await getKnownSourceAccounts(auth.licenseHash, platform)).length,
        },
        limit,
      }, nextMappings, platform));
    }

    if (body.action === "save_mapping") {
      const mappingStartedAt = Date.now();
      if (accountId === "__all__") return json({ ok: false, error: "SELECT_ACCOUNT_TO_MAP" }, 400);
      const availableAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
      if (!availableAccounts.length) return json({ ok: false, error: "MARKETING_NOT_CONNECTED" }, 409);
      const selectedSources = Array.isArray(body.sourceAccounts)
        ? body.sourceAccounts
        : (Array.isArray(body.sourceAccountIds) ? body.sourceAccountIds.map((id) => ({ id })) : []);
      const saved = await saveMapping(
        auth.licenseHash,
        accountId,
        platform,
        selectedSources,
        availableAccounts,
        providerKey,
        [rawAccountId, accountKey, body.dashboardAccountLabel],
        safeText(body.clientRequestId),
      );
      debug("mapping:saved", { dashboardAccountId: accountId, sourceAccountCount: saved.count });
      const nextMappings = await getMappings(auth.licenseHash, platform, accountId);
      const mappedSources = mappedSourcesForAccount(nextMappings, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
      if (connection && connection.connect_snapshot) {
        await upsertConnection({
          license_key_hash: auth.licenseHash,
          dashboard_account_id: connection.dashboard_account_id,
          ...providerKeyFields(providerKey),
          platform,
          status: mappedSources.length ? "connected" : "disconnected",
          connect_snapshot: null,
          updated_at: new Date().toISOString(),
        });
      }
      return json(publicConnection(accountConnection, {
        status: mappedSources.length ? "connected" : "disconnected",
        mappedAccounts: mappedSources,
        availableAccounts: [],
        linkedAccounts: mappedSources,
        linkedAccountCount: mappedSources.length,
        claimableAccounts: [],
        limit: saved.limit,
        cache: { status: "mapping", unchanged: saved.unchanged, providerRequestCount: 0 },
        diagnostics: {
          providerRequestCount: 0,
          timings: {
            mappingMs: Date.now() - mappingStartedAt,
          },
        },
      }, nextMappings, platform));
    }

    if (body.action === "save_mappings") {
      const mappingStartedAt = Date.now();
      if (accountId !== "__all__") return json({ ok: false, error: "SELECT_ALL_ACCOUNTS_TO_MAP" }, 400);
      const availableAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
      if (!availableAccounts.length) return json({ ok: false, error: "MARKETING_NOT_CONNECTED" }, 409);
      const saved = await saveMappings(auth.licenseHash, platform, Array.isArray(body.mappings) ? body.mappings : [], availableAccounts, providerKey, safeText(body.clientRequestId));
      debug("mapping:all_saved", { sourceAccountCount: saved.count });
      if (connection && connection.connect_snapshot) {
        await upsertConnection({
          license_key_hash: auth.licenseHash,
          dashboard_account_id: connection.dashboard_account_id,
          ...providerKeyFields(providerKey),
          platform,
          status: saved.count ? "connected" : "disconnected",
          connect_snapshot: null,
          updated_at: new Date().toISOString(),
        });
      }
      const nextMappings = await getMappings(auth.licenseHash, platform);
      return json(publicConnection(connection, {
        status: saved.count ? "connected" : "disconnected",
        mappedAccounts: [],
        availableAccounts: [],
        linkedAccounts: [],
        linkedAccountCount: 0,
        claimableAccounts: [],
        limits: saved.limits,
        cache: { status: "mapping", unchanged: saved.unchanged, providerRequestCount: 0 },
        diagnostics: {
          providerRequestCount: 0,
          timings: {
            mappingMs: Date.now() - mappingStartedAt,
          },
        },
      }, nextMappings, platform));
    }

    if (body.action !== "sync" && body.action !== "sync_all") return json({ ok: false, error: "ACTION_NOT_SUPPORTED" }, 400);
    if (body.action === "sync" && accountId !== "__all__" && Array.isArray(body.sourceAccounts) && body.sourceAccounts.length) {
      const availableAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
      await saveMapping(
        auth.licenseHash,
        accountId,
        platform,
        body.sourceAccounts,
        availableAccounts,
        providerKey,
        [rawAccountId, accountKey, body.dashboardAccountLabel],
        safeText(body.clientRequestId),
      );
      debug("sync:mapping_refreshed", { dashboardAccountId: accountId, sourceAccountCount: body.sourceAccounts.length });
    }
    if (body.action === "sync_all" && accountId === "__all__" && Array.isArray(body.mappings) && body.mappings.length) {
      const availableAccounts = await getKnownSourceAccounts(auth.licenseHash, platform);
      const saved = await saveMappings(auth.licenseHash, platform, body.mappings, availableAccounts, providerKey, safeText(body.clientRequestId));
      debug("sync_all:mappings_refreshed", { sourceAccountCount: saved.count });
    }
    const mapping = await getMappings(auth.licenseHash, platform, body.action === "sync" && accountId !== "__all__" ? accountId : "");
    if (body.action === "sync") {
      if (accountId === "__all__") return json({ ok: false, error: "SELECT_SINGLE_ACCOUNT_TO_SYNC" }, 400);
      const mappedForAccount = mappedSourcesForAccount(mapping, [accountId, rawAccountId, accountKey, body.dashboardAccountLabel]);
      if (!mappedForAccount.length) return json({ ok: false, error: "MAP_MARKETING_ACCOUNT_FIRST" }, 409);
      const status = body.mode === "incremental" || body.mode === "full"
        ? { status: "connected", linkedAccounts: mappedForAccount, mappedAccounts: mappedForAccount }
        : await checkConnectionStatus(connection, platform, providerKey.apiKey);
      return json(await syncDashboardAccountAcrossProviders(
        auth.licenseHash,
        accountId,
        platform,
        connection,
        { ...status, status: "connected", linkedAccounts: mappedForAccount, mappedAccounts: mappedForAccount },
        mapping,
        body,
        body.targetCurrency,
        body.egpRate,
        [rawAccountId, accountKey, body.dashboardAccountLabel],
        providerKey.apiKey,
        providerKey,
      ));
    }

    if (accountId !== "__all__") return json({ ok: false, error: "SELECT_ALL_ACCOUNTS_TO_SYNC" }, 400);
    const requestedSettings = Array.isArray(body.accountSettings) ? body.accountSettings : [];
    const results: Record<string, unknown> = {};
    const scheduledSourceAccountIds = new Set<string>();
    const syncResults = await pLimit(3, requestedSettings, async (setting) => {
      const requestedDashboardAccountId = safeText(setting && setting.dashboardAccountId);
      const dashboardAccountKey = stableAccountKey(setting && setting.dashboardAccountKey);
      const dashboardAccountKeys = Array.isArray(setting && setting.dashboardAccountKeys)
        ? setting.dashboardAccountKeys.map((key) => stableAccountKey(key)).filter(Boolean)
        : [];
      const storedDashboardAccountId = dashboardAccountKey || requestedDashboardAccountId;
      const lookupKeys = Array.from(new Set([requestedDashboardAccountId, dashboardAccountKey, ...dashboardAccountKeys].filter(Boolean)));
      const mappedSources = mappedSourcesForAccount(mapping, lookupKeys).filter((source) => {
        if (scheduledSourceAccountIds.has(source.id)) return false;
        scheduledSourceAccountIds.add(source.id);
        return true;
      });
      if (!requestedDashboardAccountId || !storedDashboardAccountId || !mappedSources.length) return null;
      const accountConnectionForProvider = await getConnection(auth.licenseHash, storedDashboardAccountId, platform);
      const accountProviderKey = await resolveProviderKey(auth.licenseHash, storedDashboardAccountId, {
        connection: accountConnectionForProvider || null,
      });
      if (!mappedSources.length) return null;
      const accountStatus = body.mode === "incremental" || body.mode === "full"
        ? { status: "connected", linkedAccounts: mappedSources, mappedAccounts: mappedSources }
        : await checkConnectionStatus(accountConnectionForProvider || null, platform, accountProviderKey.apiKey);
      
      const data = await syncDashboardAccountAcrossProviders(
        auth.licenseHash,
        storedDashboardAccountId,
        platform,
        accountConnectionForProvider || connection,
        { ...accountStatus, status: "connected", linkedAccounts: mappedSources, mappedAccounts: mappedSources },
        mapping,
        { ...body, exchangeRates: setting.exchangeRates || body.exchangeRates },
        safeCurrency(setting.currency) || "USD",
        setting.egpRate,
        lookupKeys,
        accountProviderKey.apiKey,
        accountProviderKey,
      );
      if (data && data.summary && Array.isArray(data.summary.campaignBreakdown)) {
        data.summary.campaignBreakdown = data.summary.campaignBreakdown.map((row: any) => ({
          ...row,
          dashboardAccountId: requestedDashboardAccountId,
        }));
      }
      return { id: requestedDashboardAccountId, data };
    });

    for (const res of syncResults) {
      if (res) {
        results[res.id] = res.data;
      }
    }
    const accountResults = Object.values(results) as any[];
    const limits: Record<string, unknown> = {};
    Object.keys(results).forEach((id) => {
      const limit = (results[id] as any) && (results[id] as any).limit;
      if (limit) limits[id] = limit;
    });
    const linkedAccountsById = new Map<string, any>();
    accountResults.forEach((result: any) => {
      (Array.isArray(result && result.linkedAccounts) ? result.linkedAccounts : []).forEach((account: any) => {
        const id = safeText(account && account.id);
        if (id && !linkedAccountsById.has(id)) linkedAccountsById.set(id, account);
      });
    });
    const allLinkedAccounts = Array.from(linkedAccountsById.values());
    const allTargetCurrency = safeCurrency(body.targetCurrency) || "USD";
    const allExchangeRates = normalizeExchangeRates(body.exchangeRates, body.egpRate);
    const allSummary = accountResults.reduce((summary: any, result: any) => {
      const source = result && result.summary || {};
      summary.impressions += Number(source.impressions || 0);
      summary.clicks += Number(source.clicks || 0);
      summary.purchases += Number(source.purchases || 0);
      summary.campaignCount += Number(source.campaignCount || 0);
      summary.rowCount += Number(source.rowCount || 0);
      if (!summary.purchaseMetric && source.purchaseMetric) summary.purchaseMetric = source.purchaseMetric;
      summary.purchaseMetricAvailable = summary.purchaseMetricAvailable || source.purchaseMetricAvailable === true;
      summary.sourceBreakdown = summary.sourceBreakdown.concat(Array.isArray(source.sourceBreakdown) ? source.sourceBreakdown : []);
      summary.dailyPlatformBreakdown = summary.dailyPlatformBreakdown.concat(
        (Array.isArray(source.dailyPlatformBreakdown) ? source.dailyPlatformBreakdown : []).map((row: any) => ({
          ...row,
          spend: Number(convertSpend(Number(row && row.spend || 0), safeCurrency(source.currency) || "USD", allTargetCurrency, Number(source.egpRate || 52) || 52, source.exchangeRates || allExchangeRates).toFixed(2)),
        }))
      );
      summary.campaignBreakdown = summary.campaignBreakdown.concat(Array.isArray(source.campaignBreakdown) ? source.campaignBreakdown : []);
      return summary;
    }, {
      adSpend: 0,
      currency: allTargetCurrency,
      exchangeRates: allExchangeRates,
      egpRate: allExchangeRates.EGP,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      purchaseMetric: "",
      purchaseMetricAvailable: false,
      campaignCount: 0,
      rowCount: 0,
      dateFrom: body.dateFrom || "",
      dateTo: body.dateTo || "",
      sourceBreakdown: [],
      dailyPlatformBreakdown: [],
      campaignBreakdown: [],
    });
    allSummary.adSpend = accountResults.reduce((total: number, result: any) => {
      const source = result && result.summary || {};
      return total + convertSpend(Number(source.adSpend || 0), safeCurrency(source.currency) || "USD", allTargetCurrency, Number(source.egpRate || 52) || 52, source.exchangeRates || allExchangeRates);
    }, 0);
    allSummary.adSpend = Number(allSummary.adSpend.toFixed(2));
    allSummary.purchases = Number(allSummary.purchases.toFixed(2));
    const allCache = accountResults.reduce((cache: any, result: any) => {
      const source = result && result.cache || {};
      cache.reusedDays += Number(source.reusedDays || 0);
      cache.refreshedDays += Number(source.refreshedDays || 0);
      cache.providerRequestCount += Number(source.providerRequestCount || 0);
      cache.stale = cache.stale || !!source.stale || !!(result && result.stale);
      cache.fetchedRanges = cache.fetchedRanges.concat(Array.isArray(source.fetchedRanges) ? source.fetchedRanges : []);
      cache.reportFetchMs += Number(source.reportFetchMs || 0);
      cache.cacheReadMs += Number(source.cacheReadMs || 0);
      cache.cacheWriteMs += Number(source.cacheWriteMs || 0);
      cache.totalSyncMs += Number(source.totalSyncMs || 0);
      return cache;
    }, {
      mode: body.mode === "incremental" ? "incremental" : "full",
      reusedDays: 0,
      refreshedDays: 0,
      providerRequestCount: 0,
      stale: false,
      fetchedRanges: [],
      reportFetchMs: 0,
      cacheReadMs: 0,
      cacheWriteMs: 0,
      totalSyncMs: 0,
    });
    const allSyncAt = new Date().toISOString();
    await upsertConnection({
      license_key_hash: auth.licenseHash,
      dashboard_account_id: "__all__",
      ...providerKeyFields(providerKey),
      platform,
      status: "connected",
      windsor_access_token: connection && connection.windsor_access_token || null,
      source_account_id: null,
      source_account_name: `${accountResults.length} synced KHOD accounts`,
      last_sync_at: allSyncAt,
      last_summary: allSummary,
      updated_at: allSyncAt,
    });
    debug("sync:all_finished", { dashboardAccountCount: Object.keys(results).length });
    return json({
      ok: true,
      platform,
      status: "connected",
      linkedAccounts: allLinkedAccounts,
      linkedAccountCount: allLinkedAccounts.length,
      mappings: mapping,
      limits,
      accountStatuses: results,
      syncedAccountCount: Object.keys(results).length,
      lastSyncAt: allSyncAt,
      summary: allSummary,
      cache: allCache,
      stale: allCache.stale,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debug("request:error", { error: message });
    if (error instanceof MarketingLimitError) {
      return json({
        ok: false,
        error: "MARKETING_ACCOUNT_LIMIT_EXCEEDED",
        platform: error.platform,
        dashboardAccountId: error.accountId,
        max: error.max,
        selected: error.selected,
        limit: limitPayload(error.platform, error.max, error.selected),
      }, 409);
    }
    if (error instanceof WindsorApiError) {
      const reconnectRequired = error.reconnectRequired;
      return json({
        ok: false,
        error: reconnectRequired ? "WINDSOR_RECONNECT_REQUIRED" : "WINDSOR_AUTH_FAILED",
        message,
        status: "disconnected",
        reconnectRequired,
        diagnostics: {
          windsorStatus: error.status,
          windsorCode: error.code,
          windsorMessage: message,
        },
      });
    }
    if ([
      "SOURCE_ACCOUNT_ID_REQUIRED",
      "SELECT_ACCOUNT_TO_RELEASE",
      "SOURCE_ACCOUNT_NOT_ASSIGNED",
      "SOURCE_ACCOUNT_ASSIGNED_ELSEWHERE",
    ].includes(message)) {
      const status = message === "SOURCE_ACCOUNT_ID_REQUIRED" || message === "SELECT_ACCOUNT_TO_RELEASE"
        ? 400
        : (message === "SOURCE_ACCOUNT_NOT_ASSIGNED" ? 404 : 409);
      return json({ ok: false, error: message }, status);
    }
    return json({ ok: false, error: message }, 500);
  }
});
