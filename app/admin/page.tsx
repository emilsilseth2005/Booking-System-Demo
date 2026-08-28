import { AdminDashboard } from "../AdminDashboard";

export const metadata = { title: "Bedriftsportal | Booking System Demo" };

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const { demo } = await searchParams;
  return <AdminDashboard demoMode={demo === "1"} />;
}
