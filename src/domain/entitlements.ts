import type { Cop } from "./money";
import type { ModuleId, PlanId, Subscription } from "./types";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Precio ilustrativo del demo. Las tarifas reales siguen abiertas (DEC-03). */
  monthlyPrice: Cop;
  limits: { activeListings: number; users: number; branches: number; featuredPerMonth: number };
  modules: readonly ModuleId[];
}

export const MODULE_LABELS: Record<ModuleId, { name: string; blurb: string }> = {
  layaway: { name: "Plan Separe", blurb: "Apartado con abonos flexibles y fecha límite." },
  external_financing: { name: "Financiación externa", blurb: "Seguimiento de solicitudes y desembolsos de bancos aliados." },
  own_credit: { name: "Crédito propio y cartera", blurb: "Plan de cuotas, mora por franjas y gestión de cobro." },
  workshop: { name: "Taller de reacondicionamiento", blurb: "Órdenes por bahía que suman su costo a cada vehículo." },
  parts_counter: { name: "Repuestos y mostrador", blurb: "Catálogo, kardex por sede y venta de mostrador." },
  advanced_reports: { name: "Reportes avanzados", blurb: "Margen por unidad, cartera por franja y comparativo de sedes." },
};

export const PLANS: Record<PlanId, Plan> = {
  basico: {
    id: "basico",
    name: "Dealer Básico",
    tagline: "Un patio que quiere ordenar inventario, ventas y caja.",
    monthlyPrice: 189_000,
    limits: { activeListings: 25, users: 3, branches: 1, featuredPerMonth: 0 },
    modules: ["layaway", "external_financing"],
  },
  pro: {
    id: "pro",
    name: "Dealer Pro",
    tagline: "Concesionario con varias sedes y crédito propio.",
    monthlyPrice: 549_000,
    limits: { activeListings: 150, users: 15, branches: 5, featuredPerMonth: 5 },
    modules: ["layaway", "external_financing", "own_credit", "advanced_reports"],
  },
  grupo: {
    id: "grupo",
    name: "Dealer Grupo",
    tagline: "Varias razones sociales con consolidado de lectura.",
    monthlyPrice: 1_190_000,
    limits: { activeListings: 150, users: 15, branches: 5, featuredPerMonth: 5 },
    modules: ["layaway", "external_financing", "own_credit", "advanced_reports", "workshop", "parts_counter"],
  },
};

export const ADDON_MODULES: readonly ModuleId[] = ["own_credit", "workshop", "parts_counter"];
export const ADDON_PRICE: Record<ModuleId, Cop> = {
  own_credit: 120_000,
  workshop: 150_000,
  parts_counter: 90_000,
  layaway: 0,
  external_financing: 0,
  advanced_reports: 0,
};

export type LimitMetric = keyof Plan["limits"];

export interface Usage {
  activeListings: number;
  users: number;
  branches: number;
  featuredPerMonth: number;
}

export function modulesOf(sub: Subscription): ModuleId[] {
  return [...new Set([...PLANS[sub.planId].modules, ...sub.addons])];
}

export function hasModule(sub: Subscription, module: ModuleId): boolean {
  return modulesOf(sub).includes(module);
}

export type Entitlement = { ok: true } | { ok: false; code: "module_not_in_plan" | "limit_reached"; message: string };

/** Evalúa en el "servidor" del demo si un módulo está incluido (FR-ENT-02). */
export function checkModule(sub: Subscription, module: ModuleId): Entitlement {
  if (hasModule(sub, module)) return { ok: true };
  return {
    ok: false,
    code: "module_not_in_plan",
    message: `${MODULE_LABELS[module].name} no está incluido en ${PLANS[sub.planId].name}. Actívalo como complemento o cambia de plan.`,
  };
}

/** Evalúa un límite numérico: crear un recurso más no puede superar el cupo. */
export function checkLimit(sub: Subscription, metric: LimitMetric, used: number): Entitlement {
  const limit = PLANS[sub.planId].limits[metric];
  if (used + 1 <= limit) return { ok: true };
  return {
    ok: false,
    code: "limit_reached",
    message: `Llegaste al límite de ${limit} (${LIMIT_LABELS[metric]}) de ${PLANS[sub.planId].name}.`,
  };
}

export const LIMIT_LABELS: Record<LimitMetric, string> = {
  activeListings: "anuncios activos",
  users: "usuarios",
  branches: "sedes",
  featuredPerMonth: "destacados incluidos al mes",
};

/** Al bajar de plan nada se borra: lo que excede el cupo se pausa (FR-ENT-03). */
export function overLimit(sub: Subscription, usage: Usage): LimitMetric[] {
  const limits = PLANS[sub.planId].limits;
  return (Object.keys(limits) as LimitMetric[]).filter((m) => usage[m] > limits[m]);
}
