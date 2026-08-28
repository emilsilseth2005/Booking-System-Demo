"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import { deleteBooking, getBookings, updateBookingStatus } from "@/lib/booking-store";
import type { Booking, BookingStatus } from "@/lib/booking-store";
import { osloDateKey } from "@/lib/booking-time";
import { supabase } from "@/lib/supabase";

const statusLabels: Record<BookingStatus, string> = { upcoming: "Kommende", completed: "Fullført", cancelled: "Avbestilt" };

function prettyDate(value: string) {
  return new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function demoDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return osloDateKey(date);
}

function createDemoBookings(): Booking[] {
  const createdAt = new Date().toISOString();
  return [
    { id: "demo-1", customerName: "Mari Hansen", email: "mari@eksempel.no", phone: "920 14 820", note: "Ønsker en kort konsultasjon først.", serviceId: "klipp", serviceName: "Dame- og herreklipp", staffId: "nora", staffName: "Nora", date: demoDate(0), time: "11:30", duration: 60, price: 790, status: "upcoming", createdAt },
    { id: "demo-2", customerName: "Jonas Berg", email: "jonas@eksempel.no", phone: "481 22 905", note: "", serviceId: "styling", serviceName: "Vask og styling", staffId: "emil", staffName: "Emil", date: demoDate(0), time: "14:15", duration: 45, price: 590, status: "upcoming", createdAt },
    { id: "demo-3", customerName: "Ida Nilsen", email: "ida@eksempel.no", phone: "906 38 441", note: "Kommer fem minutter tidlig.", serviceId: "klipp", serviceName: "Dame- og herreklipp", staffId: "nora", staffName: "Nora", date: demoDate(1), time: "10:15", duration: 60, price: 790, status: "upcoming", createdAt },
    { id: "demo-4", customerName: "Andreas Moen", email: "andreas@eksempel.no", phone: "995 61 074", note: "", serviceId: "skjegg", serviceName: "Skjegg og finish", staffId: "emil", staffName: "Emil", date: demoDate(-1), time: "13:00", duration: 30, price: 450, status: "completed", createdAt },
    { id: "demo-5", customerName: "Sara Lie", email: "sara@eksempel.no", phone: "474 09 322", note: "", serviceId: "styling", serviceName: "Vask og styling", staffId: "nora", staffName: "Nora", date: demoDate(2), time: "15:30", duration: 45, price: 590, status: "cancelled", createdAt },
  ];
}

