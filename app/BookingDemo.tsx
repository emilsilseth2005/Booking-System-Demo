"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { addBooking, getOccupiedSlots, OccupiedSlot } from "@/lib/booking-store";

type Service = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  image: string;
};

type Staff = {
  id: string;
  name: string;
  role: string;
  initials: string;
  tone: string;
  image?: string;
};

const services: Service[] = [
  { id: "klipp", name: "Dame- og herreklipp", description: "Konsultasjon, vask, klipp og enkel styling.", duration: 60, price: 790, image: "/service-images/dame-herreklipp.webp" },
  { id: "styling", name: "Vask og styling", description: "Vask, føn og styling til hverdag eller anledning.", duration: 45, price: 590, image: "/service-images/vask-styling.webp" },
  { id: "skjegg", name: "Skjegg og finish", description: "Forming, maskinklipp og presis finish.", duration: 30, price: 450, image: "/service-images/skjegg-finish.webp" },
];

const staff: Staff[] = [
  { id: "any", name: "Første ledige", role: "Vis flest tilgjengelige tider", initials: "↗", tone: "sky" },
  { id: "nora", name: "Nora", role: "Seniorstylist", initials: "NS", tone: "gold", image: "/staff/nora-seniorstylist.webp" },
  { id: "emil", name: "Emil", role: "Frisør og barberer", initials: "EL", tone: "mint", image: "/staff/emil-frisor-barberer.webp" },
];

const weekdays = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const monthNames = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const timeOptions = ["09:00", "10:15", "11:30", "13:00", "14:15", "15:30", "17:00"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date: Date | null) {
  if (!date) return "Velg dato";
  return new Intl.DateTimeFormat("nb-NO", { weekday: "short", day: "numeric", month: "long" }).format(date);
}

function makeCalendar(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, index) => new Date(year, monthIndex, index + 1)),
  ];
}

