import { sum, type Cop } from "./money";
import type { BankLine, CashSession, Expense, Payment, PayMethod } from "./types";

export const METHOD_LABELS: Record<PayMethod, string> = {
  cash: "Efectivo",
  transfer: "Transferencia",
  pse: "PSE",
  card: "Tarjeta",
  nequi: "Nequi",
};

/** Idempotencia por referencia externa: el mismo evento no produce un segundo efecto (NFR-REL-01). */
export function isDuplicateRef(processedRefs: readonly string[], ref: string): boolean {
  return processedRefs.includes(ref);
}

/** Efectivo esperado = base + entradas en efectivo - salidas en efectivo de la sesión. */
export function expectedCash(
  session: CashSession,
  payments: readonly Payment[],
  expenses: readonly Expense[],
): Cop {
  const cashIn = sum(
    payments
      .filter((p) => p.sessionId === session.id && p.direction === "in" && p.method === "cash" && p.status === "confirmed")
      .map((p) => p.amount),
  );
  const cashOut = sum(
    payments
      .filter((p) => p.sessionId === session.id && p.direction === "out" && p.method === "cash" && p.status === "confirmed")
      .map((p) => p.amount),
  );
  const cashExpenses = sum(
    expenses.filter((e) => e.sessionId === session.id && e.method === "cash" && e.status === "confirmed").map((e) => e.amount),
  );
  // Las devoluciones en efectivo ya quedan registradas como pagos de salida.
  return session.openingBase + cashIn - cashOut - cashExpenses;
}

export interface CloseResult {
  expected: Cop;
  difference: Cop;
  verdict: "cuadrado" | "sobrante" | "faltante";
}

export function closeSession(expected: Cop, counted: Cop): CloseResult {
  const difference = counted - expected;
  return { expected, difference, verdict: difference === 0 ? "cuadrado" : difference > 0 ? "sobrante" : "faltante" };
}

export interface ReconciliationSummary {
  gross: Cop;
  fees: Cop;
  net: Cop;
  matched: number;
  open: number;
}

/** Bruto - comisiones = neto. Las comisiones salen del extracto, nunca de un porcentaje inventado (FR-PAY-02). */
export function reconcile(lines: readonly BankLine[]): ReconciliationSummary {
  const gross = sum(lines.map((l) => l.gross));
  const fees = sum(lines.map((l) => l.fee));
  const matched = lines.filter((l) => l.matchedPaymentId).length;
  return { gross, fees, net: gross - fees, matched, open: lines.length - matched };
}
