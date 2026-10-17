import { Suspense } from "react";
import { Skeleton } from "@/components/ui/surface";
import { PartsView } from "@/features/parts/parts-view";

export const metadata = { title: "Repuestos | Dealerly" };

export default function RepuestosPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <PartsView />
    </Suspense>
  );
}
