import { addMonths, daysBetween, type IsoDate } from "./dates";
import { roundCop, sum, type Cop } from "./money";

/** Versión del motor: se guarda en cada contrato para que sea reproducible (NFR-MAINT-01). */
export const ENGINE_VERSION = "1.0.0";

export interface ScheduleRow {
  number: number;
  dueOn: IsoDate;
  principal: Cop;
  interest: Cop;
  total: Cop;
  balanceAfter: Cop;
}

export interface LoanInstallment extends ScheduleRow {
  paidPrincipal: Cop;
  paidInterest: Cop;
  paidOn?: IsoDate;
}

export interface Allocation {
  number: number;
  toInterest: Cop;
  toPrincipal: Cop;
}

/** Tasa mensual equivalente a una efectiva anual. El prototipo dividía entre 12, lo cual es incorrecto. */
export function monthlyRateFromEA(eaPercent: number): number {
  return Math.pow(1 + eaPercent / 100, 1 / 12) - 1;
}

export function frenchInstallment(principal: Cop, monthlyRate: number, months: number): number {
  if (months <= 0) throw new Error("El plazo debe ser mayor que cero");
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export interface ScheduleInput {
  principal: Cop;
  eaPercent: number;
  months: number;
  firstDueOn: IsoDate;
}

/** Cronograma francés. La última cuota ajusta capital para que Σ capital = capital financiado. */
export function buildSchedule({ principal, eaPercent, months, firstDueOn }: ScheduleInput): ScheduleRow[] {
  if (principal <= 0) throw new Error("El capital a financiar debe ser mayor que cero");
  const r = monthlyRateFromEA(eaPercent);
  const payment = roundCop(frenchInstallment(principal, r, months));
  const rows: ScheduleRow[] = [];
  let balance = principal;
  for (let i = 1; i <= months; i++) {
    const interest = roundCop(balance * r);
    const principalPart = i === months ? balance : Math.min(payment - interest, balance);
    balance -= principalPart;
    rows.push({
      number: i,
      dueOn: addMonths(firstDueOn, i - 1),
      principal: principalPart,
      interest,
      total: principalPart + interest,
      balanceAfter: balance,
    });
  }
  return rows;
}

export function toInstallments(rows: readonly ScheduleRow[]): LoanInstallment[] {
  return rows.map((row) => ({ ...row, paidPrincipal: 0, paidInterest: 0 }));
}

export function dueAmount(i: LoanInstallment): Cop {
  return i.principal + i.interest - i.paidPrincipal - i.paidInterest;
}

export function isPaid(i: LoanInstallment): boolean {
  return dueAmount(i) === 0;
}

export function outstandingPrincipal(installments: readonly LoanInstallment[]): Cop {
  return sum(installments.map((i) => i.principal - i.paidPrincipal));
}

export function totalDue(installments: readonly LoanInstallment[]): Cop {
  return sum(installments.map(dueAmount));
}

/**
 * Aplica un pago a la cuota impaga más antigua. Orden contractual: intereses y luego capital.
 * Devuelve copias (no muta) y el excedente que no alcanzó a aplicarse.
 */
export function allocatePayment(
  installments: readonly LoanInstallment[],
  amount: Cop,
  paidOn: IsoDate,
): { installments: LoanInstallment[]; allocations: Allocation[]; surplus: Cop } {
  if (amount <= 0) throw new Error("El pago debe ser mayor que cero");
  const next = installments.map((i) => ({ ...i }));
  const allocations: Allocation[] = [];
  let remaining = amount;
  for (const inst of next) {
    if (remaining === 0) break;
    if (isPaid(inst)) continue;
    const toInterest = Math.min(remaining, inst.interest - inst.paidInterest);
    remaining -= toInterest;
    const toPrincipal = Math.min(remaining, inst.principal - inst.paidPrincipal);
    remaining -= toPrincipal;
    inst.paidInterest += toInterest;
    inst.paidPrincipal += toPrincipal;
    if (isPaid(inst)) inst.paidOn = paidOn;
    allocations.push({ number: inst.number, toInterest, toPrincipal });
  }
  return { installments: next, allocations, surplus: remaining };
}

export interface PayoffQuote {
  principal: Cop;
  overdueInterest: Cop;
  accruedInterest: Cop;
  total: Cop;
  futureInterestWaived: Cop;
}

/** Liquidación anticipada a una fecha de corte. Nunca cobra intereses futuros (FR-CRE-05). */
export function payoffQuote(installments: readonly LoanInstallment[], cutDate: IsoDate): PayoffQuote {
  const principal = outstandingPrincipal(installments);
  const unpaid = installments.filter((i) => !isPaid(i));
  const overdue = unpaid.filter((i) => i.dueOn <= cutDate);
  const upcoming = unpaid.filter((i) => i.dueOn > cutDate);
  const overdueInterest = sum(overdue.map((i) => i.interest - i.paidInterest));

  let accruedInterest = 0;
  let futureInterest = sum(upcoming.slice(1).map((i) => i.interest - i.paidInterest));
  const current = upcoming[0];
  if (current) {
    const idx = installments.findIndex((i) => i.number === current.number);
    const periodStart = idx > 0 ? installments[idx - 1].dueOn : addMonths(current.dueOn, -1);
    const span = Math.max(1, daysBetween(periodStart, current.dueOn));
    const fraction = Math.min(1, Math.max(0, daysBetween(periodStart, cutDate) / span));
    const unpaidInterest = current.interest - current.paidInterest;
    accruedInterest = roundCop(unpaidInterest * fraction);
    futureInterest += unpaidInterest - accruedInterest;
  }
  return {
    principal,
    overdueInterest,
    accruedInterest,
    total: principal + overdueInterest + accruedInterest,
    futureInterestWaived: futureInterest,
  };
}

export interface AgingBuckets {
  current: Cop;
  d1_30: Cop;
  d31_60: Cop;
  d61_90: Cop;
  d90plus: Cop;
  total: Cop;
}

export const EMPTY_AGING: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };

