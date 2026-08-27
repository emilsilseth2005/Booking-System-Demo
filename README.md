# Booking System Demo

Interaktiv demo av et moderne bookingsystem for tjenestebedrifter.

## E-postbekreftelser

En fullført booking sender én bekreftelse til kunden og ett varsel til bedriften via Resend. Sett `RESEND_API_KEY` som en servervariabel i Vercel. Avsender og bedriftsmottaker kan overstyres med `BOOKING_FROM_EMAIL` og `BOOKING_BUSINESS_EMAIL`. Standard bedriftsmottaker er `hei@klingsystems.no`.

Avsenderdomenet må være verifisert i Resend. Se `.env.example` for variabelnavn. Ikke legg en ekte API-nøkkel i kildekoden.
