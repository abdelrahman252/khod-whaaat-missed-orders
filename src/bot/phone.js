"use strict";

function toWesternDigits(value) {
  return value
    .toString()
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString());
}

function _normalizeCore(phone) {
  if (!phone) return null;

  let digits = toWesternDigits(phone).replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length === 10 && digits.endsWith("0")) {
    digits = digits.slice(0, 9);
  }

  if (digits.startsWith("5") && digits.length === 9) {
    return { digits, uncertain: false };
  }

  if (digits.startsWith("5") && digits.length === 8) {
    return { digits: digits + "0", uncertain: true };
  }

  let raw = toWesternDigits(phone).replace(/\D/g, "");
  if (raw.startsWith("00")) raw = raw.slice(2);

  for (let i = raw.length - 9; i >= 0; i--) {
    if (raw[i] === "5") {
      return { digits: raw.slice(i, i + 9), uncertain: false };
    }
  }

  for (let i = raw.length - 8; i >= 0; i--) {
    if (raw[i] === "5") {
      return { digits: raw.slice(i, i + 8) + "0", uncertain: true };
    }
  }

  return null;
}

function normalizePhone(phone) {
  const result = _normalizeCore(phone);
  return result ? result.digits : null;
}

function normalizePhoneWithMeta(phone) {
  return _normalizeCore(phone);
}

function formatPhone966(phone) {
  const core = normalizePhone(phone);
  return core ? "966" + core : null;
}

module.exports = { normalizePhone, normalizePhoneWithMeta, formatPhone966 };
