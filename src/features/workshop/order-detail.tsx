"use client";

import { ArrowLeft, ArrowRight, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, EmptyState, Notice, Stat } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { confirmedCost } from "@/domain/inventory";
import { formatCop, roundCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { nextWorkStatus, orderCost, pendingOrderCost, WORK_FLOW, WORK_LABELS } from "@/domain/workshop";
import type { WorkLine } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { cn } from "@/lib/cn";
import { unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { memberName } from "@/store/engine";
import { addWorkLine, advanceWorkOrder, cancelWorkOrder, consumeLine, reverseLine } from "@/store/commands/workshop";
import { stockOf, unitById } from "@/store/queries";
import { WorkBadge } from "../shared/badges";
import { UnitMark } from "../shared/unit-chip";

const LINE_STATUS = { pending: { label: "Pendiente", tone: "warn" }, confirmed: { label: "Consumida", tone: "ok" }, reversed: { label: "Revertida", tone: "neutral" } } as const;

export function OrderDetail({ orderId }: { orderId: string }) {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"part" | "labor">("part");
  const [partId, setPartId] = useState("");
  const [qty, setQty] = useState(1);
  const [desc, setDesc] = useState("Mano de obra mecánica");
  const [rate, setRate] = useState(45_000);

  const order = data.workOrders.find((o) => o.id === orderId);
  if (!order) {
    return (
      <Card>
        <EmptyState title="No encontramos esa orden" action={<Link href="/taller"><Button variant="secondary">Volver al taller</Button></Link>} />
      </Card>
    );
  }
  const unit = unitById(data, order.unitId);
  const consumed = orderCost(order);
  const pending = pendingOrderCost(order);
  const canWrite = can(role, "workshop.write");
  const finished = order.status === "done" || order.status === "cancelled";
  const next = nextWorkStatus(order.status);
  const unitCostTotal = unit ? confirmedCost(data.costs, unit.id) : 0;
  const margin = unit ? unit.listPrice - unitCostTotal : 0;
  const parts = data.parts.filter((p) => p.kind === "both" || p.kind === unit?.kind);
  const lineAmount = (l: WorkLine) => formatCop(roundCop(l.qty * l.unitCost));

  const columns: Column<WorkLine>[] = [
    { header: "Concepto", cell: (l) => <div><p className="font-medium text-ink">{l.description}</p><p className="text-[13px] text-muted">{l.kind === "part" ? "Repuesto" : "Mano de obra"}</p></div> },
    { header: "Cantidad", align: "right", cell: (l) => (l.kind === "labor" ? `${l.qty} h` : String(l.qty)), hideBelow: "md" },
    { header: "Costo unitario", align: "right", cell: (l) => formatCop(l.unitCost), hideBelow: "md" },
    { header: "Total", align: "right", cell: (l) => <span className="font-medium text-ink">{lineAmount(l)}</span> },
    { header: "Estado", cell: (l) => <Badge tone={LINE_STATUS[l.status].tone}>{LINE_STATUS[l.status].label}</Badge> },
    {
      header: "",
      align: "right",
      cell: (l) =>
        canWrite && !finished ? (
          l.status === "pending" ? (
            <Button size="sm" onClick={() => run(consumeLine, { orderId: order.id, lineId: l.id })}>Consumir</Button>
          ) : l.status === "confirmed" ? (
            <Button size="sm" variant="ghost" onClick={() => run(reverseLine, { orderId: order.id, lineId: l.id })}>Revertir</Button>
          ) : null
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/taller" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Taller
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {unit && <UnitMark unit={unit} size="lg" />}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-ink">{order.number}</h2>
                <WorkBadge status={order.status} />
              </div>
              <p className="mt-1 text-sm text-ink-soft">{unit ? unitName(unit) : ""}</p>
              <p className="text-[13px] text-muted">{order.bay}, {BRANCH_NAMES[order.branchId]}, técnico {memberName(data, order.technicianId)}</p>
            </div>
          </div>
          {canWrite && !finished && (
            <div className="flex gap-2">
              {next && <Button icon={<ArrowRight size={16} weight="bold" />} onClick={() => run(advanceWorkOrder, { orderId: order.id })}>Pasar a {WORK_LABELS[next].toLowerCase()}</Button>}
              <Button variant="ghost" onClick={() => run(cancelWorkOrder, { orderId: order.id })}>Cancelar orden</Button>
            </div>
          )}
        </div>
        <ol className="mt-6 flex flex-wrap gap-2" aria-label="Estados de la orden">
          {WORK_FLOW.map((st, i) => {
            const idx = WORK_FLOW.indexOf(order.status);
            return (
              <li key={st} className={cn("rounded-full px-3 py-1 text-xs font-medium", i < idx || order.status === "done" ? "bg-ok-bg text-ok" : st === order.status ? "bg-brand-500 text-white" : "bg-surface text-muted")}>
                {WORK_LABELS[st]}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-sm text-ink-soft">{order.description}</p>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Consumido en esta orden" value={formatCop(consumed)} hint="Repuestos y mano de obra confirmados" />
        <Stat label="Pendiente de consumir" value={formatCop(pending)} hint="Aún no suma al costo de la unidad" />
        <Stat label="Presupuesto" value={order.budget ? formatCop(order.budget) : "Sin definir"} tone={order.budget && consumed + pending > order.budget ? "bad" : undefined} hint={order.budget && consumed + pending > order.budget ? "Superado por lo consumido y pendiente" : "Comparado contra el consumo"} />
        <Stat label="Margen estimado de la unidad" value={formatCop(margin)} hint={`Costo confirmado total ${formatCop(unitCostTotal)}`} />
      </div>

      <Card>
        <CardHeader
          title="Líneas de la orden"
          description="Consumir es un solo hecho: descuenta el kardex, suma al costo de la unidad y asienta el libro. Si falla una parte, no se confirma nada."
          action={canWrite && !finished && <Button size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setOpen(true)}>Agregar línea</Button>}
        />
        <DataTable caption="Líneas de la orden" columns={columns} rows={order.lines} rowKey={(l) => l.id} empty={{ title: "Aún no hay líneas", description: "Agrega repuestos o mano de obra." }} />
      </Card>
      {unit && <Notice tone="brand">El costo de esta orden ya forma parte del expediente de {unitName(unit)}. <Link href={`/inventario/${unit.id}`} className="font-semibold text-brand-700 hover:underline">Ver costos y margen de la unidad</Link></Notice>}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Agregar línea"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(addWorkLine, kind === "part" ? { orderId: order.id, kind, description: "", partId, qty } : { orderId: order.id, kind, description: desc, qty, unitCost: rate }); if (r.ok) setOpen(false); }}>Agregar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented label="Tipo de línea" value={kind} onChange={setKind} options={[{ value: "part", label: "Repuesto" }, { value: "labor", label: "Mano de obra" }]} />
          {kind === "part" ? (
            <>
              <Field label="Repuesto del catálogo">
                {(id) => (
                  <Select id={id} value={partId} onChange={(e) => setPartId(e.target.value)}>
                    <option value="">Elige un repuesto</option>
                    {parts.map((p) => {
                      const level = stockOf(data, p.id, order.branchId);
                      return <option key={p.id} value={p.id}>{p.description}, existen {level?.onHand ?? 0} en {BRANCH_NAMES[order.branchId]}</option>;
                    })}
                  </Select>
                )}
              </Field>
              <Field label="Cantidad">{(id) => <Input id={id} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />}</Field>
            </>
          ) : (
            <>
              <Field label="Descripción">{(id) => <Input id={id} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Horas">{(id) => <Input id={id} type="number" min={0.5} step={0.5} value={qty} onChange={(e) => setQty(Number(e.target.value))} />}</Field>
                <Field label="Tarifa por hora">{(id) => <Input id={id} type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />}</Field>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
