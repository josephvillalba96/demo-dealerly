"use client";

import { useSearchParams } from "next/navigation";
import { Card, PageIntro } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/tabs";
import { useDemo } from "@/store";
import { CashTab } from "./cash-tab";
import { LedgerTab } from "./ledger-tab";
import { PaymentsTab } from "./payments-tab";
import { ReconcileTab } from "./reconcile-tab";
import { RefundsTab } from "./refunds-tab";
import { SuppliersTab } from "./suppliers-tab";

export function TreasuryView() {
  const params = useSearchParams();
  const pending = useDemo((s) => s.data.payments.filter((p) => p.direction === "in" && p.status === "pending").length);
  const refunds = useDemo((s) => s.data.refunds.filter((r) => r.status !== "confirmed").length);

  return (
    <>
      <PageIntro>El dinero solo cuenta cuando está confirmado con evidencia. Cada pago se aplica a una obligación y cada peso queda explicado en caja, banco y libro.</PageIntro>
      <Card className="p-5">
        <Tabs
          defaultValue={params.get("tab") ?? "pagos"}
          tabs={[
            { value: "pagos", label: "Pagos", count: pending, content: <PaymentsTab /> },
            { value: "proveedores", label: "Proveedores y egresos", content: <SuppliersTab /> },
            { value: "devoluciones", label: "Devoluciones", count: refunds, content: <RefundsTab /> },
            { value: "conciliacion", label: "Conciliación", content: <ReconcileTab /> },
            { value: "caja", label: "Caja", content: <CashTab /> },
            { value: "libro", label: "Libro", content: <LedgerTab /> },
          ]}
        />
      </Card>
    </>
  );
}
