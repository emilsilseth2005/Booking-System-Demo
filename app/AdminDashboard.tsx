"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Booking, BookingStatus, deleteBooking, getBookings, updateBookingStatus } from "@/lib/booking-store";

const statusLabels: Record<BookingStatus, string> = { upcoming: "Kommende", completed: "Fullført", cancelled: "Avbestilt" };

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<"all" | BookingStatus>("upcoming");
  const [query, setQuery] = useState("");

  const refresh = () => setBookings(getBookings());
  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    window.addEventListener("booking-demo-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("booking-demo-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bookings
      .filter((booking) => filter === "all" || booking.status === filter)
      .filter((booking) => !normalized || `${booking.customerName} ${booking.serviceName} ${booking.staffName}`.toLowerCase().includes(normalized))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [bookings, filter, query]);

  const upcoming = bookings.filter((booking) => booking.status === "upcoming");
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = upcoming.filter((booking) => booking.date === todayKey).length;
  const revenue = bookings.filter((booking) => booking.status !== "cancelled").reduce((sum, booking) => sum + booking.price, 0);

  const changeStatus = (id: string, status: BookingStatus) => { updateBookingStatus(id, status); refresh(); };
  const remove = (id: string) => { deleteBooking(id); refresh(); };

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link className="business" href="/"><span className="business-mark">SN</span><span><strong>Studio Nord</strong><small>Bedriftsportal</small></span></Link>
        <nav className="surface-switch" aria-label="Bytt visning"><Link href="/">Bestill time</Link><Link className="active" href="/admin">Bedriftsportal</Link></nav>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div><p className="eyebrow">Arbeidsflate</p><h2>Bestillinger</h2></div>
          <nav aria-label="Filtrer bestillinger">
            {(["upcoming", "all", "completed", "cancelled"] as const).map((value) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}><span>{value === "all" ? "Alle" : statusLabels[value]}</span><strong>{value === "all" ? bookings.length : bookings.filter((booking) => booking.status === value).length}</strong></button>)}
          </nav>
          <div className="demo-security"><strong>Demoportal</strong><p>Legg til sikker innlogging før ekte kundedata tas i bruk.</p></div>
        </aside>

        <section className="admin-main">
          <div className="admin-heading"><div><p className="eyebrow">Dagens oversikt</p><h1>Hei! Her er timene deres.</h1></div><Link className="new-booking-link" href="/">+ Ny bestilling</Link></div>
          <div className="metric-grid">
            <article><span>I dag</span><strong>{todayCount}</strong><small>bestillinger</small></article>
            <article><span>Kommende</span><strong>{upcoming.length}</strong><small>aktive timer</small></article>
            <article><span>Omsetning</span><strong>{revenue.toLocaleString("nb-NO")} kr</strong><small>i demoen</small></article>
          </div>

          <section className="booking-list-card">
            <div className="list-toolbar"><div><h2>{filter === "all" ? "Alle bestillinger" : statusLabels[filter]}</h2><p>{visible.length} bestillinger vises</p></div><label><span>Søk</span><input type="search" placeholder="Navn, tjeneste eller behandler" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
            {visible.length === 0 ? <div className="empty-bookings"><span>✓</span><h3>Ingen bestillinger her</h3><p>Prøv et annet filter, eller opprett en ny bestilling.</p></div> : <div className="booking-table">
              {visible.map((booking) => <article className="booking-row" key={booking.id}>
                <div className="booking-date"><strong>{booking.time}</strong><span>{prettyDate(booking.date)}</span></div>
                <div className="booking-person"><span>{booking.customerName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>{booking.customerName}</strong><small>{booking.phone} · {booking.email}</small></div></div>
                <div className="booking-service"><strong>{booking.serviceName}</strong><small>{booking.staffName} · {booking.duration} min</small></div>
                <span className={`status-pill ${booking.status}`}>{statusLabels[booking.status]}</span>
                <div className="row-actions">
                  {booking.status === "upcoming" ? <><button type="button" onClick={() => changeStatus(booking.id, "completed")}>Fullfør</button><button type="button" onClick={() => changeStatus(booking.id, "cancelled")}>Avbestill</button></> : <button type="button" onClick={() => changeStatus(booking.id, "upcoming")}>Gjenåpne</button>}
                  <button className="delete-action" type="button" aria-label={`Slett bestilling for ${booking.customerName}`} onClick={() => remove(booking.id)}>×</button>
                </div>
                {booking.note ? <p className="booking-note">“{booking.note}”</p> : null}
              </article>)}
            </div>}
          </section>
        </section>
      </div>
    </main>
  );
}
