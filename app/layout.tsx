import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking System Demo",
  description: "En interaktiv demonstrasjon av en fleksibel bookingtjeneste.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="nb"><body>{children}</body></html>;
}
