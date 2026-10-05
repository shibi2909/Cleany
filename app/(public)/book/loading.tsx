import { Skeleton } from "@/components/ui/feedback";

export default function Loading() {
  return (
    <div className="container-page py-8 sm:py-12" aria-busy="true" aria-label="Loading quote">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="mt-8 h-2 w-full" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <Skeleton className="h-96" />
        <Skeleton className="hidden h-80 lg:block" />
      </div>
    </div>
  );
}
