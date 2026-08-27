export type BookingStatus = "upcoming" | "completed" | "cancelled";

export type Booking = {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  note: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: BookingStatus;
  createdAt: string;
};

const STORAGE_KEY = "booking-system-demo:v1";

function futureDate(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function sampleBookings(): Booking[] {
  return [
    { id: "sample-1", customerName: "Anna Berg", email: "anna@eksempel.no", phone: "988 21 345", note: "Ønsker lett oppklipping.", serviceId: "klipp", serviceName: "Dame- og herreklipp", staffId: "nora", staffName: "Nora", date: futureDate(1), time: "10:15", duration: 60, price: 790, status: "upcoming", createdAt: new Date().toISOString() },
    { id: "sample-2", customerName: "Jonas Vik", email: "jonas@eksempel.no", phone: "944 18 760", note: "", serviceId: "skjegg", serviceName: "Skjegg og finish", staffId: "emil", staffName: "Emil", date: futureDate(2), time: "13:00", duration: 30, price: 450, status: "upcoming", createdAt: new Date().toISOString() },
  ];
}

export function getBookings(): Booking[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try { return JSON.parse(stored) as Booking[]; } catch { /* Seed a clean demo below. */ }
  }
  const seeded = sampleBookings();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

export function saveBookings(bookings: Booking[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  window.dispatchEvent(new CustomEvent("booking-demo-updated"));
}

export function addBooking(booking: Booking) {
  const bookings = getBookings();
  const conflict = bookings.some((item) => item.status === "upcoming" && item.date === booking.date && item.time === booking.time);
  if (conflict) return false;
  saveBookings([...bookings, booking]);
  return true;
}

export function updateBookingStatus(id: string, status: BookingStatus) {
  saveBookings(getBookings().map((booking) => booking.id === id ? { ...booking, status } : booking));
}

export function deleteBooking(id: string) {
  saveBookings(getBookings().filter((booking) => booking.id !== id));
}
