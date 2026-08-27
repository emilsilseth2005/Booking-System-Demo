import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createBookingEmails, parseBookingRequest } from "@/lib/booking-email";

export const runtime = "nodejs";

const requestWindowMs = 10 * 60 * 1000;
const maxRequestsPerWindow = 5;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function getClientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const address = getClientAddress(request);
  const current = requestCounts.get(address);

  if (!current || current.resetAt <= now) {
    if (requestCounts.size > 1000) {
      for (const [key, entry] of requestCounts) {
        if (entry.resetAt <= now) requestCounts.delete(key);
      }
    }
    requestCounts.set(address, { count: 1, resetAt: now + requestWindowMs });
    return false;
  }

  current.count += 1;
  return current.count > maxRequestsPerWindow;
}

function hasAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ error: "For mange forsøk. Vent litt og prøv igjen." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const booking = parseBookingRequest(payload);
  if (!booking) {
    return NextResponse.json({ error: "Kontroller opplysningene og prøv igjen." }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Booking email is unavailable: RESEND_API_KEY is missing.");
    return NextResponse.json({ error: "E-posttjenesten er ikke konfigurert." }, { status: 503 });
  }

  const from = process.env.BOOKING_FROM_EMAIL?.trim() || "Studio Nord <booking@klingsystems.no>";
  const businessEmail = process.env.BOOKING_BUSINESS_EMAIL?.trim() || "hei@klingsystems.no";
  const emails = createBookingEmails(booking);
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.batch.send(
      [
        {
          from,
          to: [booking.customer.email],
          replyTo: businessEmail,
          subject: emails.customer.subject,
          html: emails.customer.html,
          text: emails.customer.text,
        },
        {
          from,
          to: [businessEmail],
          replyTo: booking.customer.email,
          subject: emails.business.subject,
          html: emails.business.html,
          text: emails.business.text,
        },
      ],
      { idempotencyKey: `booking-confirmation/${booking.bookingId}` },
    );

    if (error) {
      console.error("Resend rejected booking emails:", error.name, error.message);
      return NextResponse.json({ error: "Bekreftelsen kunne ikke sendes. Prøv igjen." }, { status: 502 });
    }

    return NextResponse.json({ sent: true, messageCount: data?.data.length ?? 2 });
  } catch (error) {
    console.error("Booking email request failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Bekreftelsen kunne ikke sendes. Prøv igjen." }, { status: 502 });
  }
}
