"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LocationPicker, type PickedLocation } from "@/components/maps/location-picker";
import { Button } from "@/components/ui/button";
import type { ServiceAreaSettings } from "@/lib/settings/schema";

export function ServiceAreaChecker({ area }: { area: ServiceAreaSettings }) {
  const [loc, setLoc] = useState<PickedLocation | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <LocationPicker area={area} value={loc} onChange={setLoc} mapClassName="h-80 sm:h-[26rem]" />
      {loc?.serviceability.serviceable ? (
        <Button asChild size="lg" className="w-fit">
          <Link href="/book">
            Get Instant Quote <ArrowRight aria-hidden />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
