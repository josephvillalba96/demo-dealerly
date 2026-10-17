"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { formatCop, sum } from "@/domain/money";
import { can } from "@/domain/rbac";
import { METHOD_LABELS } from "@/domain/treasury";
import type { BranchId, CounterSale, PayMethod } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";
import { counterSale } from "@/store/commands/workshop";
import { stockOf } from "@/store/queries";
import { PaymentBadge } from "../shared/badges";

export function CounterTab({ enabled }: { enabled: boolean }) {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [branch, setBranch] = useState<BranchId>("norte");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [lines, setLines] = useState([{ partId: "", qty: 1 }]);
  const canWrite = can(role, "parts.write") && enabled;
  const total = sum(lines.map((l) => (data.parts.find((p) => p.id === l.partId)?.salePrice ?? 0) * l.qty));

  const columns: Column<CounterSale>[] = [
    { header: "Venta", cell: (c) => <div><p className="font-medium text-ink">{c.number}</p><p className="text-[13px] text-muted">{c.customer}, {BRANCH_NAMES[c.branchId]}</p></div> },
    { header: "Fecha", cell: (c) => formatDate(c.on), hideBelow: "md" },
    { header: "Repuestos", cell: (c) => c.lines.map((l) => `${l.qty} x ${data.parts.find((p) => p.id === l.partId)?.description ?? ""}`).join(", "), hideBelow: "lg" },
    { header: "Cobro", cell: (c) => { const p = data.payments.find((x) => x.id === c.paymentId); return p ? <PaymentBadge status={p.status} /> : <Badge>Sin cobro</Badge>; } },
    { header: "Total", align: "right", cell: (c) => <span className="font-medium text-ink">{formatCop(sum(c.lines.map((l) => l.qty * l.unitPrice)))}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Venta de repuestos a terceros fuera de una compraventa de vehículo. Sale del kardex al costo promedio y el cobro lo confirma Tesorería.</p>
        {canWrite && <Button icon={<Plus size={16} weight="bold" />} onClick={() => setOpen(true)}>Nueva venta de mostrador</Button>}
      </div>
      <div className="-mx-5"><DataTable caption="Ventas de mostrador" columns={columns} rows={[...data.counterSales].reverse()} rowKey={(c) => c.id} empty={{ title: "Sin ventas de mostrador" }} /></div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Venta de mostrador"
        description="Elige los repuestos. Si no hay existencia en la sede, no se vende."
        width="lg"
        footer={
          <>
            <span className="num mr-auto text-sm text-muted">Total {formatCop(total)}</span>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(counterSale, { customer, branchId: branch, method, lines: lines.filter((l) => l.partId), confirmNow: true }); if (r.ok) { setOpen(false); setLines([{ partId: "", qty: 1 }]); setCustomer(""); } }}>Registrar venta</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Cliente">{(id) => <Input id={id} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Consumidor final" />}</Field>
            <Field label="Sede">{(id) => <Select id={id} value={branch} onChange={(e) => setBranch(e.target.value as BranchId)}><option value="norte">{BRANCH_NAMES.norte}</option><option value="centro">{BRANCH_NAMES.centro}</option></Select>}</Field>
            <Field label="Medio de pago">{(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{(["cash", "nequi", "pse", "card", "transfer"] as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}</Select>}</Field>
          </div>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_6rem_auto]">
                <Field label={i === 0 ? "Repuesto" : `Repuesto ${i + 1}`}>
                  {(id) => (
                    <Select id={id} value={l.partId} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, partId: e.target.value } : x)))}>
                      <option value="">Elige un repuesto</option>
                      {data.parts.map((p) => <option key={p.id} value={p.id}>{p.description}, {formatCop(p.salePrice)}, hay {stockOf(data, p.id, branch)?.onHand ?? 0}</option>)}
                    </Select>
                  )}
                </Field>
                <Field label="Cantidad">{(id) => <Input id={id} type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, idx) => (idx === i ? { ...x, qty: Number(e.target.value) } : x)))} />}</Field>
                <Button variant="ghost" size="sm" aria-label="Quitar línea" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}><Trash size={16} /></Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setLines((ls) => [...ls, { partId: "", qty: 1 }])}>Agregar repuesto</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
