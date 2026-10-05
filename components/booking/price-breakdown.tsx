import { formatINR } from "@/lib/format";
import type { Booking, BookingItem } from "@/types";

/** Price breakdown from the booking's price snapshots (unaffected by later price changes). */
export function PriceBreakdown({ booking, items }: { booking: Pick<Booking, "subtotal" | "discount" | "total">; items: BookingItem[] }) {
  return (
    <div>
      <ul className="flex flex-col gap-2 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4">
            <span className="text-ink-soft">
              {i.service_name_snapshot}
              {i.quantity > 1 ? (
                <span className="text-muted">
                  {" "}
                  × {i.quantity} @ {formatINR(i.unit_price)}
                </span>
              ) : null}
            </span>
            <span className="font-medium tabular-nums">{formatINR(i.total_price)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Subtotal</span>
          <span className="tabular-nums">{formatINR(booking.subtotal)}</span>
        </div>
        {booking.discount > 0 ? (
          <div className="flex justify-between text-brand-700">
            <span>Discount</span>
            <span className="tabular-nums">− {formatINR(booking.discount)}</span>
          </div>
        ) : null}
        <div className="flex items-end justify-between pt-1">
          <span className="font-semibold">Total</span>
          <span className="font-display text-2xl font-medium text-brand-900 tabular-nums">{formatINR(booking.total)}</span>
        </div>
      </div>
    </div>
  );
}
