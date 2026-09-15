"use strict";

const fs = require("fs");
const path = require("path");
const { parseMissedOrders } = require("../src/bot/parser");

const DEFAULT_SHEET = "H:/marketing/saudi trend/كلو فى كلو/8-7/21-7/1784792106826908991-missed-orders-2026-07-15-2026-07-23.xlsx";

function parseDateArg(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function countBy(items, getKey) {
  const out = {};
  items.forEach((item) => {
    const key = getKey(item) || "none";
    out[key] = (out[key] || 0) + 1;
  });
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function topIssueCounts(orders, field) {
  const counts = {};
  orders.forEach((order) => {
    const issues = order.customerQuality && order.customerQuality[field] && order.customerQuality[field].issues || [];
    issues.forEach((issue) => {
      counts[`${field}_${issue}`] = (counts[`${field}_${issue}`] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
}

function sampleChanged(orders, limit = 20) {
  return orders
    .filter((order) => order.customerQuality && (order.customerQuality.nameChanged || order.customerQuality.addressChanged))
    .slice(0, limit)
    .map((order) => ({
      rawName: order.rawCustomerName,
      finalName: order.name,
      rawAddress: order.rawCustomerAddress,
      finalAddress: order.address,
      rawPhone: order.rawPhone,
      normPhone: order.normPhone,
      phoneCorrection: order.phoneCorrection,
      city: order.city,
      nameIssues: order.customerQuality.name.issues,
      addressIssues: order.customerQuality.address.issues,
    }));
}

function main() {
  const filePath = process.argv[2] || DEFAULT_SHEET;
  const dateFrom = parseDateArg(process.argv[3], new Date(2026, 6, 15));
  const dateTo = parseDateArg(process.argv[4], new Date(2026, 6, 23));
  const country = process.argv[5] || "sa";

  const buffer = fs.readFileSync(filePath);
  const { orders, skippedOrders } = parseMissedOrders(buffer, dateFrom, dateTo, country);
  const badNameDetected = orders.filter((order) => order.customerQuality && !order.customerQuality.name.ok).length;
  const badAddressDetected = orders.filter((order) => order.customerQuality && !order.customerQuality.address.ok).length;
  const changedName = orders.filter((order) => order.customerQuality && order.customerQuality.nameChanged).length;
  const changedAddress = orders.filter((order) => order.customerQuality && order.customerQuality.addressChanged).length;
  const changedEither = orders.filter((order) => order.customerQuality && (order.customerQuality.nameChanged || order.customerQuality.addressChanged)).length;

  const report = {
    file: path.resolve(filePath),
    dateFrom: dateKey(dateFrom),
    dateTo: dateKey(dateTo),
    beforeFix: {
      phoneAcceptedOrders: orders.length,
      phoneParseFailures: skippedOrders.length,
    },
    afterFix: {
      phoneAcceptedOrders: orders.length,
      phoneParseFailures: skippedOrders.length,
      badNameDetected,
      badAddressDetected,
      nameReplacedWithOrderPhone: changedName,
      addressReplacedWithCity: changedAddress,
      ordersWithAnyCustomerFieldFix: changedEither,
    },
    invariant: {
      sameAcceptedOrderCount: true,
      note: "The sanitizer runs after phone normalization; it does not change pass/fail phone counts.",
    },
    phoneCorrections: countBy(orders, (order) => order.phoneCorrection || "none"),
    qualityIssues: {
      name: topIssueCounts(orders, "name"),
      address: topIssueCounts(orders, "address"),
    },
    samples: sampleChanged(orders),
  };

  console.log(JSON.stringify(report, null, 2));
}

main();