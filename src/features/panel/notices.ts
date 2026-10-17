import { agingBuckets, daysOverdue } from "@/domain/credit";
import { daysBetween, type IsoDate } from "@/domain/dates";
import { DOC_LABELS } from "@/domain/inventory";
import type { DemoData, Notice, Role } from "@/domain/types";

export type RoleNotice = Notice & { roles: Role[] };

/** Pendientes accionables del panel y de la campana. Cada uno lleva a la pantalla que lo resuelve. */
export function buildNotices(d: DemoData, today: IsoDate): RoleNotice[] {
  const list: RoleNotice[] = [];
  const add = (n: RoleNotice, count: number) => {
    if (count > 0) list.push(n);
  };

  const pendingPayments = d.payments.filter((p) => p.direction === "in" && p.status === "pending");
  add({ id: "n-pay", title: `${pendingPayments.length} pagos por confirmar`, detail: "El dinero cuenta solo cuando Tesorería lo confirma.", href: "/tesoreria", tone: "warn", roles: ["admin", "tesoreria"] }, pendingPayments.length);

  const quotes = d.quotes.filter((q) => q.status === "pending_approval");
  add({ id: "n-quote", title: `${quotes.length} descuento esperando aprobación`, detail: quotes.map((q) => q.number).join(", "), href: "/ventas", tone: "warn", roles: ["admin"] }, quotes.length);

  const apps = d.applications.filter((a) => a.status === "pending");
  add({ id: "n-app", title: `${apps.length} solicitud de crédito sin decidir`, detail: "Sin aprobación no hay préstamo ni venta a crédito.", href: "/cartera", tone: "warn", roles: ["admin", "cartera"] }, apps.length);

  const overdueLoans = d.loans.filter((l) => l.status === "active" && l.installments.some((i) => daysOverdue(i, today) > 0));
  const overdueTotal = overdueLoans.reduce((acc, l) => acc + agingBuckets(l.installments, today).total - agingBuckets(l.installments, today).current, 0);
  add({ id: "n-mora", title: `${overdueLoans.length} créditos en mora`, detail: "Hay cuotas vencidas sin pagar. Revisa la gestión de cobro.", href: "/cartera", tone: "bad", roles: ["admin", "cartera", "tesoreria"] }, overdueTotal > 0 ? overdueLoans.length : 0);

  const lateSuppliers = d.obligations.filter((o) => o.outstanding > 0 && o.dueOn < today);
  add({ id: "n-prov", title: `${lateSuppliers.length} cuenta por pagar vencida`, detail: lateSuppliers.map((o) => o.supplier).join(", "), href: "/tesoreria", tone: "bad", roles: ["admin", "tesoreria"] }, lateSuppliers.length);

  const refunds = d.refunds.filter((r) => r.status !== "confirmed");
  add({ id: "n-ref", title: `${refunds.length} devolución sin ejecutar`, detail: "Anular una venta no devuelve el dinero por sí sola.", href: "/tesoreria", tone: "bad", roles: ["admin", "tesoreria"] }, refunds.length);

  const expiring = d.reservations.filter((r) => r.status === "active" && daysBetween(today, r.expiresOn) <= 3);
  add({ id: "n-res", title: `${expiring.length} reservas vencen en 3 días`, detail: "Al vencer se libera la unidad, pero no se devuelve el anticipo.", href: "/ventas", tone: "warn", roles: ["admin", "asesor"] }, expiring.length);

  const unassigned = d.leads.filter((l) => l.status === "new" && !l.assigneeId);
  add({ id: "n-lead", title: `${unassigned.length} interesados sin asignar`, detail: "Responder en la primera hora multiplica el cierre.", href: "/oportunidades", tone: "info", roles: ["admin", "asesor"] }, unassigned.length);

  const requested = d.appointments.filter((a) => a.status === "requested");
  add({ id: "n-ap", title: `${requested.length} visitas por confirmar`, detail: "Una solicitud enviada no es una cita confirmada.", href: "/agenda", tone: "warn", roles: ["admin", "asesor"] }, requested.length);

  const docIssues = d.units.filter((u) => ["available", "in_preparation"].includes(u.status) && u.docs.some((x) => x.status === "missing" || x.status === "expired"));
  add({ id: "n-doc", title: `${docIssues.length} unidades con documentos por resolver`, detail: docIssues.flatMap((u) => u.docs.filter((x) => x.status !== "reviewed" && x.status !== "uploaded").map((x) => `${u.plate}: ${DOC_LABELS[x.type]}`)).join(", "), href: "/inventario", tone: "warn", roles: ["admin", "asesor", "taller"] }, docIssues.length);

  const lowStock = d.stock.filter((s) => s.onHand <= 3);
  add({ id: "n-stock", title: `${lowStock.length} repuestos con existencia baja`, detail: "Tres unidades o menos en la sede.", href: "/repuestos", tone: "warn", roles: ["admin", "taller"] }, lowStock.length);

  const quality = d.workOrders.filter((w) => w.status === "quality");
  add({ id: "n-ot", title: `${quality.length} orden en control de calidad`, detail: "Al terminarla la unidad vuelve a estar disponible.", href: "/taller", tone: "warn", roles: ["admin", "taller"] }, quality.length);

  return list;
}

export function noticesFor(role: Role, d: DemoData, today: IsoDate): RoleNotice[] {
  return buildNotices(d, today).filter((n) => n.roles.includes(role));
}
