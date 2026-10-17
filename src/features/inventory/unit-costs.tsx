"use client";

import { Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Field, Input, MoneyInput } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, Notice, Stat } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { confirmedCost, estimatedMargin, pendingCost } from "@/domain/inventory";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { Unit, UnitCost } from "@/domain/types";
import { canSeeCosts } from "@/lib/format";
import { useDemo } from "@/store";
import { addCost, confirmCost } from "@/store/commands/inventory";

const SOURCE: Record<UnitCost["source"], string> = { acquisition: "Compra", transport: "Traslado y trámites", work_order: "Taller", other: "Otro" };

export function UnitCosts({ unit }: { unit: Unit }) {
  const run = useDemo((s) => s.run);
  const role = useDemo((s) => s.session.role);
  const all = useDemo((s) => s.data.costs);
  const costs = useMemo(() => all.filter((c) => c.unitId === unit.id), [all, unit.id]);
  const [open, setOpen] = useState(false);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState(0);
  const [supported, setSupported] = useState(true);

  if (!canSeeCosts(role)) {
    return <Notice tone="neutral" title="Costos y margen reservados">Tu rol no ve costos de compra ni margen. En el producto real el servidor no los envía al navegador.</Notice>;
  }

  const total = confirmedCost(all, unit.id);
  const pending = pendingCost(all, unit.id);
  const margin = estimatedMargin(unit, all);
  const columns: Column<UnitCost>[] = [
    { header: "Concepto", cell: (c) => <span className="font-medium text-ink">{c.concept}</span> },
    { header: "Origen", cell: (c) => SOURCE[c.source], hideBelow: "md" },
    { header: "Fecha", cell: (c) => formatDate(c.date), hideBelow: "md" },
    { header: "Estado", cell: (c) => (c.status === "confirmed" ? <Badge tone="ok">Con soporte</Badge> : <Badge tone="warn">Pendiente de soporte</Badge>) },
    { header: "Importe", align: "right", cell: (c) => <span className={c.amount < 0 ? "text-bad" : "text-ink"}>{formatCop(c.amount)}</span> },
    {
      header: "",
      align: "right",
      cell: (c) =>
        c.status === "pending" && can(role, "inventory.write") ? (
          <Button size="sm" variant="secondary" onClick={() => run(confirmCost, { costId: c.id })}>
            Confirmar con soporte
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Costo confirmado" value={formatCop(total)} hint="Compra, traslado y taller con soporte" />
        <Stat label="Margen estimado" value={formatCop(margin)} hint={`Precio de lista ${formatCop(unit.listPrice)}`} />
        <Stat label="Pendiente de soporte" value={formatCop(pending)} hint="No suma al margen hasta tener documento" />
      </div>
      <Card>
        <CardHeader
          title="Costos atribuibles a la unidad"
          description="El margen se reproduce desde estos movimientos. El costo de taller entra solo cuando se consume."
          action={
            can(role, "inventory.write") && (
              <Button size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setOpen(true)}>
                Agregar costo
              </Button>
            )
          }
        />
        <DataTable caption="Costos de la unidad" columns={columns} rows={costs} rowKey={(c) => c.id} empty={{ title: "Sin costos registrados" }} />
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Agregar costo"
        description="Un costo sin documento queda pendiente y no se mezcla con el margen confirmado."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                const r = run(addCost, { unitId: unit.id, concept, amount, supported });
                if (r.ok) {
                  setOpen(false);
                  setConcept("");
                  setAmount(0);
                }
              }}
            >
              Guardar costo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Concepto">{(id) => <Input id={id} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ejemplo: Pulida y detallado" />}</Field>
          <Field label="Importe">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
          <Check checked={supported} onChange={setSupported}>
            Tengo el soporte (factura o recibo)
          </Check>
        </div>
      </Dialog>
    </div>
  );
}
