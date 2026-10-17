import { describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { verifyChain } from "@/domain/audit";
import { agingBuckets, totalDue } from "@/domain/credit";
import { DEMO_TODAY } from "@/domain/dates";
import { assertBalanced, balances } from "@/domain/ledger";
import { confirmedCost, realizedMargin } from "@/domain/inventory";
import type { DemoData, Role } from "@/domain/types";
import { ctxFor, type Command, type Ctx } from "@/store/engine";
import { execute } from "@/store/execute";
import { changePlan, tamperAudit } from "@/store/commands/admin";
import { createUnit } from "@/store/commands/inventory";
import { scenarioDoubleReservation, scenarioDuplicateWebhook } from "@/store/commands/scenarios";
import { acceptQuote, annulSale, createQuote, formalizeSale, recordDelivery, reserveUnit, approveQuote, decideCredit, requestCredit } from "@/store/commands/sales";
import { closeCashSession, confirmPayment, payoffLoan, registerPayment, advanceRefund } from "@/store/commands/treasury";
import { addWorkLine, advanceWorkOrder, consumeLine, counterSale, openWorkOrder, reverseLine, adjustStock } from "@/store/commands/workshop";
import { portfolioAging, unitById } from "@/store/queries";

const as = (d: DemoData, memberId: string): Ctx => ctxFor(d.members.find((m) => m.id === memberId)!);
const ADMIN = "m-marcela";
const ASESOR = "m-andres";
const TESORERIA = "m-carlos";
const CARTERA = "m-daniela";
const TALLER = "m-jorge";

/** Aplica un comando y exige éxito: devuelve los datos nuevos. */
function ok<A, T>(d: DemoData, who: string, cmd: Command<A, T>, args: A): { data: DemoData; value?: T; message?: string } {
  const r = execute(d, as(d, who), cmd, args);
  if (!r.outcome.ok) throw new Error(`Se esperaba éxito pero falló: ${r.outcome.error}`);
  return { data: r.data, value: r.outcome.value, message: r.outcome.message };
}

function bad<A, T>(d: DemoData, who: string, cmd: Command<A, T>, args: A): string {
  const r = execute(d, as(d, who), cmd, args);
  if (r.outcome.ok) throw new Error("Se esperaba un fallo pero tuvo éxito");
  expect(r.data).toBe(d); // los datos originales quedan intactos
  return r.outcome.error;
}

function ledgerIsBalanced(d: DemoData) {
  for (const tx of d.ledger) assertBalanced(tx.entries);
  const total = Object.values(balances(d.ledger)).reduce((a, b) => a + b, 0);
  expect(total).toBe(0);
}

describe("semilla", () => {
  it("el libro de apertura balancea y la bitácora verifica", () => {
    const d = createSeed();
    ledgerIsBalanced(d);
    expect(verifyChain(d.audit).ok).toBe(true);
  });

  it("no hay existencias negativas ni VIN duplicados activos", () => {
    const d = createSeed();
    expect(d.stock.every((s) => s.onHand >= 0)).toBe(true);
    const vins = d.units.map((u) => u.vin);
    expect(new Set(vins).size).toBe(vins.length);
  });

  it("el kardex suma exactamente la existencia", () => {
    const d = createSeed();
    for (const s of d.stock) {
      const sum = d.movements.filter((m) => m.partId === s.partId && m.branchId === s.branchId).reduce((a, m) => a + m.qty, 0);
      expect(sum).toBe(s.onHand);
    }
  });

  it("la cartera sembrada muestra mora en varias franjas", () => {
    const d = createSeed();
    const aging = portfolioAging(d, DEMO_TODAY);
    expect(aging.d1_30).toBeGreaterThan(0);
    expect(aging.d31_60).toBeGreaterThan(0);
    expect(aging.d90plus).toBeGreaterThan(0);
  });
});

describe("permisos y plan", () => {
  it("un asesor no confirma pagos ni aprueba créditos", () => {
    const d = createSeed();
    expect(bad(d, ASESOR, confirmPayment, { paymentId: "pay-l2-down-2" })).toContain("no tiene permiso");
    expect(bad(d, ASESOR, decideCredit, { applicationId: "ca-1", approve: true, note: "" })).toContain("no tiene permiso");
  });

  it("bajar a Básico no borra nada: pausa lo que excede y bloquea crédito propio", () => {
    const d0 = createSeed();
    const before = d0.listings.length;
    const { data } = ok(d0, ADMIN, changePlan, { planId: "basico" });
    expect(data.listings.length).toBe(before);
    expect(data.loans.length).toBe(d0.loans.length);
    const r = execute(data, as(data, ASESOR), requestCredit, { unitId: "u01", applicant: { name: "X", doc: "1" }, monthlyIncome: 5_000_000, amount: 10_000_000, months: 24, eaPercent: 22 });
    expect(r.outcome.ok).toBe(false);
  });
});

describe("reserva exclusiva y escenarios", () => {
  it("dos asesores a la vez: una reserva activa", () => {
    const d = createSeed();
    const { data, message } = ok(d, ADMIN, scenarioDoubleReservation, undefined);
    expect(data.reservations.filter((r) => r.unitId === "u04" && r.status === "active")).toHaveLength(1);
    expect(message).toContain("Valentina");
    expect(unitById(data, "u04")?.status).toBe("reserved");
  });

  it("no se puede reservar con una cotización sin aceptar", () => {
    const d = createSeed();
    const q = ok(d, ASESOR, createQuote, { unitId: "u01", buyer: { name: "Cliente Uno", doc: "123" }, discount: 0 });
    expect(bad(q.data, ASESOR, reserveUnit, { unitId: "u01", quoteId: q.value, buyer: { name: "Cliente Uno", doc: "123" }, deposit: 0, days: 3 })).toContain("aceptada");
  });

  it("descuento superior al 3 % queda pendiente y solo el administrador lo aprueba", () => {
    const d = createSeed();
    const q = ok(d, ASESOR, createQuote, { unitId: "u01", buyer: { name: "Cliente Uno", doc: "123" }, discount: 3_000_000 });
    const quote = q.data.quotes.find((x) => x.id === q.value)!;
    expect(quote.status).toBe("pending_approval");
    expect(bad(q.data, ASESOR, approveQuote, { quoteId: quote.id, approve: true })).toContain("no tiene permiso");
    const approved = ok(q.data, ADMIN, approveQuote, { quoteId: quote.id, approve: true });
    expect(approved.data.quotes.find((x) => x.id === quote.id)?.status).toBe("issued");
  });
});

describe("pago duplicado (idempotencia)", () => {
  it("el mismo evento tres veces produce un solo efecto", () => {
    const d = createSeed();
    const { data } = ok(d, TESORERIA, scenarioDuplicateWebhook, undefined);
    const p = data.payments.find((x) => x.id === "pay-pending-nequi")!;
    expect(p.status).toBe("confirmed");
    expect(data.ledger.filter((t) => t.sourceType === "payment" && t.sourceId === p.id)).toHaveLength(1);
    ledgerIsBalanced(data);
  });

  it("confirmar de nuevo un pago ya aplicado se ignora sin crear asientos", () => {
    const d = createSeed();
    const first = ok(d, TESORERIA, confirmPayment, { paymentId: "pay-l2-down-2" });
    const again = ok(first.data, TESORERIA, confirmPayment, { paymentId: "pay-l2-down-2" });
    expect(again.message).toContain("duplicado");
    expect(again.data.ledger.length).toBe(first.data.ledger.length);
  });
});

describe("venta de principio a fin: crédito propio", () => {
  it("cotizar, reservar, aprobar crédito, formalizar, confirmar inicial, entregar", () => {
    let d = createSeed();
    const buyer = { name: "Lucía Barrios", doc: "55.100.200" };
    const q = ok(d, ASESOR, createQuote, { unitId: "u01", buyer, discount: 1_000_000 });
    d = q.data;
    d = ok(d, ASESOR, acceptQuote, { quoteId: q.value! }).data;
    d = ok(d, ASESOR, reserveUnit, { unitId: "u01", quoteId: q.value, buyer, deposit: 0, days: 3 }).data;
    expect(bad(d, ASESOR, formalizeSale, { unitId: "u01", buyer, modality: "own_credit", netPrice: 53_900_000, downPayment: 14_000_000, method: "transfer" })).toContain("aprobación de crédito");

    const app = ok(d, ASESOR, requestCredit, { unitId: "u01", applicant: buyer, monthlyIncome: 7_000_000, amount: 39_900_000, months: 36, eaPercent: 22 });
    d = ok(app.data, CARTERA, decideCredit, { applicationId: app.value!, approve: true, note: "Aprobado" }).data;

    const sale = ok(d, ASESOR, formalizeSale, { unitId: "u01", buyer, modality: "own_credit", netPrice: 53_900_000, downPayment: 14_000_000, method: "transfer" });
    d = sale.data;
    const saleRec = d.sales.find((s) => s.id === sale.value)!;
    const loan = d.loans.find((l) => l.id === saleRec.loanId)!;
    expect(loan.principal).toBe(39_900_000);
    expect(loan.installments.reduce((a, i) => a + i.principal, 0)).toBe(39_900_000);
    expect(unitById(d, "u01")?.status).toBe("sold");

    expect(bad(d, ASESOR, recordDelivery, { saleId: saleRec.id, receiver: "Lucía" })).toContain("cuota inicial");
    const downPay = d.payments.find((p) => p.targetId === saleRec.id)!;
    d = ok(d, TESORERIA, confirmPayment, { paymentId: downPay.id }).data;
    d = ok(d, ASESOR, recordDelivery, { saleId: saleRec.id, receiver: "Lucía Barrios" }).data;
    expect(unitById(d, "u01")?.status).toBe("delivered");
    ledgerIsBalanced(d);
    expect(verifyChain(d.audit).ok).toBe(true);
  });

  it("un pago de cuota se distribuye entre interés y capital y un reintento no vuelve a amortizar", () => {
    const d0 = createSeed();
    const loan0 = d0.loans.find((l) => l.id === "l1")!;
    const due = totalDue(loan0.installments);
    const reg = ok(d0, TESORERIA, registerPayment, { targetType: "installment", targetId: "l1", amount: 2_000_000, method: "transfer", confirmNow: true });
    const loan = reg.data.loans.find((l) => l.id === "l1")!;
    expect(totalDue(loan.installments)).toBe(due - 2_000_000);
    const p = reg.data.payments.find((x) => x.id === reg.value)!;
    expect(p.allocations?.reduce((a, x) => a + x.amount, 0)).toBe(2_000_000);
    const again = ok(reg.data, TESORERIA, confirmPayment, { paymentId: p.id });
    expect(totalDue(again.data.loans.find((l) => l.id === "l1")!.installments)).toBe(due - 2_000_000);
    ledgerIsBalanced(reg.data);
  });

  it("no acepta pagos por encima de lo adeudado", () => {
    const d = createSeed();
    const due = totalDue(d.loans.find((l) => l.id === "l1")!.installments);
    expect(bad(d, TESORERIA, registerPayment, { targetType: "installment", targetId: "l1", amount: due + 1, method: "transfer", confirmNow: true })).toContain("excedente");
  });

  it("liquidación anticipada cierra el crédito sin cobrar intereses futuros", () => {
    const d0 = createSeed();
    const r = ok(d0, TESORERIA, payoffLoan, { loanId: "l2", method: "transfer", confirmNow: true });
    const loan = r.data.loans.find((l) => l.id === "l2")!;
    expect(loan.status).toBe("paid_off");
    expect(totalDue(loan.installments)).toBe(0);
    const paid = r.data.payments.find((p) => p.id === r.value)!;
    expect(paid.amount).toBeLessThan(d0.loans.find((l) => l.id === "l2")!.installments.reduce((a, i) => a + i.total, 0));
    ledgerIsBalanced(r.data);
    expect(agingBuckets(loan.installments, DEMO_TODAY).total).toBe(0);
  });
});

describe("anulación y devolución", () => {
  it("anular conserva el original, deja devolución pendiente y no devuelve dinero solo", () => {
    const d0 = createSeed();
    const { data } = ok(d0, ADMIN, annulSale, { saleId: "v6", reason: "Cliente desiste" });
    expect(data.sales.find((s) => s.id === "v6")?.status).toBe("annulled");
    const refund = data.refunds.find((r) => r.saleId === "v6")!;
    expect(refund.status).toBe("requested");
    expect(refund.amount).toBe(40_000_000);
    expect(data.ledger.some((t) => t.reverses)).toBe(true);
    ledgerIsBalanced(data);
    expect(unitById(data, "u17")?.status).toBe("available");
  });

  it("la devolución solo reduce banco cuando se confirma", () => {
    let d = createSeed();
    const bankBefore = balances(d.ledger).bank;
    d = ok(d, TESORERIA, advanceRefund, { refundId: "rf1" }).data; // aprobada
    d = ok(d, TESORERIA, advanceRefund, { refundId: "rf1" }).data; // enviada
    expect(balances(d.ledger).bank).toBe(bankBefore);
    d = ok(d, TESORERIA, advanceRefund, { refundId: "rf1" }).data; // confirmada
    expect(balances(d.ledger).bank).toBe(bankBefore - 15_000_000);
    ledgerIsBalanced(d);
  });
});

describe("taller y repuestos: margen real (B.2-13)", () => {
  it("consumir repuestos y mano de obra suma al costo y el margen se reproduce", () => {
    let d = createSeed();
    const base = confirmedCost(d.costs, "u01");
    d = ok(d, TALLER, openWorkOrder, { unitId: "u01", branchId: "norte", bay: "Bahía 2", technicianId: "m-luis", description: "Mantenimiento preventivo", budget: 600_000 }).data;
    const wo = d.workOrders.find((w) => w.unitId === "u01")!;
    expect(bad(d, TALLER, consumeLine, { orderId: wo.id, lineId: "x" })).toBeTruthy();
    d = ok(d, TALLER, advanceWorkOrder, { orderId: wo.id }).data;
    d = ok(d, TALLER, advanceWorkOrder, { orderId: wo.id }).data; // aprobada
    d = ok(d, TALLER, addWorkLine, { orderId: wo.id, kind: "part", description: "", partId: "p01", qty: 1 }).data;
    d = ok(d, TALLER, addWorkLine, { orderId: wo.id, kind: "labor", description: "Mano de obra", qty: 2, unitCost: 45_000 }).data;
    const lines = d.workOrders.find((w) => w.id === wo.id)!.lines;
    const stockBefore = d.stock.find((s) => s.partId === "p01" && s.branchId === "norte")!.onHand;
    for (const l of lines) d = ok(d, TALLER, consumeLine, { orderId: wo.id, lineId: l.id }).data;
    const added = 19_500 + 2 * 45_000;
    expect(confirmedCost(d.costs, "u01")).toBe(base + added);
    expect(d.stock.find((s) => s.partId === "p01" && s.branchId === "norte")!.onHand).toBe(stockBefore - 1);
    ledgerIsBalanced(d);
    const unit = unitById(d, "u01")!;
    const margin = realizedMargin({ unitId: "u01", netPrice: unit.listPrice } as never, d.costs);
    expect(margin).toBe(unit.listPrice - (base + added));
  });

  it("revertir un consumo compensa kardex, costo y libro y conserva el original", () => {
    let d = createSeed();
    const wo = d.workOrders.find((w) => w.id === "wo1")!;
    const line = wo.lines.find((l) => l.status === "confirmed" && l.partId)!;
    const costBefore = confirmedCost(d.costs, wo.unitId);
    const stockBefore = d.stock.find((s) => s.partId === line.partId && s.branchId === wo.branchId)!.onHand;
    d = ok(d, TALLER, reverseLine, { orderId: wo.id, lineId: line.id }).data;
    expect(confirmedCost(d.costs, wo.unitId)).toBe(costBefore - line.qty * line.unitCost);
    expect(d.stock.find((s) => s.partId === line.partId && s.branchId === wo.branchId)!.onHand).toBe(stockBefore + line.qty);
    expect(d.ledger.some((t) => t.reverses)).toBe(true);
    ledgerIsBalanced(d);
  });

  it("sin existencia no se confirma nada", () => {
    let d = createSeed();
    d = ok(d, TALLER, advanceWorkOrder, { orderId: "wo5" }).data; // approved -> in_progress
    d = ok(d, TALLER, addWorkLine, { orderId: "wo5", kind: "part", description: "", partId: "p13", qty: 50 }).data;
    const line = d.workOrders.find((w) => w.id === "wo5")!.lines.slice(-1)[0];
    const msg = bad(d, TALLER, consumeLine, { orderId: "wo5", lineId: line.id });
    expect(msg).toContain("Existencia insuficiente");
  });

  it("venta de mostrador descuenta kardex y deja el cobro pendiente para Tesorería", () => {
    const d0 = createSeed();
    const before = d0.stock.find((s) => s.partId === "p03" && s.branchId === "norte")!.onHand;
    const { data } = ok(d0, TALLER, counterSale, { customer: "Cliente", branchId: "norte", method: "nequi", lines: [{ partId: "p03", qty: 2 }] });
    expect(data.stock.find((s) => s.partId === "p03" && s.branchId === "norte")!.onHand).toBe(before - 2);
    expect(data.payments.at(-1)?.status).toBe("pending");
    ledgerIsBalanced(data);
  });

  it("el ajuste por conteo físico queda explicado por un movimiento", () => {
    const d0 = createSeed();
    const level = d0.stock.find((s) => s.partId === "p14" && s.branchId === "norte")!;
    const { data } = ok(d0, TALLER, adjustStock, { partId: "p14", branchId: "norte", counted: level.onHand - 2, loss: true, reason: "Conteo físico" });
    expect(data.movements.at(-1)?.type).toBe("loss");
    ledgerIsBalanced(data);
  });
});

describe("caja", () => {
  it("el cierre calcula esperado y diferencia, y exige abrir caja antes de recibir efectivo", () => {
    let d = createSeed();
    const session = d.cashSessions.find((s) => s.id === "cs-norte-0")!;
    d = ok(d, TESORERIA, closeCashSession, { sessionId: session.id, counted: 1_000_000, withdrawal: 700_000, nextBase: 300_000 }).data;
    const closed = d.cashSessions.find((s) => s.id === session.id)!;
    expect(closed.status).toBe("closed");
    expect(closed.expected).toBe(300_000 + 1_000_000 + 54_000 + 56_000 - 38_000);
    expect(closed.difference).toBe(1_000_000 - closed.expected!);
    const r = registerPayment(structuredClone(d), as(d, TESORERIA), { targetType: "sale", targetId: "v4", amount: 8_000_000, method: "cash", confirmNow: true });
    expect(r.ok).toBe(false);
  });
});

describe("alta de unidad", () => {
  const args = { kind: "motorcycle" as const, make: "Honda", model: "XR 150", trim: "L", year: 2022, km: 9_000, plate: "ZZZ 11F", vin: "9C2KD0600NR000123", color: "Rojo", branchId: "norte" as const, listPrice: 11_500_000, acquisitionCost: 9_000_000, supplier: "Subastas Andina S.A." };

  it("crea unidad, costo, obligación y asiento; el VIN duplicado se bloquea", () => {
    const d0 = createSeed();
    const { data, value } = ok(d0, ASESOR, createUnit, args);
    const u = unitById(data, value!)!;
    expect(u.photos.map((p) => p.code)).not.toContain("trunk");
    expect(confirmedCost(data.costs, u.id)).toBe(9_000_000);
    expect(data.obligations.at(-1)?.outstanding).toBe(9_000_000);
    ledgerIsBalanced(data);
    expect(bad(data, ASESOR, createUnit, args)).toContain("VIN");
  });
});

describe("bitácora", () => {
  it("las acciones se encadenan y alterar una fila se detecta", () => {
    let d = createSeed();
    d = ok(d, ADMIN, changePlan, { planId: "grupo" }).data;
    expect(verifyChain(d.audit).ok).toBe(true);
    d = ok(d, ADMIN, tamperAudit, { seq: 2 }).data;
    expect(verifyChain(d.audit)).toEqual({ ok: false, brokenAtSeq: 2 });
  });
});

describe("roles ficticios", () => {
  it("cada rol del demo tiene un usuario", () => {
    const d = createSeed();
    const roles: Role[] = ["admin", "asesor", "tesoreria", "cartera", "taller"];
    for (const role of roles) expect(d.members.some((m) => m.role === role && m.status === "active")).toBe(true);
  });
});
