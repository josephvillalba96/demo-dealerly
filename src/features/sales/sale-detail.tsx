"use client";

import { ArrowLeft, CheckCircle, Circle, Prohibit } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, EmptyState, Notice, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { totalDue } from "@/domain/credit";
import { formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { deliveryBlockers, MODALITY_LABELS } from "@/domain/sales";
import type { InvoiceState, Payment } from "@/domain/types";
import { memberName } from "@/store/engine";
import { useDemo } from "@/store";
import { annulSale, decideExternal, recordDelivery } from "@/store/commands/sales";
import { confirmPayment, failPayment } from "@/store/commands/treasury";
import { confirmedIn, deliveryContext, pendingIn, unitById } from "@/store/queries";
import { PaymentBadge, SaleBadge, methodLabel } from "../shared/badges";
import { UnitCell } from "../shared/unit-link";
import { PaymentDialog, payOptions } from "./payment-dialog";

const INVOICE: Record<InvoiceState, { label: string; tone: Tone }> = {
  none: { label: "Sin documento", tone: "neutral" },
  internal: { label: "Documento interno", tone: "warn" },
  fiscal_pending: { label: "Fiscal pendiente", tone: "warn" },
  fiscal_ok: { label: "Validada fiscalmente", tone: "ok" },
};

function Fact({ title, children, tone }: { title: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{title}</p>
      <div className="mt-1.5">{tone ? <Badge tone={tone}>{children}</Badge> : <p className="text-sm font-semibold text-ink">{children}</p>}</div>
    </Card>
  );
}

export function SaleDetail({ saleId }: { saleId: string }) {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [payOpen, setPayOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [annulOpen, setAnnulOpen] = useState(false);
  const [receiver, setReceiver] = useState("");
  const [exception, setException] = useState("");
  const [reason, setReason] = useState("");
  const [bankRef, setBankRef] = useState("");

  const sale = data.sales.find((s) => s.id === saleId);
  const options = useMemo(() => (sale ? payOptions(data, sale) : []), [data, sale]);

  if (!sale) {
    return (
      <Card>
        <EmptyState title="No encontramos esa venta" action={<Link href="/ventas"><Button variant="secondary">Volver a ventas</Button></Link>} />
      </Card>
    );
  }

  const unit = unitById(data, sale.unitId);
  const ctx = deliveryContext(data, sale);
  const blockers = deliveryBlockers(ctx);
  const loan = ctx.loan;
  const layaway = ctx.layaway;
  const ext = ctx.externalCase;
  const received = confirmedIn(data, "sale", sale.id) + (layaway ? layaway.paid : 0) + (ext?.status === "disbursed" ? (ext.approvedAmount ?? 0) : 0) + (loan ? confirmedIn(data, "installment", loan.id) : 0);
  const pending = pendingIn(data, "sale", sale.id) + (layaway ? pendingIn(data, "layaway", layaway.id) : 0);
  const related = data.payments.filter((p) => p.targetId === sale.id || (layaway && p.targetId === layaway.id) || (loan && p.targetId === loan.id) || (ext && p.targetId === ext.id));
  const moneyLabel = sale.status === "annulled" ? "Anulada" : pending > 0 ? `${formatCop(pending)} pendiente de confirmar` : blockers.length === 0 || sale.status === "delivered" ? "Condiciones de dinero cumplidas" : "Falta dinero por confirmar";
  const moneyTone: Tone = sale.status === "annulled" ? "neutral" : pending > 0 ? "warn" : blockers.length === 0 || sale.status === "delivered" ? "ok" : "warn";
  const canPay = can(role, "sale.write") || can(role, "payment.confirm") || can(role, "credit.collect");

  const columns: Column<Payment>[] = [
    { header: "Concepto", cell: (p) => <div><p className="font-medium text-ink">{p.concept}</p><p className="num text-[13px] text-muted">{p.ref}</p></div> },
    { header: "Medio", cell: (p) => methodLabel(p.method), hideBelow: "md" },
    { header: "Fecha", cell: (p) => formatDate(p.on), hideBelow: "md" },
    { header: "Estado", cell: (p) => <PaymentBadge status={p.status} /> },
    { header: "Importe", align: "right", cell: (p) => <span className="font-medium text-ink">{formatCop(p.amount)}</span> },
    {
      header: "",
      align: "right",
      cell: (p) =>
        p.status === "pending" && can(role, "payment.confirm") ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => run(confirmPayment, { paymentId: p.id })}>
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => run(failPayment, { paymentId: p.id })}>
              Fallido
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <Link href="/ventas" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Ventas
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <UnitCell unit={unit} subtitle={`${sale.number}, ${MODALITY_LABELS[sale.modality]}`} />
            <SaleBadge status={sale.status} />
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Precio de venta</p>
            <p className="num text-[26px] leading-tight font-bold text-ink">{formatCop(sale.netPrice)}</p>
            <p className="text-[13px] text-muted">Comprador: {sale.buyer.name}. Asesor: {memberName(data, sale.advisorId)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact title="Venta" tone={sale.status === "annulled" ? "neutral" : "brand"}>{sale.status === "annulled" ? "Anulada" : `Formalizada el ${formatDate(sale.formalizedOn)}`}</Fact>
        <Fact title="Dinero" tone={moneyTone}>{moneyLabel}</Fact>
        <Fact title="Facturación" tone={INVOICE[sale.invoice].tone}>{INVOICE[sale.invoice].label}</Fact>
        <Fact title="Entrega" tone={sale.status === "delivered" ? "ok" : "neutral"}>{sale.status === "delivered" ? `Entregada el ${formatDate(sale.deliveredOn!)}` : "Pendiente"}</Fact>
      </div>
      <p className="-mt-2 text-[13px] text-muted">Son cuatro hechos independientes: facturar no marca pagado y pagar no marca entregado.</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Pagos de esta venta"
            description={`Recibido y confirmado: ${formatCop(received)}`}
            action={
              canPay &&
              sale.status !== "annulled" && (
                <Button size="sm" disabled={options.length === 0} onClick={() => setPayOpen(true)}>
                  Registrar pago
                </Button>
              )
            }
          />
          <DataTable caption="Pagos de la venta" columns={columns} rows={related} rowKey={(p) => p.id} empty={{ title: "Sin pagos registrados" }} />
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Condiciones de entrega" description={`Según la modalidad: ${MODALITY_LABELS[sale.modality]}`} />
            <div className="space-y-3 p-5">
              {sale.status === "delivered" ? (
                <Notice tone="ok">Entregada a {sale.delivery?.receiver}. {sale.delivery?.exceptionReason ? `Con excepción autorizada: ${sale.delivery.exceptionReason}` : ""}</Notice>
              ) : sale.status === "annulled" ? (
                <Notice tone="neutral">Venta anulada: {sale.annulReason}</Notice>
              ) : (
                <>
                  {blockers.length === 0 ? (
                    <p className="flex items-center gap-2 text-sm text-ok"><CheckCircle size={18} weight="fill" /> Cumple todas las condiciones.</p>
                  ) : (
                    <ul className="space-y-2">
                      {blockers.map((b) => (
                        <li key={b} className="flex items-start gap-2 text-sm text-ink-soft"><Circle size={18} weight="bold" className="mt-px shrink-0 text-warn" />{b}</li>
                      ))}
                    </ul>
                  )}
                  {can(role, "delivery.write") && (
                    <Button className="w-full" variant={blockers.length ? "secondary" : "primary"} onClick={() => setDeliverOpen(true)}>
                      {blockers.length ? "Entregar con excepción" : "Registrar entrega"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>

          {loan && (
            <Card>
              <CardHeader title="Crédito propio" />
              <div className="space-y-2 p-5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Capital financiado</span><span className="num font-medium text-ink">{formatCop(loan.principal)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Saldo por cobrar</span><span className="num font-medium text-ink">{formatCop(totalDue(loan.installments))}</span></div>
                <Link href={`/cartera/${loan.id}`} className="block pt-2 text-[13px] font-semibold text-brand-700 hover:underline">Ver plan de pagos y cobranza</Link>
              </div>
            </Card>
          )}
          {ext && (
            <Card>
              <CardHeader title="Financiación externa" description={ext.entity} />
              <div className="space-y-3 p-5 text-sm">
                <div className="flex justify-between"><span className="text-muted">Solicitado</span><span className="num font-medium text-ink">{formatCop(ext.requested)}</span></div>
                <div className="flex justify-between"><span className="text-muted">Estado</span><Badge tone={ext.status === "disbursed" ? "ok" : ext.status === "approved" ? "warn" : ext.status === "rejected" ? "bad" : "neutral"}>{{ requested: "Solicitada", approved: "Aprobada, sin desembolso", rejected: "Rechazada", disbursed: "Desembolsada" }[ext.status]}</Badge></div>
                {ext.status === "requested" && (
                  <div className="space-y-2 border-t border-line pt-3">
                    <Field label="Código de aprobación del banco">{(id) => <Input id={id} value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="BC-884213" />}</Field>
                    <Button size="sm" variant="secondary" onClick={() => run(decideExternal, { caseId: ext.id, approve: true, ref: bankRef })}>Registrar aprobación</Button>
                  </div>
                )}
                {ext.status === "approved" && <Notice tone="warn">Aprobación {ext.approvalRef}. Falta el desembolso: el capital del banco no es cartera propia ni dinero recibido todavía.</Notice>}
              </div>
            </Card>
          )}
          {layaway && (
            <Card>
              <CardHeader title="Plan Separe" description={`Fecha límite ${formatDate(layaway.deadlineOn)}`} />
              <div className="space-y-2 p-5">
                <div className="flex justify-between text-sm"><span className="text-muted">Abonado</span><span className="num font-medium text-ink">{formatCop(layaway.paid)} de {formatCop(layaway.total)}</span></div>
                <div className="h-2 rounded-full bg-surface"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, (layaway.paid / layaway.total) * 100)}%` }} /></div>
              </div>
            </Card>
          )}

          {sale.status === "formalized" && can(role, "sale.annul") && (
            <Button variant="secondary" className="w-full text-bad" icon={<Prohibit size={16} />} onClick={() => setAnnulOpen(true)}>
              Anular venta
            </Button>
          )}
        </div>
      </div>

      <PaymentDialog key={options.map((o) => o.key).join()} open={payOpen} onOpenChange={setPayOpen} options={options} />

      <Dialog
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        title={blockers.length ? "Entregar con excepción" : "Registrar entrega"}
        description="La entrega queda con acta: quién recibe, cuándo y bajo qué condiciones."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeliverOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(recordDelivery, { saleId: sale.id, receiver, exceptionReason: exception }); if (r.ok) setDeliverOpen(false); }}>Registrar entrega</Button>
          </>
        }
      >
        <div className="space-y-4">
          {blockers.length > 0 && <Notice tone="warn" title="Hay condiciones pendientes">{blockers.join("; ")}. Solo un administrador puede autorizar una excepción, con motivo.</Notice>}
          <Field label="Quién recibe el vehículo">{(id) => <Input id={id} value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder={sale.buyer.name} />}</Field>
          {blockers.length > 0 && <Field label="Motivo de la excepción">{(id) => <Textarea id={id} value={exception} onChange={(e) => setException(e.target.value)} />}</Field>}
        </div>
      </Dialog>

      <Dialog
        open={annulOpen}
        onOpenChange={setAnnulOpen}
        title="Anular la venta"
        description="Se conserva el original y se compensa. El dinero recibido queda como devolución pendiente, no se devuelve solo."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAnnulOpen(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { const r = run(annulSale, { saleId: sale.id, reason }); if (r.ok) setAnnulOpen(false); }}>Anular venta</Button>
          </>
        }
      >
        <Field label="Motivo de la anulación">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ejemplo: el cliente desistió antes de la entrega." />}</Field>
      </Dialog>
    </div>
  );
}
