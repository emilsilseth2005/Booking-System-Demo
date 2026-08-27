"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Booking, BookingStatus, deleteBooking, getBookings, updateBookingStatus } from "@/lib/booking-store";
import { supabase } from "@/lib/supabase";

const statusLabels: Record<BookingStatus, string> = { upcoming: "Kommende", completed: "Fullført", cancelled: "Avbestilt" };

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

export function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<"all" | BookingStatus>("upcoming");
  const [query, setQuery] = useState("");
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const loadManagerAccess = useCallback(async (activeUser: User | null) => {
    setUser(activeUser);
    if (!activeUser) {
      setIsManager(null);
      setBookings([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", activeUser.id)
      .single();

    const manager = !profileError && profile?.role === "manager";
    setIsManager(manager);
    if (manager) {
      try {
        setBookings(await getBookings());
        setDataError("");
      } catch {
        setDataError("Kunne ikke hente bestillingene fra serveren.");
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => loadManagerAccess(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => loadManagerAccess(session?.user ?? null), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [loadManagerAccess]);

  const refresh = async () => {
    try {
      setBookings(await getBookings());
      setDataError("");
    } catch {
      setDataError("Kunne ikke oppdatere bestillingene.");
    }
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSigningIn(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (error) setAuthError("Innloggingen mislyktes. Kontroller e-post og passord.");
    setIsSigningIn(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setBookings([]);
  };

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

  const changeStatus = async (id: string, status: BookingStatus) => {
    try {
      await updateBookingStatus(id, status);
      await refresh();
    } catch {
      setDataError(status === "upcoming" ? "Tiden er allerede opptatt." : "Statusen kunne ikke endres.");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Vil du slette denne bestillingen permanent?")) return;
    try {
      await deleteBooking(id);
      await refresh();
    } catch {
      setDataError("Bestillingen kunne ikke slettes.");
    }
  };

  if (isLoading) {
    return <main className="admin-auth-page"><div className="admin-auth-card"><span className="auth-loader" /><p>Kobler til bedriftsportalen …</p></div></main>;
  }

  if (!user) {
    return (
      <main className="admin-auth-page">
        <section className="admin-auth-card">
          <a className="business" href="/"><span className="business-mark">SN</span><span><strong>Studio Nord</strong><small>Bedriftsportal</small></span></a>
          <div><p className="eyebrow">Sikker innlogging</p><h1>Se og administrer bestillinger.</h1><p>Logg inn med lederbrukeren fra CRM-systemet.</p></div>
          <form onSubmit={signIn}>
            <label><span>E-post</span><input name="email" type="email" autoComplete="email" required /></label>
            <label><span>Passord</span><input name="password" type="password" autoComplete="current-password" required /></label>
            {authError ? <p className="booking-error" role="alert">{authError}</p> : null}
            <button className="primary-button" type="submit" disabled={isSigningIn}>{isSigningIn ? "Logger inn …" : "Logg inn"} <span>→</span></button>
          </form>
          <a className="back-to-booking" href="/">← Tilbake til bestillingssiden</a>
        </section>
      </main>
    );
  }

  if (!isManager) {
    return (
      <main className="admin-auth-page">
        <section className="admin-auth-card"><p className="eyebrow">Ingen tilgang</p><h1>Denne brukeren er ikke leder.</h1><p>Bedriftsportalen er begrenset til ledelsen.</p><button className="primary-button" type="button" onClick={signOut}>Logg ut</button></section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <a className="business" href="/"><span className="business-mark">SN</span><span><strong>Studio Nord</strong><small>Bedriftsportal</small></span></a>
        <div className="admin-header-actions"><nav className="surface-switch" aria-label="Bytt visning"><a href="/">Bestill time</a><a className="active" href="/admin">Bedriftsportal</a></nav><button type="button" onClick={signOut}>Logg ut</button></div>
      </header>

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div><p className="eyebrow">Arbeidsflate</p><h2>Bestillinger</h2></div>
          <nav aria-label="Filtrer bestillinger">
            {(["upcoming", "all", "completed", "cancelled"] as const).map((value) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}><span>{value === "all" ? "Alle" : statusLabels[value]}</span><strong>{value === "all" ? bookings.length : bookings.filter((booking) => booking.status === value).length}</strong></button>)}
          </nav>
          <div className="demo-security"><strong>Serverlagret</strong><p>Bestillingene er synkronisert med Supabase og tilgjengelige på alle enheter.</p></div>
        </aside>

        <section className="admin-main">
          <div className="admin-heading"><div><p className="eyebrow">Dagens oversikt</p><h1>Hei! Her er timene deres.</h1></div><div className="heading-actions"><button type="button" onClick={refresh}>↻ Oppdater</button><a className="new-booking-link" href="/">+ Ny bestilling</a></div></div>
          {dataError ? <p className="booking-error" role="alert">{dataError}</p> : null}
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
