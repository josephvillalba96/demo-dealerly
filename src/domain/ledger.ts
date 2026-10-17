import type { IsoDate } from "./dates";
import { sum, type Cop } from "./money";

export type Account =
  | "cash"
  | "bank"
  | "gateway_clearing"
  | "receivable_customer"
  | "inventory_vehicles"
  | "inventory_parts"
  | "payable_supplier"
  | "customer_deposits"
  | "refunds_payable"
  | "sales_revenue"
  | "parts_revenue"
  | "interest_income"
  | "cost_of_sales"
  | "labor_absorbed"
  | "inventory_loss"
  | "expenses"
  | "equity";

export const ACCOUNT_LABELS: Record<Account, string> = {
  cash: "Efectivo en caja",
  bank: "Bancos",
  gateway_clearing: "Pasarela por liquidar",
  receivable_customer: "Cuentas por cobrar clientes",
  inventory_vehicles: "Inventario de vehículos",
  inventory_parts: "Inventario de repuestos",
  payable_supplier: "Cuentas por pagar proveedores",
  customer_deposits: "Anticipos de clientes",
  refunds_payable: "Devoluciones por pagar",
  sales_revenue: "Ingresos por venta de vehículos",
  parts_revenue: "Ingresos por repuestos",
  interest_income: "Ingresos por intereses",
  cost_of_sales: "Costo de ventas",
  labor_absorbed: "Mano de obra absorbida",
  inventory_loss: "Pérdidas de inventario",
  expenses: "Gastos operativos",
  equity: "Patrimonio de apertura",
};

export interface LedgerEntry {
  account: Account;
  side: "debit" | "credit";
  amount: Cop;
}

export interface LedgerTx {
  id: string;
  on: IsoDate;
  sourceType: string;
  sourceId: string;
  memo: string;
  entries: LedgerEntry[];
  reverses?: string;
}

export const debit = (account: Account, amount: Cop): LedgerEntry => ({ account, side: "debit", amount });
export const credit = (account: Account, amount: Cop): LedgerEntry => ({ account, side: "credit", amount });

export class UnbalancedTransactionError extends Error {
  constructor(
    public readonly debits: Cop,
    public readonly credits: Cop,
  ) {
    super(`Asiento desbalanceado: débitos ${debits} distinto de créditos ${credits}`);
    this.name = "UnbalancedTransactionError";
  }
}

/** Invariante FR-PAY-07: Σ débitos = Σ créditos y todo importe es positivo. */
export function assertBalanced(entries: readonly LedgerEntry[]): void {
  if (entries.length < 2) throw new Error("Un asiento necesita al menos dos movimientos");
  if (entries.some((e) => e.amount <= 0)) throw new Error("Los importes del asiento deben ser positivos");
  const debits = sum(entries.filter((e) => e.side === "debit").map((e) => e.amount));
  const credits = sum(entries.filter((e) => e.side === "credit").map((e) => e.amount));
  if (debits !== credits) throw new UnbalancedTransactionError(debits, credits);
}

/** Agrega un asiento al libro sin mutarlo. Falla completo si no balancea. */
export function post(ledger: readonly LedgerTx[], tx: LedgerTx): LedgerTx[] {
  assertBalanced(tx.entries);
  return [...ledger, tx];
}

/** Reverso: lados invertidos y referencia al original; el original no se toca. */
export function reversalOf(original: LedgerTx, id: string, on: IsoDate, memo: string): LedgerTx {
  return {
    id,
    on,
    sourceType: original.sourceType,
    sourceId: original.sourceId,
    memo,
    reverses: original.id,
    entries: original.entries.map((e) => ({ ...e, side: e.side === "debit" ? "credit" : "debit" })),
  };
}

/** Saldo de cada cuenta con signo deudor positivo. */
export function balances(ledger: readonly LedgerTx[]): Record<Account, Cop> {
  const result = {} as Record<Account, Cop>;
  for (const key of Object.keys(ACCOUNT_LABELS) as Account[]) result[key] = 0;
  for (const tx of ledger) {
    for (const e of tx.entries) result[e.account] += e.side === "debit" ? e.amount : -e.amount;
  }
  return result;
}
