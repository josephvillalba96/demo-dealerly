"use client";

import { ArrowLeft, ArrowRight, Check } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Segmented, Select } from "@/components/ui/form";
import { Card, Notice } from "@/components/ui/surface";
import { formatCop } from "@/domain/money";
import type { BranchId, VehicleKind } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store";
import { createUnit } from "@/store/commands/inventory";

const STEPS = ["Vehículo", "Compra", "Revisión"];

export function NewUnitWizard() {
  const run = useDemo((s) => s.run);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<VehicleKind>("car");
  const [form, setForm] = useState({ make: "", model: "", trim: "", year: 2021, km: 0, plate: "", vin: "", color: "Gris", branchId: "norte" as BranchId });
  const [listPrice, setListPrice] = useState(0);
  const [acquisitionCost, setAcquisitionCost] = useState(0);
  const [supplier, setSupplier] = useState("");

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const stepOneValid = form.make.trim() && form.model.trim() && form.vin.trim().length >= 8 && form.plate.trim();
  const stepTwoValid = listPrice > 0 && acquisitionCost > 0 && supplier.trim();

  const submit = () => {
    const r = run(createUnit, { kind, ...form, listPrice, acquisitionCost, supplier });
    if (r.ok && r.value) router.push(`/inventario/${r.value}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/inventario" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Inventario
      </Link>

      <ol className="flex items-center gap-3" aria-label="Pasos">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-3" aria-current={i === step ? "step" : undefined}>
            <span className={cn("num grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold", i < step ? "bg-ok text-white" : i === step ? "bg-brand-500 text-white" : "bg-surface text-muted")}>
              {i < step ? <Check size={14} weight="bold" /> : i + 1}
            </span>
            <span className={cn("text-sm font-medium", i === step ? "text-ink" : "text-muted")}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </li>
        ))}
      </ol>

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Datos del vehículo</h2>
              <p className="mt-0.5 text-sm text-muted">Cada unidad se identifica por su VIN. El tipo define la plantilla de fotos.</p>
            </div>
            <Segmented
              label="Tipo de vehículo"
              value={kind}
              onChange={setKind}
              options={[
                { value: "car", label: "Carro" },
                { value: "motorcycle", label: "Moto" },
              ]}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Marca">{(id) => <Input id={id} value={form.make} onChange={(e) => set("make", e.target.value)} placeholder="Mazda" />}</Field>
              <Field label="Línea">{(id) => <Input id={id} value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="CX-30" />}</Field>
              <Field label="Versión">{(id) => <Input id={id} value={form.trim} onChange={(e) => set("trim", e.target.value)} placeholder="Touring" />}</Field>
              <Field label="Año">{(id) => <Input id={id} type="number" value={form.year} onChange={(e) => set("year", Number(e.target.value))} />}</Field>
              <Field label="Kilometraje declarado" hint="Es lo que dice el vendedor, no un diagnóstico.">
                {(id) => <Input id={id} type="number" value={form.km || ""} onChange={(e) => set("km", Number(e.target.value))} placeholder="0" />}
              </Field>
              <Field label="Color">{(id) => <Input id={id} value={form.color} onChange={(e) => set("color", e.target.value)} />}</Field>
              <Field label="Placa">{(id) => <Input id={id} value={form.plate} onChange={(e) => set("plate", e.target.value)} placeholder="ABC 123" />}</Field>
              <Field label="VIN o número de chasis" className="sm:col-span-2" hint="Mínimo 8 caracteres. Una unidad activa no puede repetir VIN.">
                {(id) => <Input id={id} value={form.vin} onChange={(e) => set("vin", e.target.value)} placeholder="9BWZZZ377VT004251" />}
              </Field>
              <Field label="Sede donde queda">
                {(id) => (
                  <Select id={id} value={form.branchId} onChange={(e) => set("branchId", e.target.value as BranchId)}>
                    <option value="norte">{BRANCH_NAMES.norte}</option>
                    <option value="centro">{BRANCH_NAMES.centro}</option>
                  </Select>
                )}
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Compra y precio</h2>
              <p className="mt-0.5 text-sm text-muted">Registrar la compra crea la obligación con el proveedor. Recibir el vehículo no es haberlo pagado.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Proveedor o propietario anterior">{(id) => <Input id={id} value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Subastas Andina S.A." />}</Field>
              <span />
              <Field label="Costo de compra">{(id) => <MoneyInput id={id} value={acquisitionCost} onChange={setAcquisitionCost} />}</Field>
              <Field label="Precio de lista" hint="El que verá el comprador.">
                {(id) => <MoneyInput id={id} value={listPrice} onChange={setListPrice} />}
              </Field>
            </div>
            {listPrice > 0 && acquisitionCost > 0 && (
              <Notice tone="brand" title="Margen estimado inicial">
                {formatCop(listPrice - acquisitionCost)} antes de traslado, taller y otros costos. Se actualiza solo con cada costo que confirmes.
              </Notice>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">Revisa antes de registrar</h2>
              <p className="mt-0.5 text-sm text-muted">Quedará en alistamiento. Para publicarla faltarán fotos, documentos y la validación del vendedor.</p>
            </div>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
              {[
                ["Vehículo", `${form.make} ${form.model} ${form.trim} ${form.year}`],
                ["Tipo", kind === "car" ? "Carro (12 tomas)" : "Moto (10 tomas)"],
                ["Placa y VIN", `${form.plate.toUpperCase()}, ${form.vin.toUpperCase()}`],
                ["Sede", BRANCH_NAMES[form.branchId]],
                ["Proveedor", supplier],
                ["Costo de compra", formatCop(acquisitionCost)],
                ["Precio de lista", formatCop(listPrice)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="num mt-0.5 text-sm font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)} icon={<ArrowLeft size={16} />}>
            Atrás
          </Button>
          {step < 2 ? (
            <Button disabled={step === 0 ? !stepOneValid : !stepTwoValid} onClick={() => setStep((s) => s + 1)}>
              Continuar
              <ArrowRight size={16} weight="bold" />
            </Button>
          ) : (
            <Button onClick={submit}>Registrar vehículo</Button>
          )}
        </div>
      </Card>
    </div>
  );
}
