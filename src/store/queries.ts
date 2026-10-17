import { agingBuckets, addAging, EMPTY_AGING, type AgingBuckets } from "@/domain/credit";
import type { IsoDate } from "@/domain/dates";
import type { Usage } from "@/domain/entitlements";
import { sum, type Cop } from "@/domain/money";
import type { DeliveryContext } from "@/domain/sales";
import type { DemoData, Id, Listing, Loan, PayTarget, Reservation, Sale, StockLevel, Unit } from "@/domain/types";

export const unitById = (d: DemoData, id: Id): Unit | undefined => d.units.find((u) => u.id === id);
export const listingOfUnit = (d: DemoData, unitId: Id): Listing | undefined => d.listings.find((l) => l.unitId === unitId);
export const saleOfUnit = (d: DemoData, unitId: Id): Sale | undefined => d.sales.find((s) => s.unitId === unitId && s.status !== "annulled");
export const loanOfSale = (d: DemoData, saleId: Id): Loan | undefined => d.loans.find((l) => l.saleId === saleId);
export const activeReservation = (d: DemoData, unitId: Id): Reservation | undefined => d.reservations.find((r) => r.unitId === unitId && r.status === "active");
export const partById = (d: DemoData, id: Id) => d.parts.find((p) => p.id === id);

export function unitLabel(u: Unit | undefined): string {
  return u ? `${u.make} ${u.model} ${u.trim} ${u.year}` : "Unidad desconocida";
}

/** Dinero confirmado que entró hacia un destino (venta, Plan Separe, reserva, etc.). */
export function confirmedIn(d: DemoData, targetType: PayTarget, targetId: Id): Cop {
  return sum(d.payments.filter((p) => p.direction === "in" && p.status === "confirmed" && p.targetType === targetType && p.targetId === targetId).map((p) => p.amount));
}

export function pendingIn(d: DemoData, targetType: PayTarget, targetId: Id): Cop {
  return sum(d.payments.filter((p) => p.direction === "in" && p.status === "pending" && p.targetType === targetType && p.targetId === targetId).map((p) => p.amount));
}

export function deliveryContext(d: DemoData, sale: Sale): DeliveryContext {
  return {
    sale,
    loan: sale.loanId ? d.loans.find((l) => l.id === sale.loanId) : undefined,
    layaway: sale.layawayId ? d.layaways.find((l) => l.id === sale.layawayId) : undefined,
    externalCase: sale.caseId ? d.externalCases.find((c) => c.id === sale.caseId) : undefined,
    downPaymentPaid: confirmedIn(d, "sale", sale.id),
    cashBalance: Math.max(0, sale.netPrice - confirmedIn(d, "sale", sale.id)),
  };
}

export function usage(d: DemoData, today: IsoDate): Usage {
  return {
    activeListings: d.listings.filter((l) => l.status === "published").length,
    users: d.members.filter((m) => m.status !== "revoked").length,
    branches: 2,
    featuredPerMonth: d.listings.filter((l) => l.featuredUntil && l.featuredUntil >= today).length,
  };
}

export function portfolioAging(d: DemoData, today: IsoDate): AgingBuckets {
  return d.loans
    .filter((l) => l.status === "active")
    .reduce((acc, loan) => addAging(acc, agingBuckets(loan.installments, today)), { ...EMPTY_AGING });
}

export function stockOf(d: DemoData, partId: Id, branchId: string): StockLevel | undefined {
  return d.stock.find((s) => s.partId === partId && s.branchId === branchId);
}

export function kindLabelOfUnit(u: Unit): string {
  return u.kind === "car" ? "Carro" : "Moto";
}
