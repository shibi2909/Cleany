import { BRAND } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

/** The Cleany mark: a bold "C" drawn like a single wipe, with a sparkle in its opening. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="9" fill="#0F3B2E" />
      <path d="M20.6 21.4A7.5 7.5 0 1 1 20.6 11.6" fill="none" stroke="#FBF8F3" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M17.2 19.6A3.9 3.9 0 1 1 17.2 13.4" fill="none" stroke="#5BB596" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M24 12.2l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z" fill="#E0A951" />
      <circle cx="25.6" cy="20.4" r="1.1" fill="#E0A951" opacity=".8" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-[1.4rem] leading-none tracking-tight", inverted ? "text-cream" : "text-brand-900")}>
        <span className="font-semibold">{BRAND.wordmark[0]}</span>
        <span className={cn("font-medium italic", inverted ? "text-[#E0A951]" : "text-honey")}>{BRAND.wordmark[1]}</span>
      </span>
    </span>
  );
}
