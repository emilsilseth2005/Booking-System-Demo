import type { Metadata } from "next";
import { BookingDemo } from "./BookingDemo";

export const metadata: Metadata = {
  title: "Kundevisning | Booking System Demo",
  description: "Se hvordan en enkel og tilpassbar digital bookingreise kan fungere for kundene deres.",
};

export default function Home() {
  return <BookingDemo />;
}
