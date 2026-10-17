"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Segmented, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Notice } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { formatCop, sum } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { BranchId, PurchaseInvoice } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";
import { receivePurchase } from "@/store/commands/workshop";

interface DraftLine {
  partId: string;
  qty: number;
  unitCost: number;
}

export function PurchasesTab({ enabled }: { enabled: boolean }) {
  const purchases = useDemo((s) => s.data.purchases);
  const parts = useDemo((s) => s.data.parts);
  const obligations = useDemo((s) => s.data.obligations);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [number, setNumber] = useState("");
  const [branch, setBranch] = useState<BranchId>("norte");
  const [terms, setTerms] = useState<"cash" | "credit">("credit");
  const [lines, setLines] = useState<DraftLine[]>([{ partId: "", qty: 1, unitCost: 0 }]);
  const canWrite = can(role, "parts.write") && enabled;
  const total = sum(lines.map((l) => l.qty * l.unitCost));

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const columns: Column<PurchaseInvoice>[] = [
    { header: "Factura", cell: (p) => <div><p className="font-medium text-ink">{p.supplier}</p><p className="num text-[13px] text-muted">{p.number}, {BRANCH_NAMES[p.branchId]}</p></div> },
    { header: "Fecha", cell: (p) => formatDate(p.on), hideBelow: "md" },
    { header: "Condición", cell: (p) => (p.terms === "credit" ? <Badge tone="warn">A crédito</Badge> : <Badge tone="ok">De contado</Badge>) },
    { header: "Cuenta por pagar", cell: (p) => { const o = obligations.find((x) => x.id === p.obligationId); return o ? (o.outstanding === 0 ? <Badge tone="ok">Saldada</Badge> : <span className="num">{formatCop(o.outstanding)} pendiente</span>) : <span className="text-muted">No aplica</span>; }, hideBelow: "lg" },
    { header: "Total", align: "right", cell: (p) => <span className="font-medium text-ink">{formatCop(sum(p.lines.map((l) => l.qty * l.unitCost)))}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Notice tone="brand">Comprar a crédito deja una cuenta por pagar. Marcarla como pagada exige un pago real desde Tesorería.</Notice>
        {canWrite && <Button icon={<Plus size={16} weight="bold" />} onClick={() => setOpen(true)}>Registrar compra</Button>}
      </div>
      <div className="-mx-5"><DataTable caption="Compras de repuestos" columns={columns} rows={[...purchases].reverse()} rowKey={(p) => p.id} empty={{ title: "Sin compras" }} /></div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Registrar compra de repuestos"
        description="Cada entrada recalcula el costo promedio ponderado por sede."
        width="lg"
        footer={
          <>
            <span className="num mr-auto text-sm text-muted">Total {formatCop(total)}</span>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                const r = run(receivePurchase, { supplier, number, branchId: branch, terms, lines: lines.filter((l) => l.partId) });
                if (r.ok) { setOpen(false); setSupplier(""); setNumber(""); setLines([{ partId: "", qty: 1, unitCost: 0 }]); }
              }}
            >
              Registrar compra
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Proveedor">{(id) => <Input id={id} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Autopartes del Caribe S.A.S." />}</Field>
            <Field label="Número de factura">{(id) => <Input id={id} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="AP-48300" />}</Field>
            <Field label="Sede que recibe">{(id) => <Select id={id} value={branch} onChange={(e) => setBranch(e.target.value as BranchId)}><option value="norte">{BRANCH_NAMES.norte}</option><option value="centro">{BRANCH_NAMES.centro}</option></Select>}</Field>
          </div>
          <Segmented label="Condición de pago" value={terms} onChange={setTerms} options={[{ value: "credit", label: "A crédito" }, { value: "cash", label: "De contado" }]} />
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_6rem_minmax(0,1fr)_auto]">
                <Field label={i === 0 ? "Repuesto" : `Repuesto ${i + 1}`}>{(id) => <Select id={id} value={l.partId} onChange={(e) => setLine(i, { partId: e.target.value })}><option value="">Elige un repuesto</option>{parts.map((p) => <option key={p.id} value={p.id}>{p.description}</option>)}</Select>}</Field>
                <Field label="Cantidad">{(id) => <Input id={id} type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />}</Field>
                <Field label="Costo unitario">{(id) => <MoneyInput id={id} value={l.unitCost} onChange={(v) => setLine(i, { unitCost: v })} />}</Field>
                <Button variant="ghost" size="sm" aria-label="Quitar línea" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}><Trash size={16} /></Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setLines((ls) => [...ls, { partId: "", qty: 1, unitCost: 0 }])}>Agregar línea</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