export function daysOverdue(i: LoanInstallment, cutDate: IsoDate): number {
  return isPaid(i) ? 0 : Math.max(0, daysBetween(i.dueOn, cutDate));
}

/** Clasifica lo adeudado por franjas de mora a una fecha de corte (FR-CRE-06). */
export function agingBuckets(installments: readonly LoanInstallment[], cutDate: IsoDate): AgingBuckets {
  const b: AgingBuckets = { ...EMPTY_AGING };
  for (const i of installments) {
    const due = dueAmount(i);
    if (due === 0) continue;
    const days = daysOverdue(i, cutDate);
    if (days === 0) b.current += due;
    else if (days <= 30) b.d1_30 += due;
    else if (days <= 60) b.d31_60 += due;
    else if (days <= 90) b.d61_90 += due;
    else b.d90plus += due;
    b.total += due;
  }
  return b;
}

export function addAging(a: AgingBuckets, b: AgingBuckets): AgingBuckets {
  return {
    current: a.current + b.current,
    d1_30: a.d1_30 + b.d1_30,
    d31_60: a.d31_60 + b.d31_60,
    d61_90: a.d61_90 + b.d61_90,
    d90plus: a.d90plus + b.d90plus,
    total: a.total + b.total,
  };
}

/**
 * Cierra el préstamo con una liquidación anticipada: paga capital y lo vencido, cobra solo el interés
 * causado de la cuota en curso y condona el interés futuro (se reescribe a lo efectivamente pagado).
 */
export function settleInstallments(installments: readonly LoanInstallment[], cutDate: IsoDate): LoanInstallment[] {
  const quote = payoffQuote(installments, cutDate);
  let accruedPending = quote.accruedInterest;
  return installments.map((i) => {
    if (isPaid(i)) return { ...i };
    if (i.dueOn <= cutDate) return { ...i, paidPrincipal: i.principal, paidInterest: i.interest, paidOn: cutDate };
    const accrued = Math.min(accruedPending, i.interest - i.paidInterest);
    accruedPending -= accrued;
    const paidInterest = i.paidInterest + accrued;
    return { ...i, interest: paidInterest, total: i.principal + paidInterest, paidPrincipal: i.principal, paidInterest, paidOn: cutDate };
  });
}

/** Lo que el cliente debe pagar hoy: cuotas con vencimiento a la fecha de corte o antes. */
export function dueUntil(installments: readonly LoanInstallment[], cutDate: IsoDate): Cop {
  return sum(installments.filter((i) => i.dueOn <= cutDate).map(dueAmount));
}
