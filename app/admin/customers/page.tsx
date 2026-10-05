import type { Metadata } from "next";
import { Search, Users } from "lucide-react";
import { AdminPageHeader, TableShell, Td, Th } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form-controls";
import { WhatsAppButton } from "@/components/whatsapp/whatsapp-button";
import { formatDate, formatINR } from "@/lib/format";
import { adminDb } from "@/lib/auth";
import type { Booking, Profile } from "@/types";
import { BRAND } from "@/lib/config/brand";

export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = await adminDb();
  let query = db.from("profiles").select("*").eq("role", "customer").order("created_at", { ascending: false }).limit(200);
  const term = q?.replace(/[%,()]/g, " ").trim().slice(0, 60);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data } = await query;
  const customers = (data ?? []) as Profile[];
  const { data: rows } = customers.length
    ? await db.from("bookings").select("user_id, total, payment_status, booking_status, created_at").in("user_id", customers.map((c) => c.id))
    : { data: [] };
  const stats = new Map<string, { count: number; paid: number; last: string | null; cancelled: number }>();
  for (const b of (rows ?? []) as Pick<Booking, "user_id" | "total" | "payment_status" | "booking_status" | "created_at">[]) {
    const s = stats.get(b.user_id) ?? { count: 0, paid: 0, last: null, cancelled: 0 };
    s.count++;
    if (b.payment_status === "PAID") s.paid += b.total;
    if (b.booking_status === "CANCELLED") s.cancelled++;
    if (!s.last || b.created_at > s.last) s.last = b.created_at;
    stats.set(b.user_id, s);
  }

  return (
    <div>
      <AdminPageHeader title="Customers" description="Registered customers and their booking activity." />
      <form className="mb-5 flex max-w-lg gap-2" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="cq" className="sr-only">
            Search customers
          </label>
          <Input id="cq" name="q" defaultValue={q} placeholder="Name, email or phone" className="pl-9" />
        </div>
        <Button type="submit">Search</Button>
      </form>
      {customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet." description="Customers appear here once they sign up." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Customer</Th>
              <Th>Contact</Th>
              <Th className="text-right">Bookings</Th>
              <Th className="text-right">Verified spend</Th>
              <Th>Last booking</Th>
              <Th>Joined</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const s = stats.get(c.id);
              return (
                <tr key={c.id}>
                  <Td>
                    <span className="font-medium">{c.full_name || "—"}</span>
                    {c.is_demo ? <span className="ml-1 rounded bg-sand-100 px-1 text-[0.65rem] text-muted">DEMO</span> : null}
                  </Td>
                  <Td>
                    <span className="block">{c.email}</span>
                    <span className="text-xs text-muted">{c.phone}</span>
                  </Td>
                  <Td className="text-right tabular-nums">
                    {s?.count ?? 0}
                    {s?.cancelled ? <span className="block text-xs text-muted">{s.cancelled} cancelled</span> : null}
                  </Td>
                  <Td className="text-right tabular-nums">{formatINR(s?.paid ?? 0)}</Td>
                  <Td className="whitespace-nowrap">{s?.last ? formatDate(s.last.slice(0, 10)) : "—"}</Td>
                  <Td className="whitespace-nowrap">{formatDate(c.created_at.slice(0, 10))}</Td>
                  <Td>
                    {c.phone ? (
                      <WhatsAppButton size="sm" variant="outline" phone={c.phone} message={`Hello ${c.full_name ?? ""}, this is ${BRAND.name}.`}>
                        WhatsApp
                      </WhatsAppButton>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
