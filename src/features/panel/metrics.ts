import { outstandingPrincipal } from "@/domain/credit";
import type { IsoDate } from "@/domain/dates";
import { confirmedCost } from "@/domain/inventory";
import { formatCopCompact, sum, type Cop } from "@/domain/money";
import { expectedCash } from "@/domain/treasury";
import type { DemoData, Role } from "@/domain/types";
import { portfolioAging } from "@/store/queries";

export interface Kpi {
  label: string;
  value: string;
  hint: string;
  tone?: "bad";
  href: string;
}

const inStock = (d: DemoData) => d.units.filter((u) => ["available", "reserved", "in_preparation"].includes(u.status));

export function estimatedMarginTotal(d: DemoData): Cop {
  return sum(inStock(d).map((u) => u.listPrice - confirmedCost(d.costs, u.id)));
}

export function overdueAmount(d: DemoData, today: IsoDate): Cop {
  const a = portfolioAging(d, today);
  return a.total - a.current;
}

export function cashToday(d: DemoData): Cop {
  return sum(d.cashSessions.filter((s) => s.status === "open").map((s) => expectedCash(s, d.payments, d.expenses)));
}

/** Cuatro indicadores según lo que hace cada rol: nadie ve una cifra que no puede accionar. */
export function kpisFor(role: Role, d: DemoData, today: IsoDate): Kpi[] {
  const stock = d.units.filter((u) => ["available", "reserved"].includes(u.status));
  const inventory: Kpi = { label: "Unidades en venta", value: String(stock.length), hint: `Valor de lista ${formatCopCompact(sum(stock.map((u) => u.listPrice)))}`, href: "/inventario" };
  const margin: Kpi = { label: "Margen estimado del inventario", value: formatCopCompact(estimatedMarginTotal(d)), hint: "Precio de lista menos costo confirmado", href: "/reportes" };
  const overdue = overdueAmount(d, today);
  const mora: Kpi = { label: "Cartera vencida", value: formatCopCompact(overdue), hint: `${d.loans.filter((l) => l.status === "active").length} créditos activos`, tone: overdue > 0 ? "bad" : undefined, href: "/cartera" };
  const cash: Kpi = { label: "Efectivo esperado en cajas", value: formatCopCompact(cashToday(d)), hint: `${d.cashSessions.filter((s) => s.status === "open").length} cajas abiertas hoy`, href: "/tesoreria" };
  const pending = d.payments.filter((p) => p.direction === "in" && p.status === "pending");
  const pendingKpi: Kpi = { label: "Pagos por confirmar", value: formatCopCompact(sum(pending.map((p) => p.amount))), hint: `${pending.length} movimientos pendientes`, href: "/tesoreria" };
  const payable = sum(d.obligations.map((o) => o.outstanding));
  const payableKpi: Kpi = { label: "Cuentas por pagar", value: formatCopCompact(payable), hint: `${d.obligations.filter((o) => o.outstanding > 0).length} obligaciones abiertas`, href: "/tesoreria" };
  const portfolio = sum(d.loans.filter((l) => l.status === "active").map((l) => outstandingPrincipal(l.installments)));
  const portfolioKpi: Kpi = { label: "Cartera propia", value: formatCopCompact(portfolio), hint: "Capital pendiente de cobro", href: "/cartera" };
  const apps = d.applications.filter((a) => a.status === "pending");
  const appsKpi: Kpi = { label: "Solicitudes sin decidir", value: String(apps.length), hint: "Sin aprobación no hay préstamo", href: "/cartera" };
  const newLeads = d.leads.filter((l) => l.status === "new");
  const leadsKpi: Kpi = { label: "Interesados nuevos", value: String(newLeads.length), hint: `${newLeads.filter((l) => !l.assigneeId).length} sin asignar`, href: "/oportunidades" };
  const reservations = d.reservations.filter((r) => r.status === "active");
  const reservationsKpi: Kpi = { label: "Reservas activas", value: String(reservations.length), hint: "Unidades apartadas para un comprador", href: "/ventas" };
  const visits = d.appointments.filter((a) => ["requested", "confirmed", "rescheduled"].includes(a.status));
  const visitsKpi: Kpi = { label: "Visitas próximas", value: String(visits.length), hint: `${d.appointments.filter((a) => a.status === "requested").length} por confirmar`, href: "/agenda" };
  const openOrders = d.workOrders.filter((w) => !["done", "cancelled"].includes(w.status));
  const ordersKpi: Kpi = { label: "Órdenes abiertas", value: String(openOrders.length), hint: "En alistamiento de unidades propias", href: "/taller" };
  const low = d.stock.filter((s) => s.onHand <= 3);
  const lowKpi: Kpi = { label: "Repuestos con poca existencia", value: String(low.length), hint: "Tres unidades o menos por sede", href: "/repuestos" };
  const workCost = sum(d.costs.filter((c) => c.source === "work_order" && c.status === "confirmed").map((c) => c.amount));
  const workKpi: Kpi = { label: "Reacondicionamiento acumulado", value: formatCopCompact(workCost), hint: "Suma al costo de cada unidad", href: "/taller" };

  switch (role) {
    case "admin":
      return [inventory, margin, mora, cash];
    case "asesor":
      return [leadsKpi, visitsKpi, reservationsKpi, inventory];
    case "tesoreria":
      return [cash, pendingKpi, payableKpi, mora];
    case "cartera":
      return [portfolioKpi, mora, appsKpi, pendingKpi];
    case "taller":
      return [ordersKpi, lowKpi, workKpi, inventory];
  }
}
