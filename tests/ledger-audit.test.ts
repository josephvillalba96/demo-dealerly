import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appendAudit, sha256Hex, verifyChain } from "@/domain/audit";
import { balances, credit, debit, post, reversalOf, UnbalancedTransactionError, type LedgerTx } from "@/domain/ledger";

describe("sha256", () => {
  it("coincide con el vector conocido de 'abc'", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("coincide con node:crypto en entradas variadas, incluidas multibloque y UTF-8", () => {
    for (const text of ["", "a".repeat(55), "a".repeat(56), "a".repeat(64), "a".repeat(1000), "Barranquilla, cuota número 12 ñandú"]) {
      expect(sha256Hex(text)).toBe(createHash("sha256").update(text).digest("hex"));
    }
  });
});

const tx = (id: string, entries: LedgerTx["entries"]): LedgerTx => ({ id, on: "2026-10-16", sourceType: "test", sourceId: id, memo: id, entries });

describe("ledger", () => {
  it("rechaza un asiento desbalanceado completo", () => {
    expect(() => post([], tx("a", [debit("cash", 100), credit("sales_revenue", 90)]))).toThrow(UnbalancedTransactionError);
  });

  it("acepta un asiento balanceado y suma saldos con signo deudor", () => {
    const ledger = post([], tx("a", [debit("cash", 10_000_000), credit("receivable_customer", 10_000_000)]));
    const b = balances(ledger);
    expect(b.cash).toBe(10_000_000);
    expect(b.receivable_customer).toBe(-10_000_000);
  });

  it("el reverso conserva el original y deja saldo cero", () => {
    const original = tx("a", [debit("cash", 500), credit("receivable_customer", 500)]);
    const ledger = post(post([], original), reversalOf(original, "r", "2026-10-17", "Reverso"));
    expect(ledger).toHaveLength(2);
    expect(ledger[0]).toBe(original);
    expect(balances(ledger).cash).toBe(0);
  });

  it("caso Separe del plan: inicial 5M + abono 10M, cancelar y devolver 15M", () => {
    let ledger: LedgerTx[] = [];
    ledger = post(ledger, tx("i", [debit("cash", 5_000_000), credit("customer_deposits", 5_000_000)]));
    ledger = post(ledger, tx("a", [debit("gateway_clearing", 10_000_000), credit("customer_deposits", 10_000_000)]));
    ledger = post(ledger, tx("c", [debit("customer_deposits", 15_000_000), credit("refunds_payable", 15_000_000)]));
    expect(balances(ledger).refunds_payable).toBe(-15_000_000);
    ledger = post(ledger, tx("d", [debit("refunds_payable", 15_000_000), credit("bank", 15_000_000)]));
    expect(balances(ledger).refunds_payable).toBe(0);
    expect(balances(ledger).customer_deposits).toBe(0);
  });

  it("caso proveedor del plan: obligación 30M, pago 12M deja 18M por pagar", () => {
    let ledger: LedgerTx[] = [];
    ledger = post(ledger, tx("o", [debit("inventory_vehicles", 30_000_000), credit("payable_supplier", 30_000_000)]));
    ledger = post(ledger, tx("p", [debit("payable_supplier", 12_000_000), credit("bank", 12_000_000)]));
    expect(balances(ledger).payable_supplier).toBe(-18_000_000);
  });
});

describe("auditoría encadenada", () => {
  const entry = (n: number) => ({ at: `2026-10-16T10:0${n}`, actor: "Marcela", role: "admin" as const, action: "accion", resource: `r${n}` });

  it("una cadena íntegra verifica", () => {
    let chain = appendAudit([], entry(1));
    chain = appendAudit(chain, entry(2));
    chain = appendAudit(chain, entry(3));
    expect(verifyChain(chain)).toEqual({ ok: true, length: 3 });
  });

  it("alterar una fila rompe la verificación en esa fila", () => {
    let chain = appendAudit([], entry(1));
    chain = appendAudit(chain, entry(2));
    chain = appendAudit(chain, entry(3));
    const tampered = chain.map((e) => (e.seq === 2 ? { ...e, resource: "otro" } : e));
    expect(verifyChain(tampered)).toEqual({ ok: false, brokenAtSeq: 2 });
  });

  it("borrar un evento intermedio también se detecta", () => {
    let chain = appendAudit([], entry(1));
    chain = appendAudit(chain, entry(2));
    chain = appendAudit(chain, entry(3));
    expect(verifyChain([chain[0], chain[2]]).ok).toBe(false);
  });
});
