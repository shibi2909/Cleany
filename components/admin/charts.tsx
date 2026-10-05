import { cn } from "@/lib/utils";

/**
 * Lightweight, dependency-free charts for the admin dashboard.
 * Single-series (one brand hue, no legend needed — the title names the series),
 * thin bars with rounded data-ends, recessive axes, a hover tooltip on every mark,
 * and a screen-reader table for each chart.
 */

export interface Datum {
  label: string;
  value: number;
  /** Tooltip text; defaults to "label: value". */
  tip?: string;
}

export function ColumnChart({
  data,
  format = (n) => String(n),
  height = 160,
  title,
}: {
  data: Datum[];
  format?: (n: number) => string;
  height?: number;
  title: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d) => (d.value > best.value ? d : best), data[0] ?? { label: "", value: 0 });
  return (
    <figure>
      <div className="relative flex items-end gap-[2px] border-b border-line" style={{ height }} aria-hidden>
        {/* recessive gridline at the max */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <span className="pointer-events-none absolute -top-5 right-0 text-[0.7rem] text-muted tabular-nums">{format(max)}</span>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              className={cn("w-full max-w-7 rounded-t-[4px] bg-brand-600 transition-colors group-hover:bg-brand-800", d.value === 0 && "bg-sand-200")}
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 1.5)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-cream shadow-lift group-hover:block">
              {d.tip ?? `${d.label}: ${format(d.value)}`}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[0.65rem] text-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center">
            {i % Math.ceil(data.length / 7) === 0 ? d.label : ""}
          </span>
        ))}
      </div>
      {peak && peak.value > 0 ? (
        <figcaption className="mt-2 text-xs text-muted">
          Peak: {peak.label} · {format(peak.value)}
        </figcaption>
      ) : null}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row">{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export function BarList({ data, format = (n) => String(n), title }: { data: Datum[]; format?: (n: number) => string; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="text-sm text-muted">No data yet.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label={title}>
      {data.map((d) => (
        <li key={d.label} className="group" title={d.tip ?? `${d.label}: ${format(d.value)}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate text-ink-soft">{d.label}</span>
            <span className="font-semibold tabular-nums text-ink">{format(d.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sand-100">
            <div className="h-full rounded-full bg-brand-600 transition-colors group-hover:bg-brand-800" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
