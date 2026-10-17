import { Suspense } from "react";
import { Skeleton } from "@/components/ui/surface";
import { InventoryList } from "@/features/inventory/inventory-list";

export const metadata = { title: "Inventario | Dealerly" };

export default function InventarioPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <InventoryList />
    </Suspense>
  );
}
