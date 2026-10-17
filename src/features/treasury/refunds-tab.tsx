"use client";

import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, Notice, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { Refund } from "@/domain/types";
import { useDemo } from "@/store";
import { memberName } from "@/store/engine";
import { advanceRefund, failRefund } from "@/store/commands/treasury";

const STEP: Record<Refund["status"], { label: string; tone: Tone; action?: string }> = {
  requested: { label: "Solicitada", tone: "warn", action: "Aprobar" },
  approved: { label: "Aprobada", tone: "brand", action: "Marcar enviada" },
  sent: { label: "Enviada, sin confirmar", tone: "warn", action: "Confirmar con evidencia" },
  confirmed: { label: "Confirmada", tone: "ok" },
  failed: { label: "Falló el envío", tone: "bad", action: "Reintentar envío" },
};

export function RefundsTab() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const canApprove = can(role, "refund.approve");

  const columns: Column<Refund>[] = [
    { header: "Cliente y motivo", cell: (r) => <div><p className="font-medium text-ink">{r.buyer}</p><p className="max-w-md text-[13px] text-muted">{r.reason}</p></div> },
    { header: "Solicitó", cell: (r) => `${memberName(data, r.requestedBy)}, ${formatDate(r.on)}`, hideBelow: "lg" },
    { header: "Estado", cell: (r) => <Badge tone={STEP[r.status].tone}>{STEP[r.status].label}</Badge> },
    { header: "Importe", align: "right", cell: (r) => <span className="font-medium text-ink">{formatCop(r.amount)}</span> },
    {
      header: "",
      align: "right",
      cell: (r) =>
        canApprove && STEP[r.status].action ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => run(advanceRefund, { refundId: r.id })}>{STEP[r.status].action}</Button>
            {r.status === "sent" && <Button size="sm" variant="ghost" onClick={() => run(failRefund, { refundId: r.id })}>Falló el banco</Button>}
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <Notice tone="brand" title="Anular no es devolver">Cuando se anula una venta, lo recibido queda como una obligación de devolver. Solo una devolución confirmada con evidencia reduce el efectivo o el banco.</Notice>
      <Card>
        <CardHeader title="Devoluciones" description="Solicitada, aprobada, enviada y confirmada: cada paso es un hecho distinto." />
        <DataTable caption="Devoluciones" columns={columns} rows={data.refunds} rowKey={(r) => r.id} empty={{ title: "No hay devoluciones", description: "Aparecen cuando anulas una venta con dinero recibido." }} />
      </Card>
    </div>
  );
}
