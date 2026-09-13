"use strict";

const PHONE_RULES = Object.freeze({
  sa: { dialCode: "966", nationalPattern: /^5\d{8}$/ },
  eg: { dialCode: "20", nationalPattern: /^1(?:0|1|2|5)\d{8}$/ },
  iq: { dialCode: "964", nationalPattern: /^7\d{9}$/ },
  ae: { dialCode: "971", nationalPattern: /^5\d{8}$/ },
  om: { dialCode: "968", nationalPattern: /^[79]\d{7}$/ },
});

function countryKey(country) {
  return String(country || "sa").trim().toLowerCase();
}

function toWesternDigits(value) {
  return String(value)
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0));
}

function phoneDigits(phone) {
  let digits = toWesternDigits(phone == null ? "" : phone).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function withoutDomesticZero(digits) {
  return digits.startsWith("0") ? digits.slice(1) : digits;
}

function validNational(digits, rule) {
  return rule.nationalPattern.test(digits);
}

function structuredCandidate(raw, rule) {
  const prefixed = raw.startsWith(rule.dialCode) ? withoutDomesticZero(raw.slice(rule.dialCode.length)) : "";
  if (prefixed && validNational(prefixed, rule)) {
    return { digits: prefixed, uncertain: false, correction: "leading_country_code" };
  }

  const national = withoutDomesticZero(raw);
  if (validNational(national, rule)) {
    return { digits: national, uncertain: false, correction: "national" };
  }

  // Some exports/users append the calling code (for example 530817719966).
  // Only strip it when the remainder is a complete valid national number; this
  // prevents a legitimate ending from being mistaken for a country code.
  const suffixed = raw.endsWith(rule.dialCode)
    ? withoutDomesticZero(raw.slice(0, -rule.dialCode.length))
    : "";
  if (suffixed && validNational(suffixed, rule)) {
    return { digits: suffixed, uncertain: false, correction: "trailing_country_code" };
  }

  return null;
}

function _normalizeCore(phone, country = "sa") {
  if (phone == null || phone === "") return null;
  const key = countryKey(country);
  const rule = PHONE_RULES[key];
  if (!rule) return null;

  const raw = phoneDigits(phone);
  if (!raw) return null;
  const exact = structuredCandidate(raw, rule);
  if (exact) return exact;

  // Keep the established Saudi rescue behavior for malformed legacy exports.
  if (key !== "sa") return null;
  let digits = raw.startsWith(rule.dialCode) ? raw.slice(rule.dialCode.length) : raw;
  digits = withoutDomesticZero(digits);

  if (digits.length === 10 && digits.endsWith("0")) {
    digits = digits.slice(0, 9);
  }
  if (validNational(digits, rule)) return { digits, uncertain: false, correction: "legacy" };
  if (digits.startsWith("5") && digits.length === 8) {
    return { digits: digits + "0", uncertain: true, correction: "trailing_zero_rescue" };
  }

  for (let i = raw.length - 9; i >= 0; i--) {
    const candidate = raw.slice(i, i + 9);
    if (validNational(candidate, rule)) return { digits: candidate, uncertain: false, correction: "legacy_window" };
  }
  for (let i = raw.length - 8; i >= 0; i--) {
    const candidate = raw.slice(i, i + 8);
    if (candidate.startsWith("5")) {
      return { digits: candidate + "0", uncertain: true, correction: "trailing_zero_rescue" };
    }
  }
  return null;
}

function normalizePhone(phone, country = "sa") {
  const result = _normalizeCore(phone, country);
  return result ? result.digits : null;
}

function normalizePhoneWithMeta(phone, country = "sa") {
  return _normalizeCore(phone, country);
}

function normalizePhoneCandidatesWithMeta(phone, country = "sa") {
  const key = countryKey(country);
  const legacy = _normalizeCore(phone, key);
  if (!legacy) return [];
  if (key !== "sa" || legacy.correction === "trailing_country_code") return [legacy];

  let raw = phoneDigits(phone);
  const rule = PHONE_RULES.sa;
  if (raw.startsWith(rule.dialCode)) raw = raw.slice(rule.dialCode.length);
  raw = withoutDomesticZero(raw);

  const excess = raw.length - 9;
  const candidates = [];
  const seen = new Set();
  const add = (digits, correction, uncertain = false) => {
    if (!validNational(digits, rule) || seen.has(digits)) return;
    seen.add(digits);
    candidates.push({ digits, uncertain, correction });
  };

  if ((excess === 1 || excess === 2) && raw[1] === "0") {
    const withoutMisplacedZero = raw[0] + raw.slice(2);
    add(withoutMisplacedZero.slice(0, 9), "misplaced_domestic_zero");
    add(raw.slice(0, 9), "trailing_extra_digits");
    if (candidates.length) return candidates;
  }
  if (excess === 1 || excess === 2) {
    for (let i = 0; i <= excess; i++) add(raw.slice(i, i + 9), "valid_sliding_window");
    if (candidates.length) return candidates;
  }
  return [legacy];
}

function formatPhone(phone, country = "sa") {
  const key = countryKey(country);
  const rule = PHONE_RULES[key];
  const national = normalizePhone(phone, key);
  return rule && national ? rule.dialCode + national : null;
}

function formatPhone966(phone) {
  return formatPhone(phone, "sa");
}

module.exports = {
  PHONE_RULES,
  normalizePhone,
  normalizePhoneWithMeta,
  normalizePhoneCandidatesWithMeta,
  formatPhone,
  formatPhone966,
};
