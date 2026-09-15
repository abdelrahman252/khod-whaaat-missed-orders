"use strict";

const assert = require("assert");
const {
  formatPhone,
  normalizePhoneWithMeta,
  normalizePhoneCandidatesWithMeta,
} = require("../src/bot/phone");

const cases = [
  ["sa", "530817719966", "966530817719"],
  ["eg", "101234567820", "201012345678"],
  ["iq", "7701234567964", "9647701234567"],
  ["ae", "501234567971", "971501234567"],
  ["om", "91234567968", "96891234567"],
];

for (const [country, input, expected] of cases) {
  const meta = normalizePhoneWithMeta(input, country);
  assert(meta, `${country}: trailing calling code should be recognized`);
  assert.strictEqual(meta.correction, "trailing_country_code", `${country}: correction should be recorded`);
  assert.strictEqual(formatPhone(input, country), expected, `${country}: should move calling code to the front`);
  assert.strictEqual(normalizePhoneCandidatesWithMeta(input, country).length, 1, `${country}: should not create false alternatives`);
}

assert.strictEqual(formatPhone("00966530817719", "sa"), "966530817719", "normal Saudi international format stays supported");
assert.strictEqual(formatPhone("0530817719", "sa"), "966530817719", "normal Saudi local format stays supported");
assert.strictEqual(formatPhone("123446789966", "sa"), null, "invalid remainder must not be accepted just because it ends in 966");
assert.strictEqual(formatPhone("530817719966", "zz"), null, "unsupported countries remain rejected");

console.log(`Phone suffix verification: ${cases.length + 4} passed.`);
