"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/surface";
import { formatCop } from "@/domain/money";
import { discountNeedsApproval, discountPct, FREE_DISCOUNT_PCT } from "@/domain/sales";
import { unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { createQuote } from "@/store/commands/sales";

export function QuoteDialog({ open, onOpenChange, presetUnitId }: { open: boolean; onOpenChange: (o: boolean) => void; presetUnitId?: string }) {
  const run = useDemo((s) => s.run);
  const units = useDemo((s) => s.data.units);
  const options = useMemo(() => units.filter((u) => u.status === "available"), [units]);
  const [unitId, setUnitId] = useState(presetUnitId ?? "");
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [phone, setPhone] = useState("");
  const [discount, setDiscount] = useState(0);

  const unit = options.find((u) => u.id === unitId);
  const needsApproval = unit ? discountNeedsApproval(unit.listPrice, discount) : false;

  const submit = () => {
    const r = run(createQuote, { unitId, buyer: { name, doc, phone }, discount });
    if (r.ok) {
      onOpenChange(false);
      setName("");
      setDoc("");
      setPhone("");
      setDiscount(0);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nueva cotización"
      description="Una cotización queda versionada: si cambias una condición aceptada, el comprador debe aceptar de nuevo."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!unitId || !name.trim() || !doc.trim()} onClick={submit}>
            Crear cotización
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Unidad">
          {(id) => (
            <Select id={id} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">Elige una unidad disponible</option>
              {options.map((u) => (
                <option key={u.id} value={u.id}>
                  {unitName(u)}, {u.plate}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre del comprador">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Documento">{(id) => <Input id={id} value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="1.045.332.776" />}</Field>
          <Field label="Teléfono" className="sm:col-span-2">
            {(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 000 0000" />}
          </Field>
        </div>
        {unit && (
          <>
            <Field label="Descuento" hint={`Hasta ${FREE_DISCOUNT_PCT} % no necesita aprobación.`}>
              {(id) => <MoneyInput id={id} value={discount} onChange={setDiscount} />}
            </Field>
            <dl className="grid grid-cols-3 gap-3 rounded-control bg-surface p-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Precio de lista</dt>
                <dd className="num mt-0.5 font-medium text-ink">{formatCop(unit.listPrice)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Descuento</dt>
                <dd className="num mt-0.5 font-medium text-ink">{discountPct(unit.listPrice, discount).toFixed(1)} %</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Total a pagar</dt>
                <dd className="num mt-0.5 font-semibold text-ink">{formatCop(unit.listPrice - discount)}</dd>
              </div>
            </dl>
            {needsApproval && <Notice tone="warn">Este descuento supera el {FREE_DISCOUNT_PCT} %: la cotización quedará pendiente hasta que un administrador lo apruebe.</Notice>}
          </>
        )}
      </div>
    </Dialog>
  );
}
