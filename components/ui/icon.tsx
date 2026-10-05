import {
  AppWindow,
  Bath,
  BedDouble,
  Building,
  Building2,
  CookingPot,
  Fence,
  Home,
  House,
  Layers,
  Refrigerator,
  Sofa,
  Sparkles,
  WashingMachine,
  Wind,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Icons referenced by name from the database (services.icon). Only this
 * allow-list is bundled, keeping client JavaScript small.
 */
export const SERVICE_ICONS: Record<string, LucideIcon> = {
  AppWindow,
  Bath,
  BedDouble,
  Building,
  Building2,
  CookingPot,
  Fence,
  Home,
  House,
  Layers,
  Refrigerator,
  Sofa,
  Sparkles,
  WashingMachine,
  Wind,
};

export const SERVICE_ICON_NAMES = Object.keys(SERVICE_ICONS);

export function ServiceIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = SERVICE_ICONS[name] ?? Sparkles;
  return <Icon aria-hidden {...props} />;
}
