const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN");

/** ₹4,395 */
export function formatINR(amount: number) {
  return inr.format(amount);
}

/** 1,200 */
export function formatNumber(n: number) {
  return num.format(n);
}

const TZ = "Asia/Kolkata";

/** "30 September 2026" from a YYYY-MM-DD date string. */
export function formatDate(date: string, opts: { year?: boolean; weekday?: boolean } = { year: true }) {
  const d = new Date(`${date}T12:00:00+05:30`);
  return d.toLocaleDateString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "long",
    ...(opts.year ? { year: "numeric" } : {}),
    ...(opts.weekday ? { weekday: "short" } : {}),
  });
}

/** "29 Sep 2026, 4:05 pm" for timestamps. */
export function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDistance(km: number) {
  return `${km.toFixed(1)} km`;
}

export function bhkLabel(bhk: string) {
  return bhk.replace("BHK", " BHK");
}

export function titleCase(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
