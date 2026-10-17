"use client";

import { Lock } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Segmented, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/surface";
import { buildSchedule, monthlyRateFromEA, frenchInstallment } from "@/domain/credit";
import { addMonths, DEMO_TODAY, formatDate } from "@/domain/dates";
import { hasModule } from "@/domain/entitlements";
import { formatCop, roundCop, sum } from "@/domain/money";
import { MODALITY_LABELS } from "@/domain/sales";
import { METHOD_LABELS } from "@/domain/treasury";
import type { Buyer, Modality, PayMethod } from "@/domain/types";
import { unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { formalizeSale, requestCredit } from "@/store/commands/sales";
import { activeReservation, unitById } from "@/store/queries";

export interface SaleSeed {
  unitId: string;
  buyer: Buyer;
  price: number;
}

const MODULE_OF: Partial<Record<Modality, "own_credit" | "layaway" | "external_financing">> = { own_credit: "own_credit", layaway: "layaway", external: "external_financing" };

export function SaleDialog({ seed, onClose }: { seed: SaleSeed | null; onClose: () => void }) {
  const run = useDemo((s) => s.run);
  const data = useDemo((s) => s.data);
  const [modality, setModality] = useState<Modality>("cash");
  const [down, setDown] = useState(0);
  const [method, setMethod] = useState<PayMethod>("transfer");
  const [months, setMonths] = useState(36);
  const [ea, setEa] = useState(22);
  const [bank, setBank] = useState("Bancolombia Libranza Vehículo");
  const [income, setIncome] = useState(7_000_000);

  const unit = seed ? unitById(data, seed.unitId) : undefined;
  const approved = seed ? data.applications.find((a) => a.unitId === seed.unitId && a.applicant.doc === seed.buyer.doc && a.status === "approved") : undefined;
  const pendingApp = seed ? data.applications.find((a) => a.unitId === seed.unitId && a.applicant.doc === seed.buyer.doc && a.status === "pending") : undefined;
  const reservation = seed ? activeReservation(data, seed.unitId) : undefined;
  const principal = seed ? Math.max(0, seed.price - down) : 0;

  const preview = useMemo(() => {
    if (modality !== "own_credit" || principal <= 0) return null;
    const rows = buildSchedule({ principal, eaPercent: ea, months, firstDueOn: addMonths(DEMO_TODAY, 1) });
    return { rows, payment: roundCop(frenchInstallment(principal, monthlyRateFromEA(ea), months)), interest: sum(rows.map((r) => r.interest)) };
  }, [modality, principal, ea, months]);

  const locked = (m: Modality) => {
    const mod = MODULE_OF[m];
    return mod ? !hasModule(data.subscription, mod) : false;
  };

  return (
    <Dialog
      open={Boolean(seed)}
      onOpenChange={(o) => !o && onClose()}
      title="Formalizar la venta"
      description="Formalizada no es pagada ni entregada: cada hecho tiene su propio estado."
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!seed || locked(modality)}
            onClick={() => {
              if (!seed) return;
              const r = run(formalizeSale, { unitId: seed.unitId, buyer: seed.buyer, modality, netPrice: seed.price, downPayment: modality === "cash" ? 0 : down, method, months, eaPercent: ea, bank });
              if (r.ok) onClose();
            }}
          >
            Formalizar venta
          </Button>
        </>
      }
    >
      {seed && unit && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-control bg-surface p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{unitName(unit)}</p>
              <p className="text-[13px] text-muted">Comprador: {seed.buyer.name}</p>
            </div>
            <p className="num text-xl font-bold text-ink">{formatCop(seed.price)}</p>
          </div>
          {reservation && <Notice tone="brand">Hay una reserva activa de {reservation.buyer.name}. Al formalizar se convierte en venta.</Notice>}

          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink-soft">Modalidad</p>
            <Segmented
              label="Modalidad de venta"
              value={modality}
              onChange={setModality}
              options={(Object.keys(MODALITY_LABELS) as Modality[]).map((m) => ({ value: m, label: MODALITY_LABELS[m] }))}
            />
            {locked(modality) && (
              <p className="flex items-center gap-1.5 text-[13px] text-warn">
                <Lock size={14} weight="fill" /> No está incluido en tu plan actual. Actívalo en Plan y módulos.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {modality !== "cash" && <Field label="Cuota inicial">{(id) => <MoneyInput id={id} value={down} onChange={setDown} />}</Field>}
            <Field label={modality === "cash" ? "Medio de pago del total" : "Medio de pago de la inicial"}>
              {(id) => (
                <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                  {(Object.keys(METHOD_LABELS) as PayMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {modality === "external" && (
              <Field label="Entidad aliada" className="sm:col-span-2">
                {(id) => <Input id={id} value={bank} onChange={(e) => setBank(e.target.value)} />}
              </Field>
            )}
            {modality === "own_credit" && (
              <>
                <Field label="Plazo en meses">
                  {(id) => (
                    <Select id={id} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                      {[12, 24, 36, 48, 60].map((m) => (
                        <option key={m} value={m}>
                          {m} meses
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Tasa efectiva anual (%)" hint="Se convierte a tasa mensual equivalente, no se divide entre 12.">
                  {(id) => <Input id={id} type="number" value={ea} onChange={(e) => setEa(Number(e.target.value))} />}
                </Field>
              </>
            )}
          </div>

          {modality === "own_credit" && (
            <div className="space-y-3">
              {approved ? (
                <Notice tone="ok">Crédito aprobado por Cartera ({approved.months} meses al {approved.eaPercent} % E.A.). Puedes formalizar.</Notice>
              ) : pendingApp ? (
                <Notice tone="warn">La solicitud está pendiente en Cartera. Sin aprobación no se puede formalizar ni genera saldo.</Notice>
              ) : (
                <Notice tone="warn" title="Falta la aprobación de crédito">
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <Field label="Ingreso mensual del comprador" className="w-56">
                      {(id) => <MoneyInput id={id} value={income} onChange={setIncome} />}
                    </Field>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => run(requestCredit, { unitId: seed.unitId, applicant: seed.buyer, monthlyIncome: income, amount: principal, months, eaPercent: ea })}
                    >
                      Solicitar a Cartera
                    </Button>
                  </div>
                </Notice>
              )}
              {preview && (
                <div className="rounded-control border border-line p-4">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted">Capital a financiar</p>
                      <p className="num font-semibold text-ink">{formatCop(principal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Cuota mensual aprox.</p>
                      <p className="num font-semibold text-ink">{formatCop(preview.payment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Intereses totales</p>
                      <p className="num font-semibold text-ink">{formatCop(preview.interest)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] text-muted">
                    Primera cuota el {formatDate(preview.rows[0].dueOn)}. Los intereses se calculan solo sobre el capital neto, nunca sobre la inicial.
                  </p>
                </div>
              )}
            </div>
          )}
          {modality === "layaway" && <Notice tone="brand">El Plan Separe se completa con abonos libres hasta la fecha límite (60 días). La entrega exige saldo en cero.</Notice>}
          {modality === "external" && <Notice tone="brand">El banco aprueba y desembolsa por su cuenta. Aprobación no es desembolso: la entrega espera el dinero confirmado.</Notice>}
        </div>
      )}
    </Dialog>
  );
}
