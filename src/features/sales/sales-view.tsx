"use client";

import { Plus } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, PageIntro, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { DEMO_TODAY, daysBetween, formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { MODALITY_LABELS } from "@/domain/sales";
import type { Quote, QuoteStatus, Reservation, Sale } from "@/domain/types";
import { memberName } from "@/store/engine";
import { useDemo } from "@/store";
import { acceptQuote, approveQuote, cancelReservation, reviseQuote } from "@/store/commands/sales";
import { confirmedIn, pendingIn, unitById } from "@/store/queries";
import { SaleBadge } from "../shared/badges";
import { UnitCell } from "../shared/unit-link";
import { QuoteDialog } from "./quote-dialog";
import { ReserveDialog } from "./reserve-dialog";
import { SaleDialog, type SaleSeed } from "./sale-dialog";

const QUOTE_LABEL: Record<QuoteStatus, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_approval: { label: "Descuento por aprobar", tone: "warn" },
  issued: { label: "Emitida", tone: "brand" },
  accepted: { label: "Aceptada", tone: "ok" },
  rejected: { label: "Rechazada", tone: "bad" },
  expired: { label: "Vencida", tone: "neutral" },
};

export function SalesView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const router = useRouter();
  const params = useSearchParams();
  // Si llegamos desde el expediente de una unidad (?cotizar=ID), abrimos la cotización con esa unidad.
  const [presetUnit, setPresetUnit] = useState<string | undefined>(() => params.get("cotizar") ?? undefined);
  const [quoteOpen, setQuoteOpen] = useState(() => Boolean(params.get("cotizar")));
  const [reserving, setReserving] = useState<Quote | null>(null);
  const [selling, setSelling] = useState<SaleSeed | null>(null);


  const quoteColumns: Column<Quote>[] = [
    { header: "Cotización", cell: (q) => <span className="num font-medium text-ink">{q.number} v{q.version}</span> },
    { header: "Vehículo", cell: (q) => <UnitCell unit={unitById(data, q.unitId)} /> },
    { header: "Comprador", cell: (q) => q.buyer.name, hideBelow: "md" },
    { header: "Total", align: "right", cell: (q) => <span className="font-medium text-ink">{formatCop(q.price - q.discount)}</span> },
    { header: "Estado", cell: (q) => <Badge tone={QUOTE_LABEL[q.status].tone}>{QUOTE_LABEL[q.status].label}</Badge> },
    {
      header: "",
      align: "right",
      cell: (q) => {
        const unit = unitById(data, q.unitId);
        return (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            {q.status === "pending_approval" && can(role, "quote.approve_discount") && (
              <>
                <Button size="sm" onClick={() => run(approveQuote, { quoteId: q.id, approve: true })}>
                  Aprobar descuento
                </Button>
                <Button size="sm" variant="secondary" onClick={() => run(approveQuote, { quoteId: q.id, approve: false })}>
                  Rechazar
                </Button>
              </>
            )}
            {q.status === "issued" && can(role, "quote.write") && (
              <Button size="sm" variant="secondary" onClick={() => run(acceptQuote, { quoteId: q.id })}>
                Registrar aceptación
              </Button>
            )}
            {q.status === "accepted" && can(role, "reservation.write") && unit?.status === "available" && (
              <Button size="sm" onClick={() => setReserving(q)}>
                Reservar
              </Button>
            )}
            {q.status === "accepted" && can(role, "quote.write") && (
              <Button size="sm" variant="ghost" onClick={() => run(reviseQuote, { quoteId: q.id, discount: Math.round(q.discount / 2) })}>
                Revisar condiciones
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const reservationColumns: Column<Reservation>[] = [
    { header: "Vehículo", cell: (r) => <UnitCell unit={unitById(data, r.unitId)} /> },
    { header: "Comprador", cell: (r) => r.buyer.name, hideBelow: "md" },
    {
      header: "Vence",
      cell: (r) => {
        const left = daysBetween(DEMO_TODAY, r.expiresOn);
        return (
          <span>
            {formatDate(r.expiresOn)} <span className={left <= 3 ? "text-warn" : "text-muted"}>({left} días)</span>
          </span>
        );
      },
      hideBelow: "md",
    },
    {
      header: "Anticipo",
      cell: (r) => {
        const ok = confirmedIn(data, "reservation", r.id);
        const pend = pendingIn(data, "reservation", r.id);
        if (r.deposit === 0) return <span className="text-muted">Sin anticipo</span>;
        return ok > 0 ? <Badge tone="ok">{formatCop(ok)} confirmado</Badge> : pend > 0 ? <Badge tone="warn">{formatCop(pend)} pendiente</Badge> : <span>{formatCop(r.deposit)}</span>;
      },
    },
    { header: "Asesor", cell: (r) => memberName(data, r.advisorId), hideBelow: "lg" },
    {
      header: "",
      align: "right",
      cell: (r) => {
        const q = data.quotes.find((x) => x.id === r.quoteId);
        return (
          <div className="flex justify-end gap-2">
            {can(role, "sale.write") && (
              <Button size="sm" onClick={() => setSelling({ unitId: r.unitId, buyer: r.buyer, price: q ? q.price - q.discount : (unitById(data, r.unitId)?.listPrice ?? 0) })}>
                Formalizar venta
              </Button>
            )}
            {can(role, "reservation.write") && (
              <Button size="sm" variant="ghost" onClick={() => run(cancelReservation, { reservationId: r.id })}>
                Cancelar
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const saleColumns: Column<Sale>[] = [
    { header: "Venta", cell: (s) => <span className="num font-medium text-ink">{s.number}</span> },
    { header: "Vehículo", cell: (s) => <UnitCell unit={unitById(data, s.unitId)} /> },
    { header: "Comprador", cell: (s) => s.buyer.name, hideBelow: "md" },
    { header: "Modalidad", cell: (s) => MODALITY_LABELS[s.modality], hideBelow: "lg" },
    { header: "Precio", align: "right", cell: (s) => <span className="font-medium text-ink">{formatCop(s.netPrice)}</span> },
    { header: "Estado", cell: (s) => <SaleBadge status={s.status} /> },
  ];

  const activeReservations = data.reservations.filter((r) => r.status === "active");
  const sales = [...data.sales].reverse();
  const quotes = [...data.quotes].reverse();

  return (
    <>
      <PageIntro
        actions={
          can(role, "quote.write") && (
            <Button
              icon={<Plus size={16} weight="bold" />}
              onClick={() => {
                setPresetUnit(undefined);
                setQuoteOpen(true);
              }}
            >
              Nueva cotización
            </Button>
          )
        }
      >
        Cotizar, reservar y vender son pasos distintos. Una reserva es exclusiva por unidad, y una venta formalizada todavía no es dinero recibido ni vehículo entregado.
      </PageIntro>
      <Card className="p-5 pb-2">
        <Tabs
          defaultValue={params.get("tab") ?? "cotizaciones"}
          tabs={[
            { value: "cotizaciones", label: "Cotizaciones", count: quotes.length, content: <div className="-mx-5"><DataTable caption="Cotizaciones" columns={quoteColumns} rows={quotes} rowKey={(q) => q.id} empty={{ title: "Aún no hay cotizaciones" }} /></div> },
            { value: "reservas", label: "Reservas activas", count: activeReservations.length, content: <div className="-mx-5"><DataTable caption="Reservas activas" columns={reservationColumns} rows={activeReservations} rowKey={(r) => r.id} empty={{ title: "No hay reservas activas", description: "Reserva desde una cotización aceptada." }} /></div> },
            { value: "ventas", label: "Ventas", count: sales.length, content: <div className="-mx-5"><DataTable caption="Ventas" columns={saleColumns} rows={sales} rowKey={(s) => s.id} onRowClick={(s) => router.push(`/ventas/${s.id}`)} empty={{ title: "Todavía no hay ventas" }} /></div> },
          ]}
        />
      </Card>
      <QuoteDialog key={`quote-${presetUnit ?? "none"}`} open={quoteOpen} onOpenChange={setQuoteOpen} presetUnitId={presetUnit} />
      <ReserveDialog quote={reserving} onClose={() => setReserving(null)} />
      <SaleDialog key={`sale-${selling?.unitId ?? "none"}`} seed={selling} onClose={() => setSelling(null)} />
    </>
  );
}
