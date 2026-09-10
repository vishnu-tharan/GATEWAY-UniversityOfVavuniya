const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeDate } = require("../scripts/migrate");
test("migration converts explicit legacy locale and offset without silently guessing", () => {
  delete process.env.LEGACY_DATE_ORDER;
  delete process.env.LEGACY_UTC_OFFSET;
  assert.throws(() => normalizeDate("1/2/2026, 1:00:00 PM"));
  process.env.LEGACY_DATE_ORDER = "DMY";
  process.env.LEGACY_UTC_OFFSET = "+05:30";
  assert.equal(
    normalizeDate("1/2/2026, 1:00:00 PM"),
    "2026-02-01T07:30:00.000Z",
  );
  assert.throws(() => normalizeDate("31/2/2026, 1:00:00 PM"));
  assert.equal(
    normalizeDate("2026-02-01T07:30:00.000Z"),
    "2026-02-01T07:30:00.000Z",
  );
});
