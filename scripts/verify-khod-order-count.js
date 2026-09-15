"use strict";

const assert = require("assert");
const XLSX = require("xlsx");
const { parseKhodOrderCount } = require("../src/bot/parser");

const header = new Array(18).fill("");
header[1] = "رقم الطلب";
header[3] = "الهاتف";
header[17] = "SKU";

const rows = [
  header,
  ["", "KHOD-100", "", "0500000001", ...new Array(13).fill(""), "SKU-A"],
  ["", "KHOD-100", "", "0500000001", ...new Array(13).fill(""), "SKU-B"],
  ["", "KHOD-101", "", "0500000002", ...new Array(13).fill(""), "SKU-A"],
  ["", "", "", "0500000003", ...new Array(13).fill(""), "SKU-C"],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Orders");
const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

assert.strictEqual(
  parseKhodOrderCount(buffer),
  2,
  "The KHOD WHAAT metric must count distinct order numbers, not SKU rows"
);

console.log("KHOD WHAAT distinct order count verification passed.");
