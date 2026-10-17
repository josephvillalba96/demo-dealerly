"use client";

import { ArrowRight, WarningCircle, Info } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo } from "react";
import { Badge, Card, CardHeader, EmptyState, Stat } from "@/components/ui/surface";
import { DEMO_TODAY, formatDate } from "@/domain/dates";
import { STATUS_LABELS } from "@/domain/inventory";
import { formatCopCompact } from "@/domain/money";
import { ROLE_LABELS } from "@/domain/rbac";
import type { UnitStatus } from "@/domain/types";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store";
import { portfolioAging } from "@/store/queries";
import { kpisFor } from "./metrics";
import { noticesFor } from "./notices";

const TONE_BADGE = { bad: "bad", warn: "warn", info: "brand" } as const;

function greeting(): string {
  return "Buenos días";
}

function Bars({ rows }: { rows: { label: string; value: number; display: string; tone?: "bad" }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
            <span className="text-ink-soft">{r.label}</span>
            <span className={cn("num font-medium", r.tone === "bad" ? "text-bad" : "text-ink")}>{r.display}</span>
          </div>
          <div className="h-2 rounded-full bg-surface">
            <div className={cn("h-2 rounded-full", r.tone === "bad" ? "bg-bad/80" : "bg-brand-500")} style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PanelView() {
  const data = useDemo((s) => s.data);
  const { role, userId } = useDemo((s) => s.session);
  const me = data.members.find((m) => m.id === userId);
  const notices = useMemo(() => noticesFor(role, data, DEMO_TODAY), [role, data]);
  const kpis = useMemo(() => kpisFor(role, data, DEMO_TODAY), [role, data]);
  const showMoney = role === "admin" || role === "cartera" || role === "tesoreria";

  const aging = useMemo(() => portfolioAging(data, DEMO_TODAY), [data]);

  const inventoryRows = (["available", "reserved", "in_preparation", "sold", "delivered"] as UnitStatus[]).map((s) => ({
    label: STATUS_LABELS[s],
    value: data.units.filter((u) => u.status === s).length,
    display: String(data.units.filter((u) => u.status === s).length),
  }));

  const funnel = (
    [
      ["new", "Nuevos"],
      ["contacted", "Contactados"],
      ["appointment", "Con cita"],
      ["quoted", "Con cotización"],
      ["won", "Cerrados"],
    ] as const
  ).map(([s, label]) => ({ label, value: data.leads.filter((l) => l.status === s).length, display: String(data.leads.filter((l) => l.status === s).length) }));

  const recent = [...data.audit].reverse().slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="rounded-card bg-brand-100 p-6 sm:p-8">
        <p className="text-sm font-medium text-brand-700">{ROLE_LABELS[role]}</p>
        <h2 className="mt-1 text-[28px] leading-tight font-bold tracking-tight text-brand-900">
          {greeting()}, {me?.name.split(" ")[0]}
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-brand-900/75">
          {notices.length === 0
            ? "No tienes pendientes. Aprovecha para revisar el inventario."
            : `Tienes ${notices.length} ${notices.length === 1 ? "pendiente" : "pendientes"} para tu rol. El más importante: ${notices[0].title.toLowerCase()}.`}
        </p>
        {notices[0] && (
          <Link href={notices[0].href} className="mt-5 inline-flex h-10 items-center gap-2 rounded-control bg-canvas px-4 text-sm font-semibold text-ink shadow-card transition hover:bg-brand-50">
            Resolver ahora
            <ArrowRight size={16} weight="bold" className="text-brand-500" />
          </Link>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href} className="block rounded-card outline-offset-2 transition hover:-translate-y-0.5">
            <Stat label={k.label} value={k.value} hint={k.hint} tone={k.tone ? "bad" : undefined} />
          </Link>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Requiere atención" description="Pendientes de tu rol. Cada uno te lleva a donde se resuelve." />
          {notices.length === 0 ? (
            <EmptyState title="Todo al día" description="No hay pendientes para este rol en este momento." />
          ) : (
            <ul className="divide-y divide-line">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} className="flex items-start gap-3.5 px-5 py-4 transition hover:bg-surface/60">
                    <span className={cn("mt-0.5", n.tone === "bad" ? "text-bad" : n.tone === "warn" ? "text-warn" : "text-brand-500")}>{n.tone === "info" ? <Info size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{n.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">{n.detail}</span>
                    </span>
                    <Badge tone={TONE_BADGE[n.tone]}>{n.tone === "bad" ? "Urgente" : n.tone === "warn" ? "Pendiente" : "Nuevo"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          {showMoney ? (
            <Card>
              <CardHeader title="Cartera por franja de mora" description={`Corte al ${formatDate(DEMO_TODAY)}`} />
              <div className="p-5">
                <Bars
                  rows={[
                    { label: "Al día", value: aging.current, display: formatCopCompact(aging.current) },
                    { label: "1 a 30 días", value: aging.d1_30, display: formatCopCompact(aging.d1_30), tone: "bad" },
                    { label: "31 a 60 días", value: aging.d31_60, display: formatCopCompact(aging.d31_60), tone: "bad" },
                    { label: "61 a 90 días", value: aging.d61_90, display: formatCopCompact(aging.d61_90), tone: "bad" },
                    { label: "Más de 90 días", value: aging.d90plus, display: formatCopCompact(aging.d90plus), tone: "bad" },
                  ]}
                />
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader title="Embudo comercial" description="Interesados por etapa" />
              <div className="p-5">
                <Bars rows={funnel} />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Inventario por estado" />
            <div className="p-5">
              <Bars rows={inventoryRows} />
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Actividad reciente" description="Cada acción queda en una bitácora encadenada que no se puede editar sin que se note." action={<Link href="/auditoria" className="text-[13px] font-semibold text-brand-700 hover:underline">Ver bitácora</Link>} />
        <ul className="divide-y divide-line">
          {recent.map((e) => (
            <li key={e.seq} className="flex items-baseline gap-4 px-5 py-3 text-sm">
              <span className="num w-28 shrink-0 text-[13px] text-muted">{e.at.slice(5, 16).replace("T", " ")}</span>
              <span className="min-w-0 flex-1 text-ink-soft">
                <strong className="font-medium text-ink">{e.actor}</strong> {e.action.charAt(0).toLowerCase() + e.action.slice(1)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
