"use strict";

function localDay(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return null;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function formatDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function validateCurrentYearDashboardRange(dateFrom, dateTo, options = {}) {
  const from = parseDateKey(dateFrom);
  const to = parseDateKey(dateTo);
  if (!from || !to) {
    return {
      ok: false,
      error: "Select a valid dashboard date range in YYYY-MM-DD format.",
    };
  }

  const today = localDay(options.today || new Date());
  if (!today) {
    return { ok: false, error: "The current dashboard date is unavailable." };
  }
  const min = new Date(today.getFullYear(), 0, 1);

  if (from < min || to < min) {
    return {
      ok: false,
      error: `Dashboard dates must be on or after ${formatDateKey(min)}.`,
    };
  }
  if (from > today || to > today) {
    return {
      ok: false,
      error: `Dashboard dates cannot be after ${formatDateKey(today)}.`,
    };
  }
  if (from > to) {
    return {
      ok: false,
      error: "Dashboard start date cannot be after the end date.",
    };
  }

  return {
    ok: true,
    dateFrom: formatDateKey(from),
    dateTo: formatDateKey(to),
  };
}

module.exports = {
  formatDateKey,
  parseDateKey,
  validateCurrentYearDashboardRange,
};
