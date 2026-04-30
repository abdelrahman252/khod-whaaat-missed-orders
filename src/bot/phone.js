"use strict";

/**
 * Normalize a Saudi phone number to 9-digit core (5XXXXXXXX)
 * Uses duk.js logic (correct slice(2) for 00-prefix)
 * Returns null if invalid
 */
function normalizePhone(phone) {
  if (!phone) return null;

  let digits = phone
    .toString()
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

  digits = digits.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("966")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);

  // Strip trailing 0 if crept in (5XXXXXXXX0 → 10 digits)
  if (digits.length === 10 && digits.endsWith("0")) digits = digits.slice(0, 9);

  if (!digits.startsWith("5")) return null;
  if (digits.length !== 9) return null;

  return digits;
}

/**
 * Format to 966XXXXXXXXX for output
 */
function formatPhone966(phone) {
  const core = normalizePhone(phone);
  return core ? "966" + core : null;
}

module.exports = { normalizePhone, formatPhone966 };
