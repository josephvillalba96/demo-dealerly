import { Suspense } from "react";
import { Skeleton } from "@/components/ui/surface";
import { TreasuryView } from "@/features/treasury/treasury-view";

export const metadata = { title: "Tesorería | Dealerly" };

export default function TesoreriaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <TreasuryView />
    </Suspense>
  );
}
