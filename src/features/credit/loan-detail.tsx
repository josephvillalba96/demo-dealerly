"use client";

import { ArrowLeft, ChatCircleText, HandCoins, Lightning } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Field, MoneyInput, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, EmptyState, Notice, Stat, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { daysOverdue, dueAmount, dueUntil, isPaid, monthlyRateFromEA, outstandingPrincipal, payoffQuote, totalDue, type LoanInstallment } from "@/domain/credit";
import { DEMO_TODAY, formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { METHOD_LABELS } from "@/domain/treasury";
import type { CollectionAction, PayMethod } from "@/domain/types";
import { useDemo } from "@/store";
import { logCollection } from "@/store/commands/admin";
import { payoffLoan, registerPayment } from "@/store/commands/treasury";
import { unitById } from "@/store/queries";
import { PaymentBadge, methodLabel } from "../shared/badges";
import { UnitCell } from "../shared/unit-link";

const STAGES: Record<CollectionAction["stage"], string> = { preventive: "Preventivo", pre_legal: "Prejurídico", legal: "Jurídico" };
const CHANNELS: Record<CollectionAction["channel"], string> = { call: "Llamada", whatsapp: "WhatsApp", letter: "Carta" };

export function LoanDetail({ loanId }: { loanId: string }) {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [payOpen, setPayOpen] = useState(false);
  const [payoffOpen, setPayoffOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("transfer");
  const [confirmNow, setConfirmNow] = useState(true);
  const [channel, setChannel] = useState<CollectionAction["channel"]>("call");
  const [stage, setStage] = useState<CollectionAction["stage"]>("preventive");
  const [note, setNote] = useState("");

  const loan = data.loans.find((l) => l.id === loanId);
  const quote = useMemo(() => (loan ? payoffQuote(loan.installments, DEMO_TODAY) : null), [loan]);
  const payments = useMemo(() => data.payments.filter((p) => p.targetType === "installment" && p.targetId === loanId).reverse(), [data.payments, loanId]);

  if (!loan || !quote) {
    return (
      <Card>
        <EmptyState title="No encontramos ese crédito" action={<Link href="/cartera"><Button variant="secondary">Volver a cartera</Button></Link>} />
      </Card>
    );
  }

  const sale = data.sales.find((s) => s.id === loan.saleId);
  const unit = sale ? unitById(data, sale.unitId) : undefined;
  const dueToday = dueUntil(loan.installments, DEMO_TODAY);
  const worst = Math.max(...loan.installments.map((i) => daysOverdue(i, DEMO_TODAY)));
  const active = loan.status === "active";
  const canCollect = can(role, "credit.collect") || can(role, "payment.confirm");
  const canConfirm = can(role, "payment.confirm");
  const next = loan.installments.find((i) => dueAmount(i) > 0);

  const columns: Column<LoanInstallment>[] = [
    { header: "N°", cell: (i) => <span className="num font-medium text-ink">{i.number}</span> },
    { header: "Vence", cell: (i) => formatDate(i.dueOn) },
    { header: "Capital", align: "right", cell: (i) => formatCop(i.principal), hideBelow: "md" },
    { header: "Intereses", align: "right", cell: (i) => formatCop(i.interest), hideBelow: "md" },
    { header: "Cuota", align: "right", cell: (i) => <span className="font-medium text-ink">{formatCop(i.total)}</span> },
    { header: "Saldo después", align: "right", cell: (i) => formatCop(i.balanceAfter), hideBelow: "lg" },
    {
      header: "Estado",
      cell: (i) => {
        if (isPaid(i)) return <Badge tone="ok">Pagada</Badge>;
        const d = daysOverdue(i, DEMO_TODAY);
        const partial = i.paidPrincipal + i.paidInterest > 0;
        const tone: Tone = d > 60 ? "bad" : d > 0 ? "warn" : "neutral";
        return <Badge tone={tone}>{d > 0 ? `Vencida ${d} días` : "Por vencer"}{partial ? ", abono parcial" : ""}</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/cartera" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Cartera
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <UnitCell unit={unit} subtitle={`${loan.borrower.name}, ${loan.borrower.doc}`} />
            <Badge tone={!active ? "neutral" : worst > 60 ? "bad" : worst > 0 ? "warn" : "ok"}>{!active ? (loan.status === "paid_off" ? "Pagado" : "Cancelado") : worst > 0 ? `Mora ${worst} días` : "Al día"}</Badge>
          </div>
          {active && canCollect && (
            <div className="flex flex-wrap gap-2">
              <Button icon={<HandCoins size={16} />} onClick={() => { setAmount(dueToday > 0 ? dueToday : (next ? dueAmount(next) : 0)); setPayOpen(true); }}>
                Registrar pago
              </Button>
              <Button variant="secondary" icon={<Lightning size={16} />} onClick={() => setPayoffOpen(true)}>
                Liquidación anticipada
              </Button>
              {can(role, "credit.collect") && (
                <Button variant="secondary" icon={<ChatCircleText size={16} />} onClick={() => setCollectOpen(true)}>
                  Gestión de cobro
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Capital financiado" value={formatCop(loan.principal)} hint={`Inicial ${formatCop(loan.downPayment)} fuera del préstamo`} />
        <Stat label="Capital pendiente" value={formatCop(outstandingPrincipal(loan.installments))} hint={`Saldo total por cobrar ${formatCop(totalDue(loan.installments))}`} />
        <Stat label="Debe pagar hoy" value={formatCop(dueToday)} tone={dueToday > 0 ? "bad" : undefined} hint="Cuotas vencidas a la fecha de corte" />
        <Stat label="Condiciones" value={`${loan.months} meses`} hint={`${loan.eaPercent} % E.A. = ${(monthlyRateFromEA(loan.eaPercent) * 100).toFixed(3)} % mensual. Motor ${loan.engineVersion}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Plan de pagos" description="Reproducible: el contrato guarda la versión del motor con la que se calculó." />
          <DataTable caption="Plan de pagos" columns={columns} rows={loan.installments} rowKey={(i) => String(i.number)} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Gestión de cobro" />
            {loan.collection.length === 0 ? (
              <EmptyState title="Sin gestiones" description="Cuando registres una llamada, mensaje o carta, queda aquí con su evidencia." />
            ) : (
              <ol className="divide-y divide-line">
                {[...loan.collection].reverse().map((c) => (
                  <li key={c.id} className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-[13px]">
                      <Badge tone={c.stage === "preventive" ? "brand" : "warn"}>{STAGES[c.stage]}</Badge>
                      <span className="text-muted">{CHANNELS[c.channel]}, {formatDate(c.on)}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-soft">{c.note}</p>
                    <p className="mt-1 text-xs text-muted">{c.delivered === undefined ? "Entrega no confirmada por un proveedor" : "Entrega confirmada"}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <CardHeader title="Pagos aplicados" description="Cada peso con su destino: intereses y capital." />
            {payments.length === 0 ? (
              <EmptyState title="Sin pagos" />
            ) : (
              <ul className="divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="px-5 py-3.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-ink">{p.concept}</span>
                      <span className="num font-semibold text-ink">{formatCop(p.amount)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                      <PaymentBadge status={p.status} />
                      {methodLabel(p.method)}, {formatDate(p.on)}
                    </div>
                    {p.allocations && <p className="mt-1.5 text-[12.5px] text-muted">{p.allocations.map((a) => `${a.label} ${formatCop(a.amount)}`).join("; ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={payOpen}
        onOpenChange={setPayOpen}
        title="Registrar pago de cuota"
        description="El pago se aplica a la cuota más antigua: primero intereses y luego capital."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button disabled={amount <= 0} onClick={() => { const r = run(registerPayment, { targetType: "installment", targetId: loan.id, amount, method, confirmNow: canConfirm && confirmNow }); if (r.ok) setPayOpen(false); }}>
              {canConfirm && confirmNow ? "Registrar y confirmar" : "Registrar pago"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Importe" hint={`Hoy debe ${formatCop(dueToday)}. Puede pagar parcial o completo.`}>{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
          <Field label="Medio de pago">
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                {(Object.keys(METHOD_LABELS) as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
              </Select>
            )}
          </Field>
          {canConfirm ? <Check checked={confirmNow} onChange={setConfirmNow}>Ya tengo la evidencia: confirmar ahora</Check> : <Notice tone="warn">Tu rol no confirma dinero: el pago queda pendiente para Tesorería.</Notice>}
        </div>
      </Dialog>

      <Dialog
        open={payoffOpen}
        onOpenChange={setPayoffOpen}
        title="Liquidación anticipada"
        description={`Importe exacto a hoy, ${formatDate(DEMO_TODAY)}. No se cobran intereses futuros.`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayoffOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(payoffLoan, { loanId: loan.id, method: "transfer", confirmNow: canConfirm }); if (r.ok) setPayoffOpen(false); }}>
              {canConfirm ? "Cobrar y cerrar el crédito" : "Registrar liquidación"}
            </Button>
          </>
        }
      >
        <dl className="space-y-3 text-sm">
          {[["Capital pendiente", quote.principal], ["Intereses vencidos", quote.overdueInterest], ["Intereses causados de la cuota en curso", quote.accruedInterest]].map(([k, v]) => (
            <div key={k as string} className="flex justify-between"><dt className="text-muted">{k}</dt><dd className="num font-medium text-ink">{formatCop(v as number)}</dd></div>
          ))}
          <div className="flex justify-between border-t border-line pt-3"><dt className="font-semibold text-ink">Total a pagar hoy</dt><dd className="num text-lg font-bold text-ink">{formatCop(quote.total)}</dd></div>
        </dl>
        <div className="mt-4"><Notice tone="ok">El cliente se ahorra {formatCop(quote.futureInterestWaived)} en intereses que aún no se causaron.</Notice></div>
      </Dialog>

      <Dialog
        open={collectOpen}
        onOpenChange={setCollectOpen}
        title="Registrar gestión de cobro"
        description="Queda en el historial con su etapa y canal. El demo no envía mensajes reales."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCollectOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(logCollection, { loanId: loan.id, channel, stage, note }); if (r.ok) { setCollectOpen(false); setNote(""); } }}>Guardar gestión</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Etapa">{(id) => <Select id={id} value={stage} onChange={(e) => setStage(e.target.value as CollectionAction["stage"])}>{(Object.keys(STAGES) as CollectionAction["stage"][]).map((s) => <option key={s} value={s}>{STAGES[s]}</option>)}</Select>}</Field>
            <Field label="Canal">{(id) => <Select id={id} value={channel} onChange={(e) => setChannel(e.target.value as CollectionAction["channel"])}>{(Object.keys(CHANNELS) as CollectionAction["channel"][]).map((c) => <option key={c} value={c}>{CHANNELS[c]}</option>)}</Select>}</Field>
          </div>
          <Field label="Qué se acordó o qué pasó">{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ejemplo: Se comprometió a pagar el viernes 23." />}</Field>
        </div>
      </Dialog>
    </div>
  );
}
