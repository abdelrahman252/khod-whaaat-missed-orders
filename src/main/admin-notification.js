"use strict";

function normalizeAdminNotification(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = String(value.id || "").trim();
  const title = String(value.title || "").trim();
  const message = String(value.message || "").trim();
  const kind = ["info", "warn", "success"].includes(value.kind) ? value.kind : "info";
  if (!id || !title || !message) return null;
  return { id, title, message, kind, createdAt: value.created_at || value.createdAt || null };
}

async function fetchActiveAdminNotification(rpc, licenseKey, logger) {
  try {
    const value = await rpc("khod_get_active_admin_notification", { p_license_key: licenseKey });
    return normalizeAdminNotification(value);
  } catch (error) {
    if (logger && typeof logger.warn === "function") {
      logger.warn("[License] Admin notification fetch failed (non-fatal):", error && error.message ? error.message : error);
    }
    return null;
  }
}

module.exports = { fetchActiveAdminNotification, normalizeAdminNotification };
