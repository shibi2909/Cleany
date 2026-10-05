import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-sand-100", className)} aria-hidden />;
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

const ALERT_STYLES = {
  info: { box: "border-sky-200 bg-sky-50 text-sky-900", icon: Info },
  success: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: CheckCircle2 },
  warning: { box: "border-amber-200 bg-honey-50 text-amber-900", icon: AlertTriangle },
  danger: { box: "border-red-200 bg-red-50 text-red-900", icon: XCircle },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  icon,
}: {
  tone?: keyof typeof ALERT_STYLES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  const style = ALERT_STYLES[tone];
  const Icon = icon ?? style.icon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl border p-4 text-sm", style.box, className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="opacity-90">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 px-6 py-12 text-center", className)}>
      <span className="grid size-12 place-items-center rounded-2xl bg-white text-brand-700 shadow-soft">
        <Icon className="size-6" aria-hidden />
      </span>
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? (
        <Button asChild size="sm" className="mt-5">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
