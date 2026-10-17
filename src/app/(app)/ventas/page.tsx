import { Suspense } from "react";
import { Skeleton } from "@/components/ui/surface";
import { SalesView } from "@/features/sales/sales-view";

export const metadata = { title: "Ventas | Dealerly" };

export default function VentasPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SalesView />
    </Suspense>
  );
}
