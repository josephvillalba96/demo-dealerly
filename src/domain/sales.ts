import { formatCop, type Cop } from "./money";
import type { ExternalCase, Layaway, Loan, Modality, Reservation, Sale, Unit } from "./types";

export const MODALITY_LABELS: Record<Modality, string> = {
  cash: "Contado",
  own_credit: "Crédito propio",
  external: "Financiación externa",
  layaway: "Plan Separe",
};

/** Descuento que un asesor puede dar sin aprobación (porcentaje del precio). */
export const FREE_DISCOUNT_PCT = 3;

export function discountPct(price: Cop, discount: Cop): number {
  return price === 0 ? 0 : (discount / price) * 100;
}

export function discountNeedsApproval(price: Cop, discount: Cop): boolean {
  return discountPct(price, discount) > FREE_DISCOUNT_PCT;
}

export type Check = { ok: true } | { ok: false; reason: string };

/** Reserva exclusiva (FR-FIN-04): la unidad debe estar disponible y sin otra reserva activa. */
export function canReserve(unit: Unit, reservations: readonly Reservation[]): Check {
  const active = reservations.find((r) => r.unitId === unit.id && r.status === "active");
  if (active) return { ok: false, reason: `Ya existe una reserva activa de ${active.buyer.name} para esta unidad.` };
  if (unit.status !== "available") return { ok: false, reason: "La unidad no está disponible para reservar." };
  return { ok: true };
}

export interface DeliveryContext {
  sale: Sale;
  loan?: Loan;
  layaway?: Layaway;
  externalCase?: ExternalCase;
  /** Pagos de inicial confirmados para esta venta. */
  downPaymentPaid: Cop;
  /** Saldo pendiente de la venta de contado. */
  cashBalance: Cop;
}

/** Condiciones de entrega por modalidad (FR-FIN-06). Lista vacía: se puede entregar. */
export function deliveryBlockers(ctx: DeliveryContext): string[] {
  const { sale } = ctx;
  if (sale.status === "annulled") return ["La venta está anulada"];
  if (sale.status === "delivered") return ["La unidad ya fue entregada"];
  const blockers: string[] = [];
  switch (sale.modality) {
    case "cash":
      if (ctx.cashBalance > 0) blockers.push(`Saldo pendiente de contado: ${formatCop(ctx.cashBalance)}`);
      break;
    case "own_credit":
      if (!ctx.loan) blockers.push("El crédito aún no está formalizado");
      if (ctx.downPaymentPaid < sale.downPayment) blockers.push("La cuota inicial no está confirmada");
      break;
    case "external":
      if (ctx.externalCase?.status !== "disbursed") blockers.push("El banco aún no confirma el desembolso");
      break;
    case "layaway":
      if (ctx.layaway?.status !== "completed") blockers.push("El Plan Separe no está completo");
      break;
  }
  return blockers;
}

export function nextNumber(counters: Record<string, number>, key: string, prefix: string): { number: string; counters: Record<string, number> } {
  const value = (counters[key] ?? 0) + 1;
  return { number: `${prefix}-${String(value).padStart(4, "0")}`, counters: { ...counters, [key]: value } };
}
