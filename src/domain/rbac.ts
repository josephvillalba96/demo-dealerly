import type { Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  asesor: "Asesor comercial",
  tesoreria: "Tesorería",
  cartera: "Oficial de cartera",
  taller: "Jefe de taller",
};

export const ROLE_BLURBS: Record<Role, string> = {
  admin: "Ve y configura toda la empresa. Aprueba descuentos, créditos y anulaciones.",
  asesor: "Publica, atiende leads, cotiza y reserva. No confirma dinero ni aprueba su crédito.",
  tesoreria: "Confirma recaudos, paga proveedores, concilia y cierra caja.",
  cartera: "Evalúa créditos, cobra cuotas y gestiona la mora.",
  taller: "Opera órdenes de reacondicionamiento y el inventario de repuestos.",
};

/** Permisos por acción (SRS §2.3). Una sola fuente de verdad: la UI y el store la consultan. */
export type Permission =
  | "inventory.write"
  | "listing.write"
  | "lead.write"
  | "quote.write"
  | "quote.approve_discount"
  | "reservation.write"
  | "sale.write"
  | "sale.annul"
  | "delivery.write"
  | "credit.approve"
  | "credit.collect"
  | "payment.confirm"
  | "payment.out"
  | "refund.approve"
  | "cash.close"
  | "reconcile"
  | "workshop.write"
  | "parts.write"
  | "team.manage"
  | "plan.manage"
  | "audit.read"
  | "reports.read";

const ALL: Permission[] = [
  "inventory.write",
  "listing.write",
  "lead.write",
  "quote.write",
  "quote.approve_discount",
  "reservation.write",
  "sale.write",
  "sale.annul",
  "delivery.write",
  "credit.approve",
  "credit.collect",
  "payment.confirm",
  "payment.out",
  "refund.approve",
  "cash.close",
  "reconcile",
  "workshop.write",
  "parts.write",
  "team.manage",
  "plan.manage",
  "audit.read",
  "reports.read",
];

export const ALL_PERMISSIONS: readonly Permission[] = ALL;

export type Grants = Record<Role, Permission[]>;

/** Permisos de fábrica por rol (SRS §2.3). */
export function defaultGrants(): Grants {
  return {
    admin: [...ALL],
    asesor: ["inventory.write", "listing.write", "lead.write", "quote.write", "reservation.write", "sale.write", "delivery.write"],
    tesoreria: ["payment.confirm", "payment.out", "refund.approve", "cash.close", "reconcile", "reports.read"],
    cartera: ["credit.approve", "credit.collect", "reports.read"],
    taller: ["workshop.write", "parts.write", "inventory.write"],
  };
}

/** Permisos vigentes. El store los sincroniza con los datos del demo (el administrador puede editarlos). */
let grants: Grants = defaultGrants();

export function setGrants(next: Grants): void {
  grants = next;
}

export function can(role: Role, permission: Permission): boolean {
  return grants[role].includes(permission);
}

/** Rutas visibles por rol. Las no permitidas muestran la pantalla de acceso denegado. */
export type Section =
  | "panel"
  | "inventario"
  | "publicaciones"
  | "oportunidades"
  | "agenda"
  | "ventas"
  | "cartera"
  | "tesoreria"
  | "taller"
  | "repuestos"
  | "reportes"
  | "equipo"
  | "plan"
  | "auditoria";

const SECTION_ROLES: Record<Section, readonly Role[]> = {
  panel: ["admin", "asesor", "tesoreria", "cartera", "taller"],
  inventario: ["admin", "asesor", "taller", "tesoreria", "cartera"],
  publicaciones: ["admin", "asesor"],
  oportunidades: ["admin", "asesor"],
  agenda: ["admin", "asesor"],
  ventas: ["admin", "asesor", "tesoreria", "cartera"],
  cartera: ["admin", "cartera", "tesoreria"],
  tesoreria: ["admin", "tesoreria"],
  taller: ["admin", "taller"],
  repuestos: ["admin", "taller"],
  reportes: ["admin", "tesoreria", "cartera"],
  equipo: ["admin"],
  plan: ["admin"],
  auditoria: ["admin"],
};

export function canSee(role: Role, section: Section): boolean {
  return SECTION_ROLES[section].includes(role);
}

export function rolesFor(section: Section): readonly Role[] {
  return SECTION_ROLES[section];
}
