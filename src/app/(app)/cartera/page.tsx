import { Suspense } from "react";
import { Skeleton } from "@/components/ui/surface";
import { CreditView } from "@/features/credit/credit-view";

export const metadata = { title: "Cartera | Dealerly" };

export default function CarteraPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CreditView />
    </Suspense>
  );
}
