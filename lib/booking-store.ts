import { supabase } from "@/lib/supabase";

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

export type OccupiedSlot = {
  staffId: string;
  date: string;
  time: string;
};

type BookingRow = {
  id: string;
  customer_name: string;
  email: string;
  phone: string;
  note: string;
  service_id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  booking_date: string;
  booking_time: string;
  duration: number;
  price: number;
  status: BookingStatus;
  created_at: string;
};

function fromRow(row: BookingRow): Booking {
  return {
    id: row.id,
    customerName: row.customer_name,
    email: row.email,
    phone: row.phone,
    note: row.note,
    serviceId: row.service_id,
    serviceName: row.service_name,
    staffId: row.staff_id,
    staffName: row.staff_name,
    date: row.booking_date,
    time: row.booking_time,
    duration: row.duration,
    price: row.price,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getOccupiedSlots(): Promise<OccupiedSlot[]> {
  const { data, error } = await supabase
    .from("booking_demo_slots")
    .select("staff_id, booking_date, booking_time");

  if (error) throw error;
  return (data ?? []).map((slot) => ({
    staffId: slot.staff_id,
    date: slot.booking_date,
    time: slot.booking_time,
  }));
}

export async function getBookings(): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("booking_demo_bookings")
    .select("*")
    .order("booking_date", { ascending: true })
    .order("booking_time", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as BookingRow[]).map(fromRow);
}

export async function addBooking(booking: Booking): Promise<boolean> {
  const { error } = await supabase.from("booking_demo_bookings").insert({
    id: booking.id,
    customer_name: booking.customerName.trim(),
    email: booking.email.trim().toLowerCase(),
    phone: booking.phone.trim(),
    note: booking.note.trim(),
    service_id: booking.serviceId,
    service_name: booking.serviceName,
    staff_id: booking.staffId,
    staff_name: booking.staffName,
    booking_date: booking.date,
    booking_time: booking.time,
    duration: booking.duration,
    price: booking.price,
    status: "upcoming",
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

export async function updateBookingStatus(id: string, status: BookingStatus) {
  const { error } = await supabase
    .from("booking_demo_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteBooking(id: string) {
  const { error } = await supabase.from("booking_demo_bookings").delete().eq("id", id);
  if (error) throw error;
}
