import { allocatePayment, payoffQuote, settleInstallments, totalDue } from "@/domain/credit";
import { credit, debit } from "@/domain/ledger";
import { formatCop, sum, type Cop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { closeSession, expectedCash, isDuplicateRef, METHOD_LABELS } from "@/domain/treasury";
import type { BranchId, DemoData, PayMethod, PayTarget } from "@/domain/types";
import { audit, branchOpenSession, denied, done, fail, moneyAccount, postTx, serial, uid, type Command, type Outcome } from "../engine";
import { confirmedIn, pendingIn, unitById } from "../queries";

function branchForTarget(d: DemoData, targetType: PayTarget, targetId: string): BranchId {
  const sale =
    targetType === "sale"
      ? d.sales.find((s) => s.id === targetId)
      : targetType === "installment"
        ? d.sales.find((s) => s.loanId === targetId)
        : targetType === "layaway"
          ? d.sales.find((s) => s.layawayId === targetId)
          : targetType === "external"
            ? d.sales.find((s) => s.caseId === targetId)
            : undefined;
  if (sale) return unitById(d, sale.unitId)?.branchId ?? "norte";
  if (targetType === "reservation") {
    const r = d.reservations.find((x) => x.id === targetId);
    return (r && unitById(d, r.unitId)?.branchId) || "norte";
  }
  return "norte";
}

export interface RegisterPaymentArgs {
  targetType: Extract<PayTarget, "installment" | "sale" | "layaway" | "external">;
  targetId: string;
  amount: Cop;
  method: PayMethod;
  ref?: string;
  /** Si el actor puede confirmar dinero, registra y confirma en un solo paso. */
  confirmNow?: boolean;
  settlesLoan?: boolean;
}

/** Registra un pago pendiente. El dinero solo cuenta cuando Tesorería lo confirma (FR-PAY-01). */
export const registerPayment: Command<RegisterPaymentArgs, string> = (d, ctx, a) => {
  if (!can(ctx.role, "credit.collect") && !can(ctx.role, "sale.write") && !can(ctx.role, "payment.confirm")) return denied(ctx, "payment.confirm")!;
  if (a.amount <= 0) return fail("El importe debe ser mayor que cero.");
  let counterparty = "";
  let concept = "";
  let remaining: Cop = 0;

  if (a.targetType === "installment") {
    const loan = d.loans.find((l) => l.id === a.targetId);
    if (!loan || loan.status !== "active") return fail("El crédito no está activo.");
    counterparty = loan.borrower.name;
    concept = a.settlesLoan ? "Liquidación anticipada del crédito" : "Pago de cuota";
    remaining = a.settlesLoan ? payoffQuote(loan.installments, ctx.today).total : totalDue(loan.installments) - pendingIn(d, "installment", loan.id);
    if (a.settlesLoan && a.amount !== remaining) return fail(`La liquidación a hoy es exactamente ${formatCop(remaining)}.`);
  } else if (a.targetType === "sale") {
    const sale = d.sales.find((s) => s.id === a.targetId);
    if (!sale || sale.status === "annulled") return fail("La venta no admite pagos.");
    counterparty = sale.buyer.name;
    concept = sale.modality === "cash" ? `Pago de contado ${sale.number}` : `Cuota inicial ${sale.number}`;
    const target = sale.modality === "cash" ? sale.netPrice : sale.downPayment;
    remaining = target - confirmedIn(d, "sale", sale.id) - pendingIn(d, "sale", sale.id);
  } else if (a.targetType === "layaway") {
    const ly = d.layaways.find((l) => l.id === a.targetId);
    if (!ly || ly.status !== "active") return fail("El Plan Separe no está activo.");
    counterparty = ly.buyer.name;
    concept = "Abono Plan Separe";
    remaining = ly.total - ly.paid - pendingIn(d, "layaway", ly.id);
  } else {
    const c = d.externalCases.find((x) => x.id === a.targetId);
    if (!c || c.status !== "approved") return fail("El banco aún no aprobó la financiación.");
    counterparty = c.entity;
    concept = "Desembolso del banco";
    remaining = (c.approvedAmount ?? 0) - pendingIn(d, "external", c.id);
  }
  if (a.amount > remaining) return fail(`El importe supera lo pendiente (${formatCop(Math.max(0, remaining))}). El excedente se debe devolver o aplicar con autorización.`);

  const ref = a.ref?.trim() || `${a.method === "cash" ? "EFE" : a.method === "transfer" ? "TRF" : a.method.toUpperCase()}-${serial(d, "payref", "R")}`;
  if (d.payments.some((p) => p.ref === ref)) return fail(`La referencia ${ref} ya está registrada. Una referencia no puede aplicarse a dos negocios.`);
  const id = uid(d, "pay");
  d.payments.push({
    id,
    direction: "in",
    amount: a.amount,
    method: a.method,
    status: "pending",
    ref,
    counterparty,
    concept,
    targetType: a.targetType,
    targetId: a.targetId,
    branchId: branchForTarget(d, a.targetType, a.targetId),
    on: ctx.today,
    settlesLoan: a.settlesLoan,
  });
  audit(d, ctx, `Registró pago pendiente ${formatCop(a.amount)} (${METHOD_LABELS[a.method]}) de ${counterparty}`, `pago ${id}`);
  if (a.confirmNow && can(ctx.role, "payment.confirm")) {
    const confirmed = confirmPayment(d, ctx, { paymentId: id });
    return confirmed.ok ? done(confirmed.message, id) : confirmed;
  }
  return done("Pago registrado como pendiente. Tesorería debe confirmarlo para que cuente.", id);
};

/**
 * Confirma un recaudo y lo aplica. Es idempotente por referencia: un evento repetido no crea
 * un segundo pago ni vuelve a amortizar (NFR-REL-01). El retorno del navegador nunca confirma.
 */
export const confirmPayment: Command<{ paymentId: string }, { duplicate: boolean }> = (d, ctx, a) => {
  const no = denied(ctx, "payment.confirm");
  if (no) return no;
  const p = d.payments.find((x) => x.id === a.paymentId);
  if (!p) return fail("Pago no encontrado.");
  if (p.status === "confirmed" && isDuplicateRef(d.processedRefs, p.ref)) {
    audit(d, ctx, `Ignoró evento duplicado de ${p.ref}`, `pago ${p.id}`);
    return done(`Evento duplicado ignorado: la referencia ${p.ref} ya estaba aplicada. No se creó ningún efecto nuevo.`, { duplicate: true });
  }
  if (p.status !== "pending") return fail(`El pago está ${p.status} y no se puede confirmar.`);
  if (p.direction !== "in") return fail("Solo se confirman recaudos desde esta pantalla.");
  if (p.method === "cash") {
    const session = branchOpenSession(d, p.branchId);
    if (!session) return fail("Abre la caja de la sede antes de recibir efectivo.");
    p.sessionId = session.id;
  }
  const money = moneyAccount(p.method);

  if (p.targetType === "installment") {
    const loan = d.loans.find((l) => l.id === p.targetId);
    if (!loan) return fail("Crédito no encontrado.");
    if (p.settlesLoan) {
      const quote = payoffQuote(loan.installments, ctx.today);
      loan.installments = settleInstallments(loan.installments, ctx.today);
      loan.status = "paid_off";
      p.allocations = [
        { label: "Capital pendiente", amount: quote.principal },
        { label: "Intereses vencidos", amount: quote.overdueInterest },
        { label: "Intereses causados de la cuota en curso", amount: quote.accruedInterest },
      ].filter((x) => x.amount > 0);
      const entries = [debit(money, p.amount), credit("receivable_customer", quote.principal)];
      if (quote.overdueInterest + quote.accruedInterest > 0) entries.push(credit("interest_income", quote.overdueInterest + quote.accruedInterest));
      postTx(d, ctx, "payment", p.id, `Liquidación anticipada ${p.ref}`, entries);
    } else {
      const result = allocatePayment(loan.installments, p.amount, ctx.today);
      if (result.surplus > 0) return fail(`El pago excede lo adeudado en ${formatCop(result.surplus)}.`);
      loan.installments = result.installments;
      const toInterest = sum(result.allocations.map((x) => x.toInterest));
      const toPrincipal = sum(result.allocations.map((x) => x.toPrincipal));
      p.allocations = result.allocations.flatMap((x) => [
        ...(x.toInterest ? [{ label: `Cuota ${x.number}: intereses`, amount: x.toInterest }] : []),
        ...(x.toPrincipal ? [{ label: `Cuota ${x.number}: capital`, amount: x.toPrincipal }] : []),
      ]);
      const entries = [debit(money, p.amount)];
      if (toPrincipal) entries.push(credit("receivable_customer", toPrincipal));
      if (toInterest) entries.push(credit("interest_income", toInterest));
      postTx(d, ctx, "payment", p.id, `Cuota ${p.ref}`, entries);
      if (totalDue(loan.installments) === 0) loan.status = "paid_off";
    }
  } else if (p.targetType === "layaway") {
    const ly = d.layaways.find((l) => l.id === p.targetId);
    if (!ly) return fail("Plan Separe no encontrado.");
    ly.paid += p.amount;
    if (ly.paid >= ly.total) ly.status = "completed";
    p.allocations = [{ label: "Abono al Plan Separe", amount: p.amount }];
    postTx(d, ctx, "payment", p.id, `Abono Separe ${p.ref}`, [debit(money, p.amount), credit("receivable_customer", p.amount)]);
  } else if (p.targetType === "external") {
    const c = d.externalCases.find((x) => x.id === p.targetId);
    if (!c) return fail("Expediente externo no encontrado.");
    c.status = "disbursed";
    c.disbursedPaymentId = p.id;
    p.allocations = [{ label: `Desembolso de ${c.entity}`, amount: p.amount }];
    postTx(d, ctx, "payment", p.id, `Desembolso ${c.entity}`, [debit(money, p.amount), credit("receivable_customer", p.amount)]);
  } else if (p.targetType === "reservation") {
    p.allocations = [{ label: "Anticipo de reserva", amount: p.amount }];
    postTx(d, ctx, "payment", p.id, `Anticipo ${p.ref}`, [debit(money, p.amount), credit("customer_deposits", p.amount)]);
  } else if (p.targetType === "counter_sale") {
    p.allocations = [{ label: "Venta de mostrador", amount: p.amount }];
    postTx(d, ctx, "payment", p.id, `Mostrador ${p.ref}`, [debit(money, p.amount), credit("parts_revenue", p.amount)]);
  } else {
    p.allocations = [{ label: "Pago de venta", amount: p.amount }];
    postTx(d, ctx, "payment", p.id, `Pago ${p.ref}`, [debit(money, p.amount), credit("receivable_customer", p.amount)]);
  }
  p.status = "confirmed";
  d.processedRefs.push(p.ref);
  audit(d, ctx, `Confirmó ${formatCop(p.amount)} (${METHOD_LABELS[p.method]}) ref ${p.ref}`, `pago ${p.id}`);
  return done(`Pago confirmado y aplicado: ${p.allocations?.map((x) => `${x.label} ${formatCop(x.amount)}`).join(", ")}.`, { duplicate: false });
};

export const failPayment: Command<{ paymentId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "payment.confirm");
  if (no) return no;
  const p = d.payments.find((x) => x.id === a.paymentId);
  if (!p || p.status !== "pending") return fail("El pago no está pendiente.");
  p.status = "failed";
  audit(d, ctx, `Marcó como fallido el pago ${p.ref}`, `pago ${p.id}`);
  return done("Pago marcado como fallido. El saldo del cliente no cambia.");
};

