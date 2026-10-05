import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/feedback";

export default function BookingNotFound() {
  return <EmptyState icon={SearchX} title="Booking not found" description="This booking doesn't exist or isn't on your account." action={{ label: "View my bookings", href: "/customer/bookings" }} />;
}
