import { Database } from "lucide-react";

/** Shown instead of prices when the database isn't connected yet (fresh checkout). */
export function SetupNotice({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex gap-4 rounded-2xl border border-amber-200 bg-honey-50 p-5 text-amber-950">
        <Database className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="text-sm">
          <p className="font-semibold">Live prices are unavailable right now</p>
          <p className="mt-1 opacity-90">
            Pricing is loaded from the database. If you are setting up this site, add your Supabase keys to{" "}
            <code className="rounded bg-white/70 px-1">.env.local</code> and run the migrations (see README). Otherwise please try
            again in a moment.
          </p>
        </div>
      </div>
    </div>
  );
}