/** Reenvía el mismo evento de la pasarela varias veces para mostrar la idempotencia. */
export const replayWebhook: Command<{ paymentId: string; times: number }> = (d, ctx, a) => {
  let first: Outcome<{ duplicate: boolean }> | null = null;
  let ignored = 0;
  for (let i = 0; i < a.times; i++) {
    const r = confirmPayment(d, ctx, { paymentId: a.paymentId });
    if (!r.ok) return r;
    if (!first) first = r;
    else if (r.value?.duplicate) ignored += 1;
  }
  return done(`El evento llegó ${a.times} veces: se aplicó 1 y se ignoraron ${ignored}. Un solo efecto en pagos, cartera y libro.`);
};

export const payoffLoan: Command<{ loanId: string; method: PayMethod; confirmNow?: boolean }, string> = (d, ctx, a) => {
  const loan = d.loans.find((l) => l.id === a.loanId);
  if (!loan) return fail("Crédito no encontrado.");
  const quote = payoffQuote(loan.installments, ctx.today);
  return registerPayment(d, ctx, { targetType: "installment", targetId: loan.id, amount: quote.total, method: a.method, settlesLoan: true, confirmNow: a.confirmNow });
};

/* ---------------- Proveedores y egresos ---------------- */

export const paySupplier: Command<{ obligationId: string; amount: Cop; method: PayMethod }> = (d, ctx, a) => {
  const no = denied(ctx, "payment.out");
  if (no) return no;
  const o = d.obligations.find((x) => x.id === a.obligationId);
  if (!o) return fail("Obligación no encontrada.");
  if (a.amount <= 0) return fail("El importe debe ser mayor que cero.");
  if (a.amount > o.outstanding) return fail(`El pago supera el saldo de la obligación (${formatCop(o.outstanding)}).`);
  const branchId: BranchId = "norte";
  let sessionId: string | undefined;
  if (a.method === "cash") {
    const s = branchOpenSession(d, branchId);
    if (!s) return fail("Abre la caja de la sede antes de pagar en efectivo.");
    sessionId = s.id;
  }
  o.outstanding -= a.amount;
  const id = uid(d, "pay");
  d.payments.push({
    id,
    direction: "out",
    amount: a.amount,
    method: a.method,
    status: "confirmed",
    ref: `${a.method === "cash" ? "EFE" : "TRF"}-${serial(d, "payref", "R")}`,
    counterparty: o.supplier,
    concept: `Pago a ${o.supplier} (${o.docRef})`,
    targetType: "supplier",
    targetId: o.id,
    branchId,
    on: ctx.today,
    sessionId,
    allocations: [{ label: `Obligación ${o.docRef}`, amount: a.amount }],
  });
  postTx(d, ctx, "payment", id, `Pago a proveedor ${o.supplier}`, [debit("payable_supplier", a.amount), credit(moneyAccount(a.method), a.amount)]);
  audit(d, ctx, `Pagó ${formatCop(a.amount)} a ${o.supplier}`, `obligación ${o.id}`);
  return done(o.outstanding === 0 ? "Obligación saldada." : `Pago aplicado. La cuenta por pagar queda en ${formatCop(o.outstanding)}.`);
};

