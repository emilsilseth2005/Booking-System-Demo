import { isBookingTimePast } from "./booking-time.js";

export const serviceCatalog = {
  klipp: { name: "Dame- og herreklipp", duration: 60, price: 790 },
  styling: { name: "Vask og styling", duration: 45, price: 590 },
  skjegg: { name: "Skjegg og finish", duration: 30, price: 450 },
} as const;

export const staffCatalog = {
  any: { name: "Første ledige" },
  nora: { name: "Nora" },
  emil: { name: "Emil" },
} as const;

const availableTimes = new Set(["09:00", "10:15", "11:30", "13:00", "14:15", "15:30", "17:00"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+\d][\d\s().-]{5,31}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BookingRequest = {
  bookingId: string;
  serviceId: keyof typeof serviceCatalog;
  staffId: keyof typeof staffCatalog;
  date: string;
  time: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    note: string;
  };
};

export type BookingDetails = BookingRequest & {
  service: (typeof serviceCatalog)[keyof typeof serviceCatalog];
  staff: (typeof staffCatalog)[keyof typeof staffCatalog];
};

type EmailContent = {
  subject: string;
  html: string;
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.length > 0 && cleaned.length <= maxLength ? cleaned : null;
}

function isRealDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function osloDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysToDateKey(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseBookingRequest(value: unknown, now = new Date()): BookingDetails | null {
  if (!isRecord(value) || !isRecord(value.customer) || value.website) return null;

  const bookingId = cleanString(value.bookingId, 64);
  const serviceId = cleanString(value.serviceId, 24);
  const staffId = cleanString(value.staffId, 24);
  const date = cleanString(value.date, 10);
  const time = cleanString(value.time, 5);
  const name = cleanString(value.customer.name, 100);
  const email = cleanString(value.customer.email, 254)?.toLowerCase() ?? null;
  const phone = cleanString(value.customer.phone, 32);
  const rawNote = typeof value.customer.note === "string" ? value.customer.note.trim() : "";
  const note = rawNote.length <= 1000 ? rawNote : null;
  const today = osloDateKey(now);

  if (
    !bookingId || !uuidPattern.test(bookingId) ||
    !serviceId || !(serviceId in serviceCatalog) ||
    !staffId || !(staffId in staffCatalog) ||
    !date || !isRealDate(date) || date < today || date > addDaysToDateKey(today, 366) ||
    !time || !availableTimes.has(time) || isBookingTimePast(date, time, now) ||
    !name || !email || !emailPattern.test(email) ||
    !phone || !phonePattern.test(phone) || note === null
  ) {
    return null;
  }

  const typedServiceId = serviceId as keyof typeof serviceCatalog;
  const typedStaffId = staffId as keyof typeof staffCatalog;

  return {
    bookingId,
    serviceId: typedServiceId,
    staffId: typedStaffId,
    date,
    time,
    customer: { name, email, phone, note },
    service: serviceCatalog[typedServiceId],
    staff: staffCatalog[typedStaffId],
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatBookingDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Oslo",
  }).format(new Date(`${value}T12:00:00Z`));
}

function emailShell(preview: string, heading: string, intro: string, rows: Array<[string, string]>, footer: string) {
  const details = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 0;color:#5a6b78;font-size:14px;vertical-align:top">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#0f2940;font-size:14px;font-weight:700;text-align:right;vertical-align:top">${escapeHtml(value)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html lang="nb">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(preview)}</title></head>
  <body style="margin:0;background:#f7f5ea;font-family:Arial,sans-serif;color:#0f2940">
    <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>
    <div style="max-width:620px;margin:0 auto;padding:32px 18px">
      <div style="background:#fffdf0;border:1px solid #d9ded8;border-radius:24px;overflow:hidden">
        <div style="padding:24px 28px;background:#0f2940;color:#fff9d2">
          <strong style="font-size:18px">Studio Nord</strong>
          <div style="margin-top:4px;color:#bfddf0;font-size:13px">Booking System Demo</div>
        </div>
        <div style="padding:32px 28px">
          <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#ffebcc;font-size:12px;font-weight:700">Demonstrasjon</div>
          <h1 style="margin:20px 0 12px;font-size:30px;line-height:1.1">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 24px;color:#526473;font-size:16px;line-height:1.6">${escapeHtml(intro)}</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #d9ded8;border-bottom:1px solid #d9ded8">${details}</table>
          <p style="margin:24px 0 0;color:#526473;font-size:13px;line-height:1.6">${escapeHtml(footer)}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function createBookingEmails(booking: BookingDetails): { customer: EmailContent; business: EmailContent } {
  const dateAndTime = `${formatBookingDate(booking.date)} kl. ${booking.time}`;
  const commonRows: Array<[string, string]> = [
    ["Tjeneste", booking.service.name],
    ["Tidspunkt", dateAndTime],
    ["Behandler", booking.staff.name],
    ["Pris", `${booking.service.price} kr`],
  ];
  const customerText = [
    `Hei ${booking.customer.name},`,
    "",
    "Dette er bekreftelsen på demo-bookingen din hos Studio Nord.",
    ...commonRows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Dette er en demonstrasjon. Ingen betaling er gjennomført.",
  ].join("\n");
  const businessRows: Array<[string, string]> = [
    ...commonRows,
    ["Kunde", booking.customer.name],
    ["E-post", booking.customer.email],
    ["Telefon", booking.customer.phone],
    ["Kommentar", booking.customer.note || "Ingen kommentar"],
  ];
  const businessText = [
    "Ny demo-booking mottatt.",
    ...businessRows.map(([label, value]) => `${label}: ${value}`),
    "",
    `Referanse: ${booking.bookingId}`,
  ].join("\n");

  return {
    customer: {
      subject: `[Demo] Bekreftelse på booking ${booking.date} kl. ${booking.time}`,
      html: emailShell(
        "Bekreftelse på demo-bookingen din",
        `Hei ${booking.customer.name}, tiden er satt av.`,
        "Her er detaljene du sendte inn i bookingdemoen.",
        commonRows,
        "Dette er en demonstrasjon. Ingen betaling er gjennomført.",
      ),
      text: customerText,
    },
    business: {
      subject: `[Demo] Ny booking fra ${booking.customer.name}`,
      html: emailShell(
        "Ny demo-booking mottatt",
        "Ny demo-booking mottatt",
        "En kunde har sendt inn en booking gjennom Booking System Demo.",
        businessRows,
        `Bookingreferanse: ${booking.bookingId}`,
      ),
      text: businessText,
    },
  };
}
