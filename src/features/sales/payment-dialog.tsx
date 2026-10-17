"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Field, Input, MoneyInput, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/surface";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { METHOD_LABELS } from "@/domain/treasury";
import type { DemoData, PayMethod, Sale } from "@/domain/types";
import { useDemo } from "@/store";
import { registerPayment, type RegisterPaymentArgs } from "@/store/commands/treasury";
import { confirmedIn, pendingIn } from "@/store/queries";

export interface PayOption {
  key: string;
  label: string;
  targetType: RegisterPaymentArgs["targetType"];
  targetId: string;
  remaining: number;
}

/** Conceptos que admite una venta según su modalidad y su estado actual. */
export function payOptions(d: DemoData, sale: Sale): PayOption[] {
  if (sale.status === "annulled") return [];
  const list: PayOption[] = [];
  const saleTarget = sale.modality === "cash" ? sale.netPrice : sale.downPayment;
  const saleRemaining = saleTarget - confirmedIn(d, "sale", sale.id) - pendingIn(d, "sale", sale.id);
  if (saleRemaining > 0) list.push({ key: "sale", label: sale.modality === "cash" ? "Pago de contado" : "Cuota inicial", targetType: "sale", targetId: sale.id, remaining: saleRemaining });
  const ly = sale.layawayId ? d.layaways.find((l) => l.id === sale.layawayId) : undefined;
  if (ly && ly.status === "active") {
    const rem = ly.total - ly.paid - pendingIn(d, "layaway", ly.id);
    if (rem > 0) list.push({ key: "layaway", label: "Abono al Plan Separe", targetType: "layaway", targetId: ly.id, remaining: rem });
  }
  const ext = sale.caseId ? d.externalCases.find((c) => c.id === sale.caseId) : undefined;
  if (ext && ext.status === "approved") {
    const rem = (ext.approvedAmount ?? 0) - pendingIn(d, "external", ext.id);
    if (rem > 0) list.push({ key: "external", label: `Desembolso de ${ext.entity}`, targetType: "external", targetId: ext.id, remaining: rem });
  }
  return list;
}

export function PaymentDialog({ open, onOpenChange, options }: { open: boolean; onOpenChange: (o: boolean) => void; options: PayOption[] }) {
  const run = useDemo((s) => s.run);
  const role = useDemo((s) => s.session.role);
  const [key, setKey] = useState(options[0]?.key ?? "");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("transfer");
  const [ref, setRef] = useState("");
  const [confirmNow, setConfirmNow] = useState(true);
  const option = options.find((o) => o.key === key) ?? options[0];
  const canConfirm = can(role, "payment.confirm");

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar un pago"
      description="Todo recaudo pasa por Tesorería: queda pendiente hasta confirmarse con evidencia."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!option || amount <= 0}
            onClick={() => {
              if (!option) return;
              const r = run(registerPayment, { targetType: option.targetType, targetId: option.targetId, amount, method, ref, confirmNow: canConfirm && confirmNow });
              if (r.ok) {
                onOpenChange(false);
                setAmount(0);
                setRef("");
              }
            }}
          >
            {canConfirm && confirmNow ? "Registrar y confirmar" : "Registrar pago"}
          </Button>
        </>
      }
    >
      {!option ? (
        <Notice tone="neutral">Esta venta no admite más pagos en este momento.</Notice>
      ) : (
        <div className="space-y-4">
          <Field label="Concepto">
            {(id) => (
              <Select id={id} value={option.key} onChange={(e) => setKey(e.target.value)}>
                {options.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}, pendiente {formatCop(o.remaining)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Importe">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
            <Field label="Medio de pago">
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
          </div>
          <Field label="Referencia del comprobante" hint="Opcional. Una referencia no puede aplicarse a dos negocios.">
            {(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="TRF-884213" />}
          </Field>
          {canConfirm ? (
            <Check checked={confirmNow} onChange={setConfirmNow}>
              Ya tengo la evidencia: confirmar ahora
            </Check>
          ) : (
            <Notice tone="warn">Tu rol no confirma dinero. El pago quedará pendiente para Tesorería.</Notice>
          )}
          <button type="button" className="text-[13px] font-medium text-brand-700 hover:underline" onClick={() => setAmount(option.remaining)}>
            Usar el saldo pendiente completo ({formatCop(option.remaining)})
          </button>
        </div>
      )}
    </Dialog>
  );
}