export const recordExpense: Command<{ concept: string; amount: Cop; method: "cash" | "transfer"; branchId: BranchId }> = (d, ctx, a) => {
  const no = denied(ctx, "payment.out");
  if (no) return no;
  if (!a.concept.trim() || a.amount <= 0) return fail("Escribe el concepto y un importe mayor que cero.");
  let sessionId: string | undefined;
  if (a.method === "cash") {
    const s = branchOpenSession(d, a.branchId);
    if (!s) return fail("Abre la caja de la sede antes de registrar un gasto en efectivo.");
    sessionId = s.id;
  }
  const id = uid(d, "e");
  d.expenses.push({ id, concept: a.concept.trim(), amount: a.amount, method: a.method, status: "confirmed", branchId: a.branchId, on: ctx.today, sessionId });
  postTx(d, ctx, "expense", id, a.concept, [debit("expenses", a.amount), credit(a.method === "cash" ? "cash" : "bank", a.amount)]);
  audit(d, ctx, `Registró egreso ${formatCop(a.amount)}: ${a.concept}`, `egreso ${id}`);
  return done("Egreso registrado y descontado del medio correcto.");
};

/* ---------------- Devoluciones ---------------- */

export const advanceRefund: Command<{ refundId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "refund.approve");
  if (no) return no;
  const r = d.refunds.find((x) => x.id === a.refundId);
  if (!r) return fail("Devolución no encontrada.");
  const next = ({ requested: "approved", approved: "sent", sent: "confirmed", failed: "sent" } as const)[r.status as "requested" | "approved" | "sent" | "failed"];
  if (!next) return fail("La devolución ya está confirmada.");
  if (next === "confirmed") {
    const id = uid(d, "pay");
    d.payments.push({
      id,
      direction: "out",
      amount: r.amount,
      method: "transfer",
      status: "confirmed",
      ref: `TRF-${r.id}`,
      counterparty: r.buyer,
      concept: `Devolución ${r.id}`,
      targetType: "refund",
      targetId: r.id,
      branchId: "norte",
      on: ctx.today,
      allocations: [{ label: "Devolución al cliente", amount: r.amount }],
    });
    postTx(d, ctx, "refund", r.id, `Devolución confirmada ${r.id}`, [debit("refunds_payable", r.amount), credit("bank", r.amount)]);
  }
  r.status = next;
  audit(d, ctx, `Devolución ${r.id}: ${next}`, `devolución ${r.id}`);
  return done(next === "confirmed" ? "Devolución confirmada con evidencia: ahora sí reduce el efectivo." : "Estado de la devolución actualizado.");
};

