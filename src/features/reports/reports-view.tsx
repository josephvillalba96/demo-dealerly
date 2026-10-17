"use client";

import { useMemo } from "react";
import { Badge, Card, Notice, PageIntro } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { agingBuckets, outstandingPrincipal } from "@/domain/credit";
import { DEMO_TODAY, formatDate } from "@/domain/dates";
import { confirmedCost, realizedMargin } from "@/domain/inventory";
import { formatCop, sum } from "@/domain/money";
import { expectedCash } from "@/domain/treasury";
import type { Loan, Unit } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { canSeeCosts } from "@/lib/format";
import { useDemo } from "@/store";
import { UnitCell } from "../shared/unit-link";

export function ReportsView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const showCosts = canSeeCosts(role);

  const marginRows = useMemo(() => data.units.filter((u) => u.status !== "withdrawn"), [data.units]);
  const marginOf = (u: Unit) => {
    const sale = data.sales.find((s) => s.unitId === u.id && s.status !== "annulled");
    return sale ? { value: realizedMargin(sale, data.costs), kind: "Realizado" as const } : { value: u.listPrice - confirmedCost(data.costs, u.id), kind: "Estimado" as const };
  };

  const marginColumns: Column<Unit>[] = [
    { header: "Unidad", cell: (u) => <UnitCell unit={u} /> },
    { header: "Costo confirmado", align: "right", cell: (u) => formatCop(confirmedCost(data.costs, u.id)), hideBelow: "md" },
    { header: "Precio", align: "right", cell: (u) => { const sale = data.sales.find((s) => s.unitId === u.id && s.status !== "annulled"); return formatCop(sale ? sale.netPrice : u.listPrice); }, hideBelow: "md" },
    { header: "Margen", align: "right", cell: (u) => <span className="font-medium text-ink">{formatCop(marginOf(u).value)}</span> },
    { header: "Tipo", cell: (u) => <Badge tone={marginOf(u).kind === "Realizado" ? "ok" : "neutral"}>{marginOf(u).kind}</Badge> },
  ];

  const loanColumns: Column<Loan>[] = [
    { header: "Cliente", cell: (l) => <span className="font-medium text-ink">{l.borrower.name}</span> },
    { header: "Al día", align: "right", cell: (l) => formatCop(agingBuckets(l.installments, DEMO_TODAY).current), hideBelow: "lg" },
    { header: "1 a 30", align: "right", cell: (l) => formatCop(agingBuckets(l.installments, DEMO_TODAY).d1_30) },
    { header: "31 a 60", align: "right", cell: (l) => formatCop(agingBuckets(l.installments, DEMO_TODAY).d31_60) },
    { header: "61 a 90", align: "right", cell: (l) => formatCop(agingBuckets(l.installments, DEMO_TODAY).d61_90), hideBelow: "md" },
    { header: "Más de 90", align: "right", cell: (l) => formatCop(agingBuckets(l.installments, DEMO_TODAY).d90plus) },
    { header: "Capital pendiente", align: "right", cell: (l) => formatCop(outstandingPrincipal(l.installments)), hideBelow: "lg" },
  ];

  const funnel = [
    ["new", "Nuevos"],
    ["contacted", "Contactados"],
    ["appointment", "Con cita"],
    ["quoted", "Con cotización"],
    ["won", "Cerrados"],
    ["lost", "Perdidos"],
  ] as const;
  const totalLeads = data.leads.length;
  const won = data.leads.filter((l) => l.status === "won").length;

  const margins = marginRows.map((u) => marginOf(u).value);
  const tabs = [
    ...(showCosts
      ? [
          {
            value: "margen",
            label: "Margen por unidad",
            content: (
              <div className="space-y-4">
                <Notice tone="brand">Margen total en inventario y ventas: <strong>{formatCop(sum(margins))}</strong>. Se reproduce desde los costos confirmados de cada unidad, sin mezclar cobros de capital con ingresos.</Notice>
                <div className="-mx-5"><DataTable caption="Margen por unidad" columns={marginColumns} rows={marginRows} rowKey={(u) => u.id} /></div>
              </div>
            ),
          },
        ]
      : []),
    {
      value: "cartera",
      label: "Cartera por franja",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted">Corte al {formatDate(DEMO_TODAY)}. La mora se calcula a la fecha de corte y se puede reconstruir para un corte anterior.</p>
          <div className="-mx-5"><DataTable caption="Cartera por franja" columns={loanColumns} rows={data.loans.filter((l) => l.status === "active")} rowKey={(l) => l.id} /></div>
        </div>
      ),
    },
    {
      value: "caja",
      label: "Caja por sede",
      content: (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["norte", "centro"] as const).map((b) => {
            const s = data.cashSessions.find((x) => x.branchId === b && x.status === "open");
            return (
              <Card key={b} className="p-5">
                <p className="text-sm font-semibold text-ink">{BRANCH_NAMES[b]}</p>
                <p className="num mt-2 text-2xl font-bold text-ink">{s ? formatCop(expectedCash(s, data.payments, data.expenses)) : "Caja cerrada"}</p>
                <p className="mt-1 text-[13px] text-muted">{s ? "Efectivo esperado del turno abierto" : "No hay turno abierto en esta sede"}</p>
              </Card>
            );
          })}
        </div>
      ),
    },
    {
      value: "embudo",
      label: "Embudo comercial",
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted">{totalLeads} interesados, {won} cerrados ({Math.round((won / Math.max(1, totalLeads)) * 100)} %). Un cierre sin origen conocido se declara como tal.</p>
          <ul className="space-y-3">
            {funnel.map(([s, label]) => {
              const n = data.leads.filter((l) => l.status === s).length;
              return (
                <li key={s}>
                  <div className="mb-1 flex justify-between text-[13px]"><span className="text-ink-soft">{label}</span><span className="num font-medium text-ink">{n}</span></div>
                  <div className="h-2 rounded-full bg-surface"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.max(3, (n / Math.max(1, totalLeads)) * 100)}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageIntro>Cada cifra se puede rastrear hasta los movimientos que la componen. Los reportes indican la fecha de corte que usan.</PageIntro>
      <Card className="p-5">
        <Tabs tabs={tabs} />
      </Card>
    </>
  );
}
