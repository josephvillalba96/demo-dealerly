"use client";

import { Plus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Field, Input, MoneyInput, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { BranchId, Part } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";
import { adjustStock, createPart } from "@/store/commands/workshop";

const KIND = { car: "Carro", motorcycle: "Moto", both: "Carro y moto" } as const;

export function CatalogTab({ enabled }: { enabled: boolean }) {
  const parts = useDemo((s) => s.data.parts);
  const stock = useDemo((s) => s.data.stock);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [text, setText] = useState("");
  const [adjusting, setAdjusting] = useState<Part | null>(null);
  const [branch, setBranch] = useState<BranchId>("norte");
  const [counted, setCounted] = useState(0);
  const [loss, setLoss] = useState(true);
  const [reason, setReason] = useState("Conteo físico");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ ref: "", oem: "", description: "", compat: "", kind: "car" as Part["kind"], salePrice: 0 });
  const canWrite = can(role, "parts.write") && enabled;

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return parts.filter((p) => !q || `${p.ref} ${p.oem} ${p.description} ${p.compat}`.toLowerCase().includes(q));
  }, [parts, text]);

  const level = (partId: string, b: BranchId) => stock.find((s) => s.partId === partId && s.branchId === b);
  const qty = (n: number | undefined) => (n === undefined ? <span className="text-muted">0</span> : <span className={n <= 3 ? "font-medium text-warn" : "text-ink"}>{n}</span>);

  const columns: Column<Part>[] = [
    { header: "Repuesto", cell: (p) => <div><p className="font-medium text-ink">{p.description}</p><p className="num text-[13px] text-muted">{p.ref}, OEM {p.oem}</p></div> },
    { header: "Compatible con", cell: (p) => <span className="line-clamp-2 max-w-xs text-[13px]">{p.compat}</span>, hideBelow: "lg" },
    { header: "Tipo", cell: (p) => <Badge>{KIND[p.kind]}</Badge>, hideBelow: "md" },
    { header: "Norte", align: "right", cell: (p) => qty(level(p.id, "norte")?.onHand) },
    { header: "Centro", align: "right", cell: (p) => qty(level(p.id, "centro")?.onHand) },
    { header: "Costo prom.", align: "right", cell: (p) => formatCop(level(p.id, "norte")?.avgCost ?? level(p.id, "centro")?.avgCost ?? 0), hideBelow: "lg" },
    { header: "Precio", align: "right", cell: (p) => <span className="font-medium text-ink">{formatCop(p.salePrice)}</span> },
    { header: "", align: "right", cell: (p) => (canWrite ? <Button size="sm" variant="ghost" onClick={() => { setAdjusting(p); setCounted(level(p.id, branch)?.onHand ?? 0); }}>Ajustar</Button> : null) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Input aria-label="Buscar repuesto" value={text} onChange={(e) => setText(e.target.value)} placeholder="Referencia, OEM o compatibilidad" className="w-72" />
        {canWrite && <Button icon={<Plus size={16} weight="bold" />} onClick={() => setCreating(true)}>Nuevo repuesto</Button>}
      </div>
      <div className="-mx-5"><DataTable caption="Catálogo de repuestos" columns={columns} rows={rows} rowKey={(p) => p.id} empty={{ title: "Ningún repuesto coincide" }} /></div>
      <p className="text-[13px] text-muted">Las existencias en amarillo son de tres unidades o menos.</p>

      <Dialog
        open={Boolean(adjusting)}
        onOpenChange={(o) => !o && setAdjusting(null)}
        title={`Ajustar existencia: ${adjusting?.description ?? ""}`}
        description="El conteo físico se explica con un movimiento. El sistema nunca cambia el saldo en silencio."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjusting(null)}>Cancelar</Button>
            <Button onClick={() => { if (!adjusting) return; const r = run(adjustStock, { partId: adjusting.id, branchId: branch, counted, loss, reason }); if (r.ok) setAdjusting(null); }}>Registrar ajuste</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sede">{(id) => <Select id={id} value={branch} onChange={(e) => { const b = e.target.value as BranchId; setBranch(b); if (adjusting) setCounted(level(adjusting.id, b)?.onHand ?? 0); }}><option value="norte">{BRANCH_NAMES.norte}</option><option value="centro">{BRANCH_NAMES.centro}</option></Select>}</Field>
            <Field label="Cantidad contada" hint={adjusting ? `El sistema dice ${level(adjusting.id, branch)?.onHand ?? 0}` : undefined}>{(id) => <Input id={id} type="number" min={0} value={counted} onChange={(e) => setCounted(Number(e.target.value))} />}</Field>
          </div>
          <Field label="Motivo">{(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <Check checked={loss} onChange={setLoss}>Si falta, registrar como merma o avería</Check>
        </div>
      </Dialog>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="Nuevo repuesto"
        description="La referencia debe ser única en tu catálogo."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(createPart, form); if (r.ok) { setCreating(false); setForm({ ref: "", oem: "", description: "", compat: "", kind: "car", salePrice: 0 }); } }}>Crear repuesto</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Referencia interna">{(id) => <Input id={id} value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="FIL-ACE-002" />}</Field>
          <Field label="Número OEM">{(id) => <Input id={id} value={form.oem} onChange={(e) => setForm({ ...form, oem: e.target.value })} />}</Field>
          <Field label="Descripción" className="sm:col-span-2">{(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
          <Field label="Compatible con" className="sm:col-span-2">{(id) => <Input id={id} value={form.compat} onChange={(e) => setForm({ ...form, compat: e.target.value })} placeholder="Marcas, líneas y años" />}</Field>
          <Field label="Tipo de vehículo">{(id) => <Select id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Part["kind"] })}><option value="car">Carro</option><option value="motorcycle">Moto</option><option value="both">Carro y moto</option></Select>}</Field>
          <Field label="Precio de venta">{(id) => <MoneyInput id={id} value={form.salePrice} onChange={(v) => setForm({ ...form, salePrice: v })} />}</Field>
        </div>
      </Dialog>
    </div>
  );
}
