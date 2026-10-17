"use client";

import { CheckCircle, LockSimple } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, Notice, PageIntro } from "@/components/ui/surface";
import { DEMO_TODAY } from "@/domain/dates";
import { ADDON_MODULES, ADDON_PRICE, LIMIT_LABELS, MODULE_LABELS, overLimit, PLANS, type LimitMetric } from "@/domain/entitlements";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { ModuleId, PlanId } from "@/domain/types";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store";
import { changePlan, toggleAddon } from "@/store/commands/admin";
import { usage } from "@/store/queries";

const METRICS: LimitMetric[] = ["activeListings", "users", "branches", "featuredPerMonth"];
const MODULES = Object.keys(MODULE_LABELS) as ModuleId[];

export function PlanView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const sub = data.subscription;
  const plan = PLANS[sub.planId];
  const used = useMemo(() => usage(data, DEMO_TODAY), [data]);
  const over = overLimit(sub, used);
  const canManage = can(role, "plan.manage");

  return (
    <>
      <PageIntro>
        Tu plan define cuántos anuncios, personas y sedes tienes y qué módulos puedes usar. El servidor lo verifica en cada acción. Los precios son ilustrativos del demo; las tarifas reales siguen abiertas.
      </PageIntro>

      {over.length > 0 && (
        <div className="mb-6">
          <Notice tone="warn" title="Estás por encima del cupo de tu plan">
            {over.map((m) => LIMIT_LABELS[m]).join(", ")}. Nada se borró: los anuncios excedentes se pausan, los usuarios extra quedan en solo lectura y no se pueden crear recursos nuevos.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card>
          <CardHeader title={plan.name} description={plan.tagline} action={<Badge tone="brand">{formatCop(plan.monthlyPrice)} al mes</Badge>} />
          <ul className="space-y-5 p-5">
            {METRICS.map((m) => {
              const limit = plan.limits[m];
              const value = used[m];
              const pct = limit === 0 ? 0 : Math.min(100, (value / limit) * 100);
              return (
                <li key={m}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="text-ink-soft first-letter:uppercase">{LIMIT_LABELS[m]}</span>
                    <span className={cn("num font-medium", value > limit ? "text-bad" : "text-ink")}>{value} de {limit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface" role="progressbar" aria-valuenow={value} aria-valuemax={limit} aria-label={LIMIT_LABELS[m]}>
                    <div className={cn("h-2 rounded-full", value > limit ? "bg-bad" : "bg-brand-500")} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Módulos" description="Incluidos en el plan o contratados como complemento." />
          <ul className="divide-y divide-line">
            {MODULES.map((m) => {
              const included = plan.modules.includes(m);
              const addon = sub.addons.includes(m);
              const canAddon = ADDON_MODULES.includes(m) && !included;
              return (
                <li key={m} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className={included || addon ? "text-ok" : "text-faint"}>{included || addon ? <CheckCircle size={22} weight="fill" /> : <LockSimple size={22} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{MODULE_LABELS[m].name}</p>
                    <p className="text-[13px] text-muted">{MODULE_LABELS[m].blurb}</p>
                  </div>
                  {included ? (
                    <Badge tone="ok">Incluido</Badge>
                  ) : canAddon ? (
                    <Button size="sm" variant={addon ? "secondary" : "primary"} disabled={!canManage} onClick={() => run(toggleAddon, { module: m })}>
                      {addon ? "Desactivar complemento" : `Activar por ${formatCop(ADDON_PRICE[m])} al mes`}
                    </Button>
                  ) : (
                    <Badge>Requiere subir de plan</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <h2 className="mt-8 mb-4 text-[15px] font-semibold text-ink">Planes para concesionarios</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const current = id === sub.planId;
          return (
            <Card key={id} className={cn("flex flex-col p-5", current && "border-brand-500 ring-2 ring-brand-500/15")}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-ink">{p.name}</h3>
                {current && <Badge tone="brand">Plan actual</Badge>}
              </div>
              <p className="mt-1 text-[13px] text-muted">{p.tagline}</p>
              <p className="num mt-4 text-2xl font-bold text-ink">{formatCop(p.monthlyPrice)}<span className="text-sm font-normal text-muted"> al mes</span></p>
              <ul className="mt-4 flex-1 space-y-1.5 text-[13px] text-ink-soft">
                <li>{p.limits.activeListings} anuncios activos</li>
                <li>{p.limits.users} usuarios y {p.limits.branches} {p.limits.branches === 1 ? "sede" : "sedes"}</li>
                <li>{p.limits.featuredPerMonth} destacados incluidos al mes</li>
                <li>{p.modules.map((m) => MODULE_LABELS[m].name).join(", ")}</li>
              </ul>
              <Button className="mt-5" variant={current ? "secondary" : "primary"} disabled={current || !canManage} onClick={() => run(changePlan, { planId: id })}>
                {current ? "Es tu plan" : "Cambiar a este plan"}
              </Button>
            </Card>
          );
        })}
      </div>
      {!canManage && <p className="mt-4 text-[13px] text-muted">Solo el administrador cambia el plan.</p>}
    </>
  );
}
