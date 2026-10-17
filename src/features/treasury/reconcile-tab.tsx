"use client";

import { useMemo } from "react";
import { Select } from "@/components/ui/form";
import { Badge, Card, CardHeader, Notice, Stat } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { reconcile } from "@/domain/treasury";
import type { BankLine } from "@/domain/types";
import { useDemo } from "@/store";
import { matchBankLine } from "@/store/commands/treasury";

export function ReconcileTab() {
  const lines = useDemo((s) => s.data.bankLines);
  const payments = useDemo((s) => s.data.payments);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const summary = reconcile(lines);
  const canReconcile = can(role, "reconcile");

  const candidates = useMemo(
    () => payments.filter((p) => p.direction === "in" && p.status === "confirmed" && p.method !== "cash" && !lines.some((l) => l.matchedPaymentId === p.id)),
    [payments, lines],
  );

  const columns: Column<BankLine>[] = [
    { header: "Movimiento del extracto", cell: (l) => <div><p className="font-medium text-ink">{l.description}</p><p className="text-[13px] text-muted">{formatDate(l.on)}</p></div> },
    { header: "Bruto", align: "right", cell: (l) => formatCop(l.gross) },
    { header: "Comisión real", align: "right", cell: (l) => formatCop(l.fee), hideBelow: "md" },
    { header: "Neto", align: "right", cell: (l) => <span className="font-medium text-ink">{formatCop(l.gross - l.fee)}</span> },
    {
      header: "Conciliación",
      cell: (l) => {
        if (l.matchedPaymentId) {
          const p = payments.find((x) => x.id === l.matchedPaymentId);
          return <div className="flex items-center gap-2"><Badge tone="ok">Conciliado</Badge><span className="num text-[13px] text-muted">{p?.ref}</span></div>;
        }
        if (!canReconcile) return <Badge tone="warn">Abierto</Badge>;
        return (
          <Select aria-label="Conectar con un pago" value="" onChange={(e) => e.target.value && run(matchBankLine, { lineId: l.id, paymentId: e.target.value })} className="h-8 w-56 text-[13px]">
            <option value="">Conectar con un pago</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>{p.counterparty}, {formatCop(p.amount)}</option>
            ))}
          </Select>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Stat label="Bruto del extracto" value={formatCop(summary.gross)} />
        <Stat label="Comisiones reales" value={formatCop(summary.fees)} hint="Salen del extracto, no de un porcentaje supuesto" />
        <Stat label="Neto recibido" value={formatCop(summary.net)} hint="Bruto menos comisiones" />
        <Stat label="Sin conciliar" value={String(summary.open)} tone={summary.open > 0 ? "bad" : undefined} hint={`${summary.matched} conciliados`} />
      </div>
      <Notice tone="brand">Una diferencia no se esconde: queda abierta con responsable hasta explicarla. Aquí las comisiones son las que cobró la pasarela, no una tarifa inventada.</Notice>
      <Card>
        <CardHeader title="Extracto bancario y de pasarela" />
        <DataTable caption="Extracto" columns={columns} rows={lines} rowKey={(l) => l.id} />
      </Card>
    </div>
  );
}
