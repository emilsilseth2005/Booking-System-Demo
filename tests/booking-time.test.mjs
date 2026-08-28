import assert from "node:assert/strict";
import test from "node:test";
import { isBookingTimePast, osloDateKey } from "../lib/booking-time.js";

test("avviser passerte og pågående tidspunkt i Oslo", () => {
  const now = new Date("2026-08-28T08:15:00Z");
  assert.equal(isBookingTimePast("2026-08-28", "10:15", now), true);
  assert.equal(isBookingTimePast("2026-08-28", "11:30", now), false);
});

test("behandler vinter- og sommertid med samme lokale format", () => {
  assert.equal(isBookingTimePast("2026-01-15", "10:15", new Date("2026-01-15T09:15:00Z")), true);
  assert.equal(isBookingTimePast("2026-07-15", "10:15", new Date("2026-07-15T08:14:00Z")), false);
});

test("avviser ugyldige dato- og tidsformater", () => {
  assert.equal(isBookingTimePast("28.08.2026", "10:15"), true);
  assert.equal(isBookingTimePast("2026-08-28", "10.15"), true);
});

test("finner kalenderdatoen i Oslo rundt UTC-midnatt", () => {
  assert.equal(osloDateKey(new Date("2026-01-01T00:30:00+01:00")), "2026-01-01");
  assert.equal(osloDateKey(new Date("2026-07-01T00:30:00+02:00")), "2026-07-01");
});
