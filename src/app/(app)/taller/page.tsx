import { Suspense } from "react";
import { Skeleton } from "@/components/ui/surface";
import { WorkshopView } from "@/features/workshop/workshop-view";

export const metadata = { title: "Taller | Dealerly" };

export default function TallerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <WorkshopView />
    </Suspense>
  );
}
