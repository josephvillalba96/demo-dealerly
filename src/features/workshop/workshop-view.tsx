"use client";

import { Plus, Wrench } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Card, Notice, PageIntro } from "@/components/ui/surface";
import { hasModule } from "@/domain/entitlements";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { orderCost, pendingOrderCost } from "@/domain/workshop";
import type { BranchId, WorkOrder, WorkStatus } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { cn } from "@/lib/cn";
import { unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { memberName } from "@/store/engine";
import { advanceWorkOrder, openWorkOrder } from "@/store/commands/workshop";
import { unitById } from "@/store/queries";
import { WorkBadge } from "../shared/badges";
import { UnitMark } from "../shared/unit-chip";

const COLUMNS: { title: string; statuses: WorkStatus[] }[] = [
  { title: "Recibida y diagnóstico", statuses: ["received", "diagnosis"] },
  { title: "Aprobada", statuses: ["approved"] },
  { title: "En trabajo", statuses: ["in_progress"] },
  { title: "Control de calidad", statuses: ["quality"] },
  { title: "Terminada", statuses: ["done"] },
];

const BAYS = ["Bahía 1", "Bahía 2", "Bahía 3", "Bahía 4"];

function OrderCard({ order, onAdvance, canWrite }: { order: WorkOrder; onAdvance: () => void; canWrite: boolean }) {
  const data = useDemo((s) => s.data);
  const unit = unitById(data, order.unitId);
  const consumed = orderCost(order);
  const pending = pendingOrderCost(order);
  const overBudget = order.budget > 0 && consumed + pending > order.budget;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {unit && <UnitMark unit={unit} />}
        <div className="min-w-0 flex-1">
          <Link href={`/taller/${order.id}`} className="block truncate text-sm font-semibold text-ink hover:text-brand-700">
            {order.number}, {unit ? unitName(unit) : ""}
          </Link>
          <p className="num text-[13px] text-muted">{order.bay}, {BRANCH_NAMES[order.branchId]}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-[13px] text-ink-soft">{order.description}</p>
      <div className="num mt-3 flex justify-between text-[13px]">
        <span className="text-muted">Consumido</span>
        <span className={cn("font-medium", overBudget ? "text-bad" : "text-ink")}>{formatCop(consumed)}</span>
      </div>
      {pending > 0 && <p className="num mt-0.5 flex justify-between text-[13px] text-warn"><span>Pendiente de consumir</span><span>{formatCop(pending)}</span></p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted">{memberName(data, order.technicianId)}</span>
        {canWrite && order.status !== "done" && order.status !== "cancelled" && (
          <Button size="sm" variant="secondary" onClick={onAdvance}>
            Avanzar
          </Button>
        )}
      </div>
    </Card>
  );
}

export function WorkshopView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const params = useSearchParams();
  // Si llegamos desde el expediente de una unidad (?nueva=ID), abrimos la orden con esa unidad.
  const [open, setOpen] = useState(() => Boolean(params.get("nueva")));
  const [unitId, setUnitId] = useState(() => params.get("nueva") ?? "");
  const [branchId, setBranchId] = useState<BranchId>("norte");
  const [bay, setBay] = useState("Bahía 1");
  const [techId, setTechId] = useState("m-luis");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(0);


  const enabled = hasModule(data.subscription, "workshop");
  const canWrite = can(role, "workshop.write") && enabled;
  const techs = data.members.filter((m) => m.role === "taller" && m.status !== "revoked");
  const eligible = useMemo(() => data.units.filter((u) => u.ownership === "owned" && !["sold", "delivered", "withdrawn"].includes(u.status) && !data.workOrders.some((w) => w.unitId === u.id && !["done", "cancelled"].includes(w.status))), [data.units, data.workOrders]);
  const openOrders = data.workOrders.filter((w) => !["done", "cancelled"].includes(w.status));

  return (
    <>
      <PageIntro actions={canWrite && <Button icon={<Plus size={16} weight="bold" />} onClick={() => setOpen(true)}>Nueva orden</Button>}>
        El taller reacondiciona los carros y motos del patio. Cada repuesto y cada hora de mano de obra se suman al costo de la unidad, así el margen es el real.
      </PageIntro>
      {!enabled && <div className="mb-6"><Notice tone="warn" title="Taller no incluido en tu plan">Puedes consultar lo existente. Actívalo como complemento en Plan y módulos para crear órdenes.</Notice></div>}

      <Card className="mb-6 p-5">
        <h2 className="text-[15px] font-semibold text-ink">Bahías</h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {BAYS.map((b) => {
            const order = openOrders.find((o) => o.bay === b);
            const unit = order ? unitById(data, order.unitId) : undefined;
            return (
              <li key={b} className={cn("rounded-control border p-3.5", order ? "border-brand-200 bg-brand-50" : "border-dashed border-line-strong")}>
                <p className="flex items-center gap-2 text-[13px] font-semibold text-ink"><Wrench size={15} className={order ? "text-brand-500" : "text-muted"} />{b}</p>
                <p className="mt-1 text-[13px] text-muted">{order && unit ? `${order.number}, ${unit.make} ${unit.model}` : "Libre"}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex gap-4 overflow-x-auto pb-3">
        {COLUMNS.map((col) => {
          const orders = data.workOrders.filter((o) => col.statuses.includes(o.status));
          return (
            <section key={col.title} aria-label={col.title} className="w-[17rem] min-w-[17rem] flex-1 rounded-card bg-surface p-3">
              <h3 className="mb-3 flex items-center justify-between px-1 text-[13px] font-semibold text-ink-soft">
                {col.title}
                <span className="num rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{orders.length}</span>
              </h3>
              <div className="space-y-3">
                {orders.map((o) => (
                  <div key={o.id}>
                    <div className="mb-1.5 px-1"><WorkBadge status={o.status} /></div>
                    <OrderCard order={o} canWrite={canWrite} onAdvance={() => run(advanceWorkOrder, { orderId: o.id })} />
                  </div>
                ))}
                {orders.length === 0 && <p className="px-1 py-6 text-center text-[13px] text-muted">Sin órdenes</p>}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Nueva orden de reacondicionamiento"
        description="Mientras la unidad está en taller, su anuncio queda pausado."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(openWorkOrder, { unitId, branchId, bay, technicianId: techId, description, budget }); if (r.ok) { setOpen(false); setDescription(""); setBudget(0); } }}>Crear orden</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Unidad">
            {(id) => (
              <Select id={id} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Elige una unidad propia</option>
                {eligible.map((u) => <option key={u.id} value={u.id}>{unitName(u)}, {u.plate}</option>)}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Sede">{(id) => <Select id={id} value={branchId} onChange={(e) => setBranchId(e.target.value as BranchId)}><option value="norte">{BRANCH_NAMES.norte}</option><option value="centro">{BRANCH_NAMES.centro}</option></Select>}</Field>
            <Field label="Bahía">{(id) => <Select id={id} value={bay} onChange={(e) => setBay(e.target.value)}>{BAYS.map((b) => <option key={b}>{b}</option>)}</Select>}</Field>
            <Field label="Técnico">{(id) => <Select id={id} value={techId} onChange={(e) => setTechId(e.target.value)}>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>}</Field>
          </div>
          <Field label="Trabajo solicitado">{(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ejemplo: Cambio de pastillas y alineación." />}</Field>
          <Field label="Presupuesto" hint="Opcional. Se compara contra lo consumido.">{(id) => <MoneyInput id={id} value={budget} onChange={setBudget} />}</Field>
        </div>
      </Dialog>
    </>
  );
}