export function AdminDashboard({ demoMode = false }: { demoMode?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(demoMode ? true : null);
  const [bookings, setBookings] = useState<Booking[]>(() => demoMode ? createDemoBookings() : []);
  const [filter, setFilter] = useState<"all" | BookingStatus>("upcoming");
  const [query, setQuery] = useState("");
  const [authError, setAuthError] = useState("");
  const [dataError, setDataError] = useState("");
  const [isLoading, setIsLoading] = useState(!demoMode);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [pendingBookingId, setPendingBookingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    if (profileError) setDataError("Kunne ikke kontrollere ledertilgangen akkurat nå.");
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
    if (demoMode) return;
    supabase.auth.getUser().then(({ data }) => loadManagerAccess(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => loadManagerAccess(session?.user ?? null), 0);
    });
    return () => listener.subscription.unsubscribe();
  }, [demoMode, loadManagerAccess]);

  const refresh = async () => {
    if (demoMode) {
      setBookings(createDemoBookings());
      setDataError("");
      return;
    }
    setIsRefreshing(true);
    try {
      setBookings(await getBookings());
      setDataError("");
    } catch {
      setDataError("Kunne ikke oppdatere bestillingene.");
    } finally {
      setIsRefreshing(false);
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
  const todayKey = osloDateKey();
  const todayCount = upcoming.filter((booking) => booking.date === todayKey).length;
  const revenue = bookings.filter((booking) => booking.status !== "cancelled").reduce((sum, booking) => sum + booking.price, 0);

  const changeStatus = async (id: string, status: BookingStatus) => {
    if (demoMode) {
      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
      return;
    }
    setPendingBookingId(id);
    try {
      await updateBookingStatus(id, status);
      await refresh();
    } catch {
      setDataError(status === "upcoming" ? "Tiden er allerede opptatt." : "Statusen kunne ikke endres.");
    } finally {
      setPendingBookingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Vil du slette denne bestillingen permanent?")) return;
    if (demoMode) {
      setBookings((current) => current.filter((booking) => booking.id !== id));
      return;
    }
    setPendingBookingId(id);
    try {
      await deleteBooking(id);
      await refresh();
    } catch {
      setDataError("Bestillingen kunne ikke slettes.");
    } finally {
      setPendingBookingId(null);
    }
  };

  if (isLoading) {
    return <main className="admin-auth-page"><div className="admin-auth-card"><span className="auth-loader" /><p>Kobler til bedriftsportalen …</p></div></main>;
  }

  if (!demoMode && !user) {
    return (
      <main className="admin-auth-page">
        <section className="admin-auth-card">
          <Link className="business" href="/"><span className="business-mark"><Image src="/brand/studio-nord-mark.png" width={32} height={32} alt="" priority /></span><span><strong>Studio Nord</strong><small>Bedriftsportal</small></span></Link>
          <div><p className="eyebrow">Sikker innlogging</p><h1>Se og administrer bestillinger.</h1><p>Logg inn med lederbrukeren fra CRM-systemet.</p></div>
          <form onSubmit={signIn}>
            <label><span>E-post</span><input name="email" type="email" autoComplete="email" required /></label>
            <label><span>Passord</span><input name="password" type="password" autoComplete="current-password" required /></label>
            {authError ? <p className="booking-error" role="alert">{authError}</p> : null}
            <button className="primary-button" type="submit" disabled={isSigningIn}>{isSigningIn ? "Logger inn …" : "Logg inn"} <span>→</span></button>
          </form>
          <Link className="back-to-booking" href="/">← Tilbake til bestillingssiden</Link>
        </section>
      </main>
    );
  }

  if (!demoMode && !isManager) {
    return (
      <main className="admin-auth-page">
        <section className="admin-auth-card"><p className="eyebrow">Ingen tilgang</p><h1>Denne brukeren er ikke leder.</h1><p>Bedriftsportalen er begrenset til ledelsen.</p><button className="primary-button" type="button" onClick={signOut}>Logg ut</button></section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-topbar">
        <Link className="business" href="/"><span className="business-mark"><Image src="/brand/studio-nord-mark.png" width={32} height={32} alt="" priority /></span><span><strong>Studio Nord</strong><small>Bedriftsportal</small></span></Link>
        <div className="admin-header-actions"><nav className="surface-switch" aria-label="Bytt demovisning"><Link href="/">Kundevisning</Link><Link className="active" aria-current="page" href="/admin?demo=1">Bedriftsvisning</Link></nav>{demoMode ? <Link className="secure-login-link" href="/admin">Sikker innlogging</Link> : <button type="button" onClick={signOut}>Logg ut</button>}</div>
      </header>

      {demoMode ? <section className="admin-demo-banner"><div><span>Interaktiv salgsdemo</span><strong>Slik kan bedriften styre hele bookingdagen.</strong></div><p>Eksempeldataene kan trygt endres. I en kundeløsning tilpasses tjenester, ansatte, farger og arbeidsflyt.</p></section> : null}

      <div className="admin-layout">
        <aside className="admin-sidebar">
          <div><p className="eyebrow">Arbeidsflate</p><h2>Bestillinger</h2></div>
          <nav aria-label="Filtrer bestillinger">
            {(["upcoming", "all", "completed", "cancelled"] as const).map((value) => <button type="button" className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}><span>{value === "all" ? "Alle" : statusLabels[value]}</span><strong>{value === "all" ? bookings.length : bookings.filter((booking) => booking.status === value).length}</strong></button>)}
          </nav>
          <div className="demo-security"><strong>{demoMode ? "Trygg demovisning" : "Serverlagret"}</strong><p>{demoMode ? "Utforsk portalen uten å påvirke ekte bestillinger." : "Bestillingene er synkronisert med Supabase og tilgjengelige på alle enheter."}</p></div>
        </aside>

        <section className="admin-main">
          <div className="admin-heading"><div><p className="eyebrow">{demoMode ? "Eksempel på bedriftsvisningen" : "Dagens oversikt"}</p><h1>{demoMode ? "Hele bookingdagen. Ett sted." : "Hei! Her er timene deres."}</h1></div><div className="heading-actions"><button type="button" onClick={refresh} disabled={isRefreshing}>{isRefreshing ? "Oppdaterer …" : "↻ Oppdater"}</button><Link className="new-booking-link" href="/">+ Ny bestilling</Link></div></div>
          {dataError ? <p className="booking-error" role="alert">{dataError}</p> : null}
          <div className="metric-grid">
            <article><span>I dag</span><strong>{todayCount}</strong><small>bestillinger</small></article>
            <article><span>Kommende</span><strong>{upcoming.length}</strong><small>aktive timer</small></article>
            <article><span>Omsetning</span><strong>{revenue.toLocaleString("nb-NO")} kr</strong><small>i demoen</small></article>
          </div>

          <section className="automation-strip" aria-label="Automatiseringer i løsningen">
            <div><span>✓</span><p><strong>Bekreftelser</strong><small>Sendes automatisk ved ny time</small></p></div>
            <div><span>✓</span><p><strong>Påminnelser</strong><small>Kan sendes før avtalen</small></p></div>
            <div><span>✓</span><p><strong>Ledige tider</strong><small>Oppdateres når noe endres</small></p></div>
          </section>

          <section className="booking-list-card">
            <div className="list-toolbar"><div><h2>{filter === "all" ? "Alle bestillinger" : statusLabels[filter]}</h2><p>{visible.length} bestillinger vises</p></div><label><span>Søk</span><input type="search" placeholder="Navn, tjeneste eller behandler" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
            {visible.length === 0 ? <div className="empty-bookings"><span>✓</span><h3>Ingen bestillinger her</h3><p>Prøv et annet filter, eller opprett en ny bestilling.</p></div> : <div className="booking-table">
              {visible.map((booking) => <article className="booking-row" key={booking.id}>
                <div className="booking-date"><strong>{booking.time}</strong><span>{prettyDate(booking.date)}</span></div>
                <div className="booking-person"><span>{booking.customerName.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><div><strong>{booking.customerName}</strong><small>{booking.phone} · {booking.email}</small></div></div>
                <div className="booking-service"><strong>{booking.serviceName}</strong><small>{booking.staffName} · {booking.duration} min</small></div>
                <span className={`status-pill ${booking.status}`}>{statusLabels[booking.status]}</span>
                <div className="row-actions">
                  {booking.status === "upcoming" ? <><button type="button" disabled={pendingBookingId === booking.id} onClick={() => changeStatus(booking.id, "completed")}>Fullfør</button><button type="button" disabled={pendingBookingId === booking.id} onClick={() => changeStatus(booking.id, "cancelled")}>Avbestill</button></> : <button type="button" disabled={pendingBookingId === booking.id} onClick={() => changeStatus(booking.id, "upcoming")}>Gjenåpne</button>}
                  <button className="delete-action" type="button" disabled={pendingBookingId === booking.id} aria-label={`Slett bestilling for ${booking.customerName}`} onClick={() => remove(booking.id)}>×</button>
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
