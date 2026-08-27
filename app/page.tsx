import type { Metadata } from "next";
import { BookingDemo } from "./BookingDemo";

export const metadata: Metadata = {
  title: "Bestill time | Studio Nord",
  description: "Interaktiv demonstrasjon av en moderne bestillingsløsning.",
};

export default function Home() {
  return <BookingDemo />;
}
