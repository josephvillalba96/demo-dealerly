"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/form";
import { Notice, Stat } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { formatCop, sum } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { Payment } from "@/domain/types";
import { useDemo } from "@/store";
import { confirmPayment, failPayment, replayWebhook } from "@/store/commands/treasury";
import { PaymentBadge, methodLabel } from "../shared/badges";

type Filter = "all" | "pending" | "confirmed";

export function PaymentsTab() {
  const payments = useDemo((s) => s.data.payments);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => [...payments].reverse().filter((p) => filter === "all" || p.status === filter), [payments, filter]);
  const pending = payments.filter((p) => p.direction === "in" && p.status === "pending");
  const todayIn = sum(payments.filter((p) => p.direction === "in" && p.status === "confirmed" && p.on === "2026-10-16").map((p) => p.amount));
  const canConfirm = can(role, "payment.confirm");

  const columns: Column<Payment>[] = [
    { header: "Concepto", cell: (p) => <div><p className="font-medium text-ink">{p.concept}</p><p className="num text-[13px] text-muted">{p.counterparty}, ref {p.ref}</p></div> },
    { header: "Sentido", cell: (p) => (p.direction === "in" ? "Entrada" : "Salida"), hideBelow: "lg" },
    { header: "Medio", cell: (p) => methodLabel(p.method), hideBelow: "md" },
    { header: "Fecha", cell: (p) => formatDate(p.on), hideBelow: "md" },
    { header: "Estado", cell: (p) => <PaymentBadge status={p.status} /> },
    { header: "Importe", align: "right", cell: (p) => <span className={p.direction === "out" ? "font-medium text-bad" : "font-medium text-ink"}>{p.direction === "out" ? "-" : ""}{formatCop(p.amount)}</span> },
    {
      header: "",
      align: "right",
      cell: (p) =>
        p.status === "pending" && canConfirm ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => run(confirmPayment, { paymentId: p.id })}>Confirmar</Button>
            <Button size="sm" variant="secondary" onClick={() => run(replayWebhook, { paymentId: p.id, times: 3 })}>Repetir evento x3</Button>
            <Button size="sm" variant="ghost" onClick={() => run(failPayment, { paymentId: p.id })}>Fallido</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Por confirmar" value={formatCop(sum(pending.map((p) => p.amount)))} hint={`${pending.length} movimientos esperando evidencia`} />
        <Stat label="Recaudo confirmado hoy" value={formatCop(todayIn)} hint="Solo dinero con evidencia válida" />
        <Stat label="Movimientos" value={String(payments.length)} hint="Entradas y salidas del libro de pagos" />
      </div>
      {!canConfirm && <Notice tone="warn">Tu rol puede ver los pagos pero no confirmarlos. Cambia a Tesorería o Administrador desde tu avatar.</Notice>}
      <div className="flex items-center justify-between">
        <Segmented label="Filtrar pagos" value={filter} onChange={setFilter} options={[{ value: "all", label: "Todos" }, { value: "pending", label: "Pendientes" }, { value: "confirmed", label: "Confirmados" }]} />
        <p className="text-[13px] text-muted">El botón &quot;Repetir evento x3&quot; simula que la pasarela reenvía el mismo evento.</p>
      </div>
      <div className="-mx-5">
        <DataTable caption="Pagos" columns={columns} rows={rows} rowKey={(p) => p.id} empty={{ title: "Sin pagos para este filtro" }} />
      </div>
    </div>
  );
}