export function BookingDemo() {
  const today = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    return value;
  }, []);
  const initialMonth = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const [step, setStep] = useState(1);
  const [serviceId, setServiceId] = useState("klipp");
  const [staffId, setStaffId] = useState("any");
  const [month, setMonth] = useState(initialMonth);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [occupiedSlots, setOccupiedSlots] = useState<OccupiedSlot[]>([]);
  const [bookingError, setBookingError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const refreshOccupiedSlots = useCallback(async () => {
    try {
      setOccupiedSlots(await getOccupiedSlots());
    } catch {}
  }, []);

  useEffect(() => {
    getOccupiedSlots()
      .then(setOccupiedSlots)
      .catch(() => setBookingError("Kunne ikke hente ledige tider akkurat nå. Prøv igjen."));
  }, []);

  useEffect(() => {
    if (step !== 3) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshOccupiedSlots();
    };
    const interval = window.setInterval(() => void refreshOccupiedSlots(), 15_000);

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshOccupiedSlots, step]);

  const selectedService = services.find((item) => item.id === serviceId) ?? services[0];
  const selectedStaff = staff.find((item) => item.id === staffId) ?? staff[0];
  const calendar = useMemo(() => makeCalendar(month), [month]);
  const selectedSlotIsBusy = useMemo(() => {
    if (!selectedDate || !selectedTime) return false;
    const key = dateKey(selectedDate);
    const isOccupiedBy = (personId: string) => occupiedSlots.some(
      (slot) => slot.staffId === personId && slot.date === key && slot.time === selectedTime,
    );
    return staffId === "any"
      ? staff.filter((person) => person.id !== "any").every((person) => isOccupiedBy(person.id))
      : isOccupiedBy(staffId);
  }, [occupiedSlots, selectedDate, selectedTime, staffId]);

  const slotsForDate = (date: Date | null) => {
    if (!date) return [];
    const key = dateKey(date);
    const bookableStaff = staff.filter((person) => person.id !== "any");
    return timeOptions.map((time) => {
      const isOccupied = (personId: string) => occupiedSlots.some((slot) => slot.staffId === personId && slot.date === key && slot.time === time);
      return { time, busy: staffId === "any" ? bookableStaff.every((person) => isOccupied(person.id)) : isOccupied(staffId) };
    });
  };

  const availableStaffFor = (date: Date, time: string) => {
    const key = dateKey(date);
    return staff.filter((person) => person.id !== "any" && !occupiedSlots.some((slot) => slot.staffId === person.id && slot.date === key && slot.time === time));
  };

  const chooseDate = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime("");
    setBookingError("");
  };

  const openSchedule = async () => {
    await refreshOccupiedSlots();
    setStep(3);
  };

  const reset = () => {
    setStep(1);
    setServiceId("klipp");
    setStaffId("any");
    setMonth(initialMonth);
    setSelectedDate(null);
    setSelectedTime("");
    setConfirmed(false);
    setBookingError("");
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDate || !selectedTime) return;
    setIsSaving(true);
    setBookingError("");
    const data = new FormData(event.currentTarget);
    const assignedStaff = staffId === "any" ? availableStaffFor(selectedDate, selectedTime)[0] : selectedStaff;
    if (!assignedStaff) {
      setBookingError("Denne tiden ble nettopp bestilt. Velg et annet tidspunkt.");
      setStep(3);
      setSelectedTime("");
      await refreshOccupiedSlots();
      setIsSaving(false);
      return;
    }

    try {
      const saved = await addBooking({ id: crypto.randomUUID(), customerName: String(data.get("name")), email: String(data.get("email")), phone: String(data.get("phone")), note: String(data.get("note") || ""), serviceId, serviceName: selectedService.name, staffId: assignedStaff.id, staffName: assignedStaff.name, date: dateKey(selectedDate), time: selectedTime, duration: selectedService.duration, price: selectedService.price, status: "upcoming", createdAt: new Date().toISOString() });
      if (!saved) {
        setBookingError("Denne tiden ble nettopp bestilt. Velg et annet tidspunkt.");
        setStep(3);
        setSelectedTime("");
        await refreshOccupiedSlots();
        return;
      }
      setStaffId(assignedStaff.id);
      setConfirmed(true);
    } catch {
      setBookingError("Bestillingen kunne ikke lagres. Kontroller forbindelsen og prøv igjen.");
    } finally {
      setIsSaving(false);
    }
  };

  if (confirmed) {
    return (
      <main className="confirmation-page">
        <section className="confirmation-card" aria-live="polite">
          <div className="confirmation-mark">✓</div>
          <p className="eyebrow">Bestillingen er registrert</p>
          <h1>Da er tiden din satt av.</h1>
          <p className="confirmation-lead">Dette er en demo. I en ferdig løsning ville kunden fått bekreftelse på e-post eller SMS nå.</p>
          <div className="confirmation-details">
            <div><span>Tjeneste</span><strong>{selectedService.name}</strong></div>
            <div><span>Tidspunkt</span><strong>{formatDate(selectedDate)} kl. {selectedTime}</strong></div>
            <div><span>Behandler</span><strong>{selectedStaff.name}</strong></div>
            <div><span>Pris</span><strong>{selectedService.price} kr</strong></div>
          </div>
          <button className="primary-button" type="button" onClick={reset}>Lag en ny bestilling <span>↗</span></button>
        </section>
      </main>
    );
  }

  return (
    <main className="booking-page">
      <header className="topbar">
        <a className="business" href="#booking" aria-label="Studio Nord, gå til bestilling">
          <span className="business-mark"><Image src="/brand/studio-nord-mark.png" width={32} height={32} alt="" priority /></span>
          <span><strong>Studio Nord</strong><small>Bestill time på nett</small></span>
        </a>
        <nav className="surface-switch" aria-label="Bytt visning"><Link className="active" href="/">Bestill time</Link><Link href="/admin">Bedriftsportal</Link></nav>
      </header>

      <section className="intro">
        <p className="eyebrow">Enklere timebestilling</p>
        <h1>Finn en tid som passer.</h1>
        <p>Velg tjeneste, behandler og tidspunkt. Hele bestillingen tar under ett minutt.</p>
      </section>

      <section className="booking-shell" id="booking">
        <nav className="steps" aria-label="Steg i bestillingen">
          {([
            [1, "Tjeneste"],
            [2, "Behandler"],
            [3, "Dato og tid"],
            [4, "Dine opplysninger"],
          ] as Array<[number, string]>).map(([number, label]) => (
            <button key={number} type="button" className={step === number ? "active" : step > number ? "complete" : ""} onClick={() => Number(number) <= step && setStep(Number(number))} disabled={Number(number) > step}>
              <span>{step > number ? "✓" : number}</span><strong>{label}</strong>
            </button>
          ))}
          <div className="help-card"><span>?</span><div><strong>Trenger du hjelp?</strong><small>Ring 99 00 00 00</small></div></div>
        </nav>

        <div className="booking-content">
          {step === 1 && (
            <section className="step-panel">
              <div className="panel-heading"><div><p className="eyebrow">Steg 1 av 4</p><h2>Hva vil du bestille?</h2></div><p>Pris og varighet vises før du går videre.</p></div>
              <div className="service-list">
                {services.map((service) => (
                  <button className={serviceId === service.id ? "service-option selected" : "service-option"} type="button" key={service.id} onClick={() => setServiceId(service.id)}>
                    <span className="service-symbol"><Image src={service.image} alt="" width={50} height={50} /></span>
                    <span className="service-copy"><strong>{service.name}</strong><small>{service.description}</small></span>
                    <span className="service-meta"><strong>{service.price} kr</strong><small>{service.duration} min</small></span>
                    <span className="radio-dot" />
                  </button>
                ))}
              </div>
              <div className="panel-footer"><span /><button className="primary-button" type="button" onClick={() => setStep(2)}>Velg behandler <span>→</span></button></div>
            </section>
          )}

          {step === 2 && (
            <section className="step-panel">
              <div className="panel-heading"><div><p className="eyebrow">Steg 2 av 4</p><h2>Hvem vil du bestille hos?</h2></div><p>Velg første ledige for flest mulige tider.</p></div>
              <div className="staff-grid">
                {staff.map((person) => (
                  <button className={staffId === person.id ? "staff-option selected" : "staff-option"} type="button" key={person.id} onClick={() => setStaffId(person.id)}>
                    <span className={`avatar ${person.tone}${person.image ? " has-photo" : ""}`}>
                      {person.image ? <Image src={person.image} width={132} height={132} alt="" /> : person.initials}
                    </span>
                    <span><strong>{person.name}</strong><small>{person.role}</small></span>
                    <span className="radio-dot" />
                  </button>
                ))}
              </div>
              <div className="panel-footer"><button className="back-button" type="button" onClick={() => setStep(1)}>← Tilbake</button><button className="primary-button" type="button" onClick={openSchedule}>Velg dato og tid <span>→</span></button></div>
            </section>
          )}

          {step === 3 && (
            <section className="step-panel calendar-panel">
              <div className="panel-heading"><div><p className="eyebrow">Steg 3 av 4</p><h2>Når passer det?</h2></div><p>Tidene oppdateres etter valgt behandler.</p></div>
              {bookingError || selectedSlotIsBusy ? <p className="booking-error" role="alert">{selectedSlotIsBusy ? "Denne tiden ble nettopp bestilt. Velg et annet tidspunkt." : bookingError}</p> : null}
              <div className="calendar-layout">
                <div className="calendar-card">
                  <div className="calendar-header">
                    <button type="button" aria-label="Forrige måned" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
                    <strong>{monthNames[month.getMonth()]} {month.getFullYear()}</strong>
                    <button type="button" aria-label="Neste måned" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
                  </div>
                  <div className="weekday-row">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
                  <div className="calendar-grid">
                    {calendar.map((date, index) => {
                      if (!date) return <span key={`empty-${index}`} />;
                      const past = date < today;
                      const sunday = date.getDay() === 0;
                      const unavailable = past || sunday;
                      const selected = selectedDate && dateKey(selectedDate) === dateKey(date);
                      const limited = !unavailable && date.getDate() % 5 === 0;
                      return <button key={dateKey(date)} type="button" disabled={unavailable} className={selected ? "selected" : limited ? "limited" : ""} onClick={() => chooseDate(date)}><span>{date.getDate()}</span>{!unavailable && <i />}</button>;
                    })}
                  </div>
                  <div className="calendar-legend"><span><i className="available" /> Ledig</span><span><i className="limited" /> Få tider</span><span><i className="busy" /> Ikke ledig</span></div>
                </div>
                <div className="times-card">
                  <div><p className="eyebrow">Tilgjengelige tider</p><h3>{formatDate(selectedDate)}</h3></div>
                  {!selectedDate ? <div className="empty-times"><span>↙</span><p>Velg en dato i kalenderen for å se ledige tidspunkt.</p></div> : (
                    <div className="time-grid">
                      {slotsForDate(selectedDate).map((slot) => <button type="button" key={slot.time} disabled={slot.busy} className={selectedTime === slot.time ? "selected" : ""} onClick={() => { setSelectedTime(slot.time); setBookingError(""); }}>{slot.time}{slot.busy && <small>Opptatt</small>}</button>)}
                    </div>
                  )}
                </div>
              </div>
              <div className="panel-footer"><button className="back-button" type="button" onClick={() => setStep(2)}>← Tilbake</button><button className="primary-button" type="button" disabled={!selectedDate || !selectedTime || selectedSlotIsBusy} onClick={() => setStep(4)}>Fyll inn opplysninger <span>→</span></button></div>
            </section>
          )}

          {step === 4 && (
            <section className="step-panel">
              <div className="panel-heading"><div><p className="eyebrow">Steg 4 av 4</p><h2>Hvem bestiller?</h2></div><p>Opplysningene brukes kun til denne demoen.</p></div>
              <form className="customer-form" onSubmit={submitBooking}>
                <label><span>Navn</span><input name="name" type="text" placeholder="Ola Nordmann" required /></label>
                <div className="form-row"><label><span>E-post</span><input name="email" type="email" placeholder="ola@eksempel.no" required /></label><label><span>Telefon</span><input name="phone" type="tel" placeholder="999 99 999" required /></label></div>
                <label><span>Kommentar <small>valgfritt</small></span><textarea name="note" placeholder="Er det noe vi bør vite før timen?" rows={3} /></label>
                <label className="consent"><input type="checkbox" required /><span>Jeg godtar at opplysningene brukes til å behandle bestillingen.</span></label>
                <div className="panel-footer"><button className="back-button" type="button" onClick={() => setStep(3)}>← Tilbake</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Lagrer …" : "Bekreft bestilling"} <span>✓</span></button></div>
              </form>
            </section>
          )}
        </div>

        <aside className="summary-card">
          <p className="eyebrow">Din bestilling</p>
          <div className="summary-service"><span><Image src={selectedService.image} alt="" width={46} height={46} /></span><div><strong>{selectedService.name}</strong><small>{selectedService.duration} minutter</small></div></div>
          <dl><div><dt>Behandler</dt><dd>{selectedStaff.name}</dd></div><div><dt>Dato</dt><dd>{formatDate(selectedDate)}</dd></div><div><dt>Tid</dt><dd>{selectedTime || "Velg tid"}</dd></div></dl>
          <div className="summary-total"><span>Totalt</span><strong>{selectedService.price} kr</strong></div>
          <p className="summary-note"><span>i</span> Ingen betaling i denne demoen.</p>
        </aside>
      </section>

      <footer><span>Booking System Demo</span><span>Bestillinger lagres sikkert på serveren</span></footer>
    </main>
  );
}