export const failRefund: Command<{ refundId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "refund.approve");
  if (no) return no;
  const r = d.refunds.find((x) => x.id === a.refundId);
  if (!r || r.status !== "sent") return fail("Solo una devolución enviada puede fallar.");
  r.status = "failed";
  audit(d, ctx, `El banco rechazó la devolución ${r.id}`, `devolución ${r.id}`);
  return done("El envío falló. La obligación de devolver sigue pendiente; no se marca como ejecutada.");
};

/* ---------------- Caja y conciliación ---------------- */

export const openCashSession: Command<{ branchId: BranchId; base: Cop }> = (d, ctx, a) => {
  const no = denied(ctx, "cash.close");
  if (no) return no;
  if (branchOpenSession(d, a.branchId)) return fail("Esa sede ya tiene una caja abierta.");
  d.cashSessions.push({ id: uid(d, "cs"), branchId: a.branchId, openedOn: ctx.today, openingBase: a.base, status: "open" });
  audit(d, ctx, `Abrió la caja de ${a.branchId} con base ${formatCop(a.base)}`, `caja ${a.branchId}`);
  return done("Caja abierta.");
};

export const closeCashSession: Command<{ sessionId: string; counted: Cop; withdrawal: Cop; nextBase: Cop }> = (d, ctx, a) => {
  const no = denied(ctx, "cash.close");
  if (no) return no;
  const s = d.cashSessions.find((x) => x.id === a.sessionId);
  if (!s || s.status !== "open") return fail("La caja no está abierta.");
  const expected = expectedCash(s, d.payments, d.expenses);
  const result = closeSession(expected, a.counted);
  s.status = "closed";
  s.expected = expected;
  s.counted = a.counted;
  s.difference = result.difference;
  s.withdrawal = a.withdrawal;
  s.nextBase = a.nextBase;
  s.closedBy = ctx.userId;
  audit(d, ctx, `Cerró caja ${s.branchId}: esperado ${formatCop(expected)}, contado ${formatCop(a.counted)} (${result.verdict})`, `caja ${s.id}`);
  const verdictText = result.verdict === "cuadrado" ? "La caja cuadra." : `Hay un ${result.verdict} de ${formatCop(Math.abs(result.difference))}; queda registrado en el cierre.`;
  return done(`Caja cerrada. ${verdictText}`);
};

export const matchBankLine: Command<{ lineId: string; paymentId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "reconcile");
  if (no) return no;
  const line = d.bankLines.find((l) => l.id === a.lineId);
  const p = d.payments.find((x) => x.id === a.paymentId);
  if (!line || !p) return fail("Movimiento o pago no encontrado.");
  if (p.status !== "confirmed") return fail("Solo se concilian pagos confirmados.");
  if (d.bankLines.some((l) => l.matchedPaymentId === p.id)) return fail("Ese pago ya fue conciliado con otro movimiento.");
  line.matchedPaymentId = p.id;
  const diff = line.gross - p.amount;
  audit(d, ctx, `Conectó el movimiento ${line.id} con el pago ${p.ref}`, `conciliación ${line.id}`);
  return done(diff === 0 ? "Conciliado: coincide el importe." : `Conciliado con diferencia de ${formatCop(diff)}; queda para revisar.`);
};
