"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, Notice, PageIntro, Stat, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { daysOverdue, dueAmount, dueUntil, outstandingPrincipal } from "@/domain/credit";
import { DEMO_TODAY, formatDate } from "@/domain/dates";
import { hasModule } from "@/domain/entitlements";
import { formatCop, formatCopCompact } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { CreditApplication, ExternalCase, Layaway, Loan } from "@/domain/types";
import { useDemo } from "@/store";
import { memberName } from "@/store/engine";
import { decideCredit } from "@/store/commands/sales";
import { portfolioAging, unitById } from "@/store/queries";
import { UnitCell } from "../shared/unit-link";

function loanStatus(loan: Loan): { label: string; tone: Tone } {
  if (loan.status === "paid_off") return { label: "Pagado", tone: "ok" };
  if (loan.status === "cancelled") return { label: "Cancelado", tone: "neutral" };
  const worst = Math.max(...loan.installments.map((i) => daysOverdue(i, DEMO_TODAY)));
  if (worst > 90) return { label: `Mora ${worst} días`, tone: "bad" };
  if (worst > 0) return { label: `Mora ${worst} días`, tone: "warn" };
  return { label: "Al día", tone: "ok" };
}

export function CreditView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const router = useRouter();
  const params = useSearchParams();
  const aging = useMemo(() => portfolioAging(data, DEMO_TODAY), [data]);
  const overdue = aging.total - aging.current;
  const ownCredit = hasModule(data.subscription, "own_credit");

  const loanColumns: Column<Loan>[] = [
    { header: "Cliente y vehículo", cell: (l) => { const sale = data.sales.find((s) => s.id === l.saleId); return <UnitCell unit={sale && unitById(data, sale.unitId)} subtitle={l.borrower.name} />; } },
    { header: "Capital pendiente", align: "right", cell: (l) => formatCop(outstandingPrincipal(l.installments)) },
    { header: "Debe hoy", align: "right", cell: (l) => <span className="font-medium text-ink">{formatCop(dueUntil(l.installments, DEMO_TODAY))}</span>, hideBelow: "md" },
    { header: "Próxima cuota", cell: (l) => { const next = l.installments.find((i) => dueAmount(i) > 0 && i.dueOn >= DEMO_TODAY); return next ? `${formatDate(next.dueOn)}` : "Sin próximas"; }, hideBelow: "lg" },
    { header: "Estado", cell: (l) => { const st = loanStatus(l); return <Badge tone={st.tone}>{st.label}</Badge>; } },
  ];

  const appColumns: Column<CreditApplication>[] = [
    { header: "Solicitante", cell: (a) => <UnitCell unit={unitById(data, a.unitId)} subtitle={a.applicant.name} /> },
    { header: "Monto", align: "right", cell: (a) => formatCop(a.amount) },
    { header: "Plazo y tasa", cell: (a) => `${a.months} meses al ${a.eaPercent} % E.A.`, hideBelow: "md" },
    { header: "Cuota/ingreso", cell: (a) => { const r = Math.round(((a.amount / a.months) / a.monthlyIncome) * 100); return <span className={r > 40 ? "text-bad" : "text-ink-soft"}>{r} % (aprox.)</span>; }, hideBelow: "lg" },
    { header: "Estado", cell: (a) => <Badge tone={a.status === "approved" ? "ok" : a.status === "rejected" ? "bad" : "warn"}>{{ pending: "Por decidir", approved: "Aprobada", rejected: "Rechazada" }[a.status]}</Badge> },
    {
      header: "",
      align: "right",
      cell: (a) =>
        a.status === "pending" && can(role, "credit.approve") ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => run(decideCredit, { applicationId: a.id, approve: true, note: "Aprobado" })}>Aprobar</Button>
            <Button size="sm" variant="secondary" onClick={() => run(decideCredit, { applicationId: a.id, approve: false, note: "No cumple la política" })}>Rechazar</Button>
          </div>
        ) : (
          <span className="text-[13px] text-muted">{a.decidedBy ? `Decidió ${memberName(data, a.decidedBy)}` : ""}</span>
        ),
    },
  ];

  const caseColumns: Column<ExternalCase>[] = [
    { header: "Entidad", cell: (c) => <span className="font-medium text-ink">{c.entity}</span> },
    { header: "Venta", cell: (c) => data.sales.find((s) => s.id === c.saleId)?.number ?? "", hideBelow: "md" },
    { header: "Solicitado", align: "right", cell: (c) => formatCop(c.requested) },
    { header: "Estado", cell: (c) => <Badge tone={c.status === "disbursed" ? "ok" : c.status === "rejected" ? "bad" : "warn"}>{{ requested: "Solicitada", approved: "Aprobada sin desembolso", rejected: "Rechazada", disbursed: "Desembolsada" }[c.status]}</Badge> },
  ];

  const layawayColumns: Column<Layaway>[] = [
    { header: "Vehículo y cliente", cell: (l) => <UnitCell unit={unitById(data, l.unitId)} subtitle={l.buyer.name} /> },
    { header: "Abonado", align: "right", cell: (l) => `${formatCop(l.paid)} de ${formatCopCompact(l.total)}` },
    { header: "Fecha límite", cell: (l) => formatDate(l.deadlineOn), hideBelow: "md" },
    { header: "Estado", cell: (l) => <Badge tone={l.status === "completed" ? "ok" : l.status === "cancelled" ? "bad" : "brand"}>{{ active: "Activo", completed: "Completo", cancelled: "Cancelado" }[l.status]}</Badge> },
  ];

  return (
    <>
      <PageIntro>Aquí vive solo la cartera propia del concesionario. Un préstamo del banco no se suma: se sigue como expediente aparte hasta el desembolso.</PageIntro>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Capital por cobrar" value={formatCopCompact(data.loans.filter((l) => l.status === "active").reduce((a, l) => a + outstandingPrincipal(l.installments), 0))} hint={`${data.loans.filter((l) => l.status === "active").length} créditos activos`} />
        <Stat label="Cartera vencida" value={formatCopCompact(overdue)} tone={overdue > 0 ? "bad" : undefined} hint="Cuotas con atraso a hoy" />
        <Stat label="Mora de 1 a 60 días" value={formatCopCompact(aging.d1_30 + aging.d31_60)} hint="Gestión preventiva y prejurídica" />
        <Stat label="Mora de más de 60 días" value={formatCopCompact(aging.d61_90 + aging.d90plus)} tone={aging.d61_90 + aging.d90plus > 0 ? "bad" : undefined} hint="Requiere escalamiento" />
      </div>
      {!ownCredit && <div className="mb-6"><Notice tone="warn" title="Crédito propio no incluido en tu plan">Puedes consultar lo existente, pero no crear préstamos nuevos. Actívalo en Plan y módulos.</Notice></div>}
      <Card className="p-5 pb-2">
        <Tabs
          defaultValue={params.get("tab") ?? "creditos"}
          tabs={[
            { value: "creditos", label: "Créditos", count: data.loans.length, content: <div className="-mx-5"><DataTable caption="Créditos propios" columns={loanColumns} rows={data.loans} rowKey={(l) => l.id} onRowClick={(l) => router.push(`/cartera/${l.id}`)} empty={{ title: "Aún no hay créditos" }} /></div> },
            { value: "solicitudes", label: "Solicitudes", count: data.applications.filter((a) => a.status === "pending").length, content: <div className="-mx-5"><DataTable caption="Solicitudes de crédito" columns={appColumns} rows={data.applications} rowKey={(a) => a.id} empty={{ title: "Sin solicitudes" }} /></div> },
            { value: "externa", label: "Financiación externa", count: data.externalCases.length, content: <div className="-mx-5"><DataTable caption="Financiación externa" columns={caseColumns} rows={data.externalCases} rowKey={(c) => c.id} onRowClick={(c) => router.push(`/ventas/${c.saleId}`)} empty={{ title: "Sin expedientes con bancos" }} /></div> },
            { value: "separe", label: "Plan Separe", count: data.layaways.length, content: <div className="-mx-5"><DataTable caption="Planes Separe" columns={layawayColumns} rows={data.layaways} rowKey={(l) => l.id} onRowClick={(l) => router.push(`/ventas/${l.saleId}`)} empty={{ title: "Sin planes Separe" }} /></div> },
          ]}
        />
      </Card>
    </>
  );
}
