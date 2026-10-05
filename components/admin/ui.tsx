import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "attention";
  hint?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-white p-4 shadow-soft transition",
        tone === "attention" ? "border-amber-200" : "border-line",
        href && "hover:border-brand-200 hover:shadow-lift",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        <Icon className={cn("size-4", tone === "attention" ? "text-amber-600" : "text-brand-600")} aria-hidden />
      </div>
      <span className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

export function TableShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-line bg-white shadow-soft", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("whitespace-nowrap border-b border-line bg-sand-50 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-4 py-3 align-middle", className)}>{children}</td>;
}

export function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "bg-brand-900 text-cream" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  return <nav className="mb-5 flex w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 sm:w-fit">{children}</nav>;
}
