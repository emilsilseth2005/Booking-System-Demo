import assert from "node:assert/strict";
import test from "node:test";
import { createBookingEmails, parseBookingRequest } from "../lib/booking-email.ts";

const validPayload = {
  bookingId: "4c35422f-8d62-4f88-8673-90b5cb0b568d",
  serviceId: "klipp",
  staffId: "nora",
  date: "2026-08-28",
  time: "10:15",
  customer: {
    name: "Ola Nordmann",
    email: "OLA@example.no",
    phone: "+47 999 99 999",
    note: "Kort på sidene",
  },
  website: "",
};

test("validerer og normaliserer en booking", () => {
  const booking = parseBookingRequest(validPayload, new Date("2026-08-27T10:00:00Z"));
  assert.ok(booking);
  assert.equal(booking.customer.email, "ola@example.no");
  assert.equal(booking.service.price, 790);
  assert.equal(booking.staff.name, "Nora");
});

test("avviser ukjente tjenester, gamle datoer og honeypot-felt", () => {
  assert.equal(parseBookingRequest({ ...validPayload, serviceId: "dyr-tjeneste" }, new Date("2026-08-27T10:00:00Z")), null);
  assert.equal(parseBookingRequest({ ...validPayload, date: "2026-08-26" }, new Date("2026-08-27T10:00:00Z")), null);
  assert.equal(parseBookingRequest({ ...validPayload, website: "spam.example" }, new Date("2026-08-27T10:00:00Z")), null);
});

test("e-postmalen HTML-escaper kundedata", () => {
  const booking = parseBookingRequest({
    ...validPayload,
    customer: { ...validPayload.customer, name: "<script>alert(1)</script>" },
  }, new Date("2026-08-27T10:00:00Z"));
  assert.ok(booking);

  const emails = createBookingEmails(booking);
  assert.doesNotMatch(emails.business.html, /<script>/);
  assert.match(emails.business.html, /&lt;script&gt;/);
  assert.match(emails.customer.text, /demonstrasjon/i);
});
