import { buildSchedule, toInstallments, ENGINE_VERSION } from "@/domain/credit";
import { addDays, addMonths } from "@/domain/dates";
import { credit, debit } from "@/domain/ledger";
import { formatCop, type Cop } from "@/domain/money";
import { canReserve, deliveryBlockers, discountNeedsApproval, MODALITY_LABELS } from "@/domain/sales";
import { confirmedCost } from "@/domain/inventory";
import { can } from "@/domain/rbac";
import type { Buyer, Modality, PayMethod } from "@/domain/types";
import { audit, denied, done, fail, moduleGate, postTx, reverseSource, serial, uid, type Command } from "../engine";
import { activeReservation, confirmedIn, deliveryContext, listingOfUnit, unitById, unitLabel } from "../queries";

/* ---------------- Cotización ---------------- */

export const createQuote: Command<{ unitId: string; buyer: Buyer; discount: Cop }, string> = (d, ctx, a) => {
  const no = denied(ctx, "quote.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  if (!a.buyer.name.trim() || !a.buyer.doc.trim()) return fail("Escribe nombre y documento del comprador.");
  if (a.discount < 0 || a.discount >= unit.listPrice) return fail("El descuento debe ser mayor o igual a cero y menor que el precio.");
  const needs = discountNeedsApproval(unit.listPrice, a.discount);
  const id = uid(d, "q");
  d.quotes.push({
    id,
    number: serial(d, "quote", "COT"),
    unitId: unit.id,
    buyer: a.buyer,
    price: unit.listPrice,
    discount: a.discount,
    status: needs ? "pending_approval" : "issued",
    version: 1,
    validUntil: addDays(ctx.today, 7),
    advisorId: ctx.userId,
    createdOn: ctx.today,
  });
  audit(d, ctx, `Creó cotización de ${unitLabel(unit)} para ${a.buyer.name}${needs ? " (descuento requiere aprobación)" : ""}`, `cotización ${id}`);
  return done(needs ? "Cotización creada. El descuento supera el permitido y queda pendiente de aprobación." : "Cotización emitida.", id);
};

export const approveQuote: Command<{ quoteId: string; approve: boolean }> = (d, ctx, a) => {
  const no = denied(ctx, "quote.approve_discount");
  if (no) return no;
  const q = d.quotes.find((x) => x.id === a.quoteId);
  if (!q || q.status !== "pending_approval") return fail("La cotización no está pendiente de aprobación.");
  q.status = a.approve ? "issued" : "rejected";
  audit(d, ctx, `${a.approve ? "Aprobó" : "Rechazó"} el descuento de ${q.number}`, `cotización ${q.id}`);
  return done(a.approve ? "Descuento aprobado. La cotización quedó emitida." : "Descuento rechazado.");
};

export const acceptQuote: Command<{ quoteId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "quote.write");
  if (no) return no;
  const q = d.quotes.find((x) => x.id === a.quoteId);
  if (!q || q.status !== "issued") return fail("Solo se puede aceptar una cotización emitida.");
  q.status = "accepted";
  audit(d, ctx, `El comprador aceptó ${q.number} v${q.version}`, `cotización ${q.id}`);
  return done("Cotización aceptada por el comprador.");
};

/** Cambiar una condición ya aceptada crea una versión nueva que exige nueva aceptación (FR-FIN-03). */
export const reviseQuote: Command<{ quoteId: string; discount: Cop }> = (d, ctx, a) => {
  const no = denied(ctx, "quote.write");
  if (no) return no;
  const q = d.quotes.find((x) => x.id === a.quoteId);
  if (!q) return fail("Cotización no encontrada.");
  q.discount = a.discount;
  q.version += 1;
  q.status = discountNeedsApproval(q.price, a.discount) ? "pending_approval" : "issued";
  audit(d, ctx, `Revisó ${q.number}: nueva versión v${q.version}`, `cotización ${q.id}`);
  return done(`Nueva versión v${q.version}. El comprador debe aceptarla de nuevo.`);
};

/* ---------------- Reserva exclusiva ---------------- */

export interface ReserveArgs {
  unitId: string;
  quoteId?: string;
  buyer: Buyer;
  deposit: Cop;
  days: number;
}

export const reserveUnit: Command<ReserveArgs, string> = (d, ctx, a) => {
  const no = denied(ctx, "reservation.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  const check = canReserve(unit, d.reservations);
  if (!check.ok) return fail(check.reason);
  if (a.quoteId) {
    const q = d.quotes.find((x) => x.id === a.quoteId);
    if (!q || q.status !== "accepted") return fail("La cotización debe estar aceptada por el comprador para reservar.");
  }
  const id = uid(d, "r");
  d.reservations.push({ id, unitId: unit.id, quoteId: a.quoteId, buyer: a.buyer, advisorId: ctx.userId, expiresOn: addDays(ctx.today, a.days), deposit: a.deposit, status: "active" });
  unit.status = "reserved";
  const listing = listingOfUnit(d, unit.id);
  if (listing?.status === "published") listing.status = "paused";
  if (a.deposit > 0) {
    d.payments.push({
      id: uid(d, "pay"),
      direction: "in",
      amount: a.deposit,
      method: "cash",
      status: "pending",
      ref: `EFE-${id}`,
      counterparty: a.buyer.name,
      concept: `Anticipo de reserva ${unitLabel(unit)}`,
      targetType: "reservation",
      targetId: id,
      branchId: unit.branchId,
      on: ctx.today,
    });
  }
  audit(d, ctx, `Reservó ${unitLabel(unit)} para ${a.buyer.name} hasta ${addDays(ctx.today, a.days)}`, `reserva ${id}`);
  return done(a.deposit > 0 ? "Reserva creada. El anticipo queda pendiente hasta que Tesorería lo confirme." : "Reserva creada. Nadie más puede reservar esta unidad.", id);
};

export const cancelReservation: Command<{ reservationId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "reservation.write");
  if (no) return no;
  const r = d.reservations.find((x) => x.id === a.reservationId);
  if (!r || r.status !== "active") return fail("La reserva no está activa.");
  r.status = "cancelled";
  const unit = unitById(d, r.unitId);
  if (unit && unit.status === "reserved") unit.status = "available";
  const listing = listingOfUnit(d, r.unitId);
  if (listing?.status === "paused") listing.status = "published";
  const deposit = confirmedIn(d, "reservation", r.id);
  audit(d, ctx, `Canceló la reserva ${r.id}`, `reserva ${r.id}`);
  return done(deposit > 0 ? `Reserva cancelada. Se recibieron ${formatCop(deposit)} de anticipo: la devolución debe gestionarse en Tesorería, no se devuelve sola.` : "Reserva cancelada. La unidad quedó disponible.");
};

/* ---------------- Crédito: solicitud y decisión ---------------- */

export const requestCredit: Command<{ unitId: string; applicant: Buyer; monthlyIncome: Cop; amount: Cop; months: number; eaPercent: number }, string> = (d, ctx, a) => {
  const no = denied(ctx, "sale.write") ?? moduleGate(d, "own_credit");
  if (no) return no;
  if (a.amount <= 0 || a.months < 6 || a.months > 72) return fail("Revisa el monto y un plazo entre 6 y 72 meses.");
  const id = uid(d, "ca");
  d.applications.push({ id, unitId: a.unitId, applicant: a.applicant, monthlyIncome: a.monthlyIncome, amount: a.amount, months: a.months, eaPercent: a.eaPercent, status: "pending", createdOn: ctx.today });
  audit(d, ctx, `Solicitó crédito propio por ${formatCop(a.amount)} para ${a.applicant.name}`, `solicitud ${id}`);
  return done("Solicitud enviada a Cartera. No genera saldo hasta que se apruebe y formalice.", id);
};

export const decideCredit: Command<{ applicationId: string; approve: boolean; note: string }> = (d, ctx, a) => {
  const no = denied(ctx, "credit.approve");
  if (no) return no;
  const app = d.applications.find((x) => x.id === a.applicationId);
  if (!app || app.status !== "pending") return fail("La solicitud ya fue decidida.");
  app.status = a.approve ? "approved" : "rejected";
  app.decidedBy = ctx.userId;
  app.note = a.note;
  audit(d, ctx, `${a.approve ? "Aprobó" : "Rechazó"} el crédito de ${app.applicant.name}`, `solicitud ${app.id}`);
  return done(a.approve ? "Crédito aprobado. El asesor ya puede formalizar la venta." : "Crédito rechazado.");
};

/* ---------------- Venta ---------------- */

export interface FormalizeArgs {
  unitId: string;
  buyer: Buyer;
  modality: Modality;
  netPrice: Cop;
  downPayment: Cop;
  method: PayMethod;
  months?: number;
  eaPercent?: number;
  bank?: string;
  layawayDays?: number;
}

export const formalizeSale: Command<FormalizeArgs, string> = (d, ctx, a) => {
  const no = denied(ctx, "sale.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  const reservation = activeReservation(d, unit.id);
  if (unit.status === "sold" || unit.status === "delivered") return fail("La unidad ya fue vendida.");
  if (reservation && reservation.buyer.doc !== a.buyer.doc) return fail(`La unidad está reservada a ${reservation.buyer.name}. Solo ese comprador puede formalizar.`);
  if (!reservation && unit.status !== "available") return fail("La unidad no está disponible para vender.");
  if (a.netPrice <= 0) return fail("El precio de venta debe ser mayor que cero.");
  if (a.downPayment < 0 || (a.modality !== "cash" && a.downPayment >= a.netPrice)) return fail("La cuota inicial debe ser menor que el precio de venta.");

  const gate =
    a.modality === "own_credit" ? moduleGate(d, "own_credit") : a.modality === "layaway" ? moduleGate(d, "layaway") : a.modality === "external" ? moduleGate(d, "external_financing") : null;
  if (gate) return gate;

  const saleId = uid(d, "v");
  const principal = a.netPrice - a.downPayment;
  let loanId: string | undefined;
  let caseId: string | undefined;
  let layawayId: string | undefined;

  if (a.modality === "own_credit") {
    const approved = d.applications.find((x) => x.unitId === unit.id && x.applicant.doc === a.buyer.doc && x.status === "approved");
    if (!approved) return fail("Falta la aprobación de crédito de Cartera para este comprador y esta unidad.");
    const months = a.months ?? approved.months;
    const ea = a.eaPercent ?? approved.eaPercent;
    loanId = uid(d, "l");
    d.loans.push({
      id: loanId,
      saleId,
      borrower: a.buyer,
      principal,
      downPayment: a.downPayment,
      eaPercent: ea,
      months,
      engineVersion: ENGINE_VERSION,
      installments: toInstallments(buildSchedule({ principal, eaPercent: ea, months, firstDueOn: addMonths(ctx.today, 1) })),
      status: "active",
      collection: [],
    });
  }
  if (a.modality === "external") {
    caseId = uid(d, "x");
    d.externalCases.push({ id: caseId, saleId, entity: a.bank?.trim() || "Entidad financiera aliada", requested: principal, status: "requested" });
  }
  if (a.modality === "layaway") {
    layawayId = uid(d, "ly");
    d.layaways.push({ id: layawayId, saleId, unitId: unit.id, buyer: a.buyer, total: a.netPrice, paid: 0, deadlineOn: addDays(ctx.today, a.layawayDays ?? 60), status: "active" });
  }

  d.sales.push({
    id: saleId,
    number: serial(d, "sale", "V"),
    unitId: unit.id,
    buyer: a.buyer,
    modality: a.modality,
    netPrice: a.netPrice,
    downPayment: a.modality === "cash" ? 0 : a.downPayment,
    status: "formalized",
    invoice: "internal",
    loanId,
    caseId,
    layawayId,
    formalizedOn: ctx.today,
    advisorId: ctx.userId,
  });
  unit.status = "sold";
  const listing = listingOfUnit(d, unit.id);
  if (listing && listing.status !== "withdrawn") listing.status = "withdrawn";

  const cost = confirmedCost(d.costs, unit.id);
  postTx(d, ctx, "sale", saleId, `Venta ${unitLabel(unit)}`, [debit("receivable_customer", a.netPrice), credit("sales_revenue", a.netPrice)]);
  if (cost > 0) postTx(d, ctx, "sale", saleId, `Costo de ${unitLabel(unit)}`, [debit("cost_of_sales", cost), credit("inventory_vehicles", cost)]);

  if (reservation) {
    reservation.status = "converted";
    const deposit = confirmedIn(d, "reservation", reservation.id);
    if (deposit > 0) postTx(d, ctx, "sale", saleId, "Anticipo de reserva aplicado a la venta", [debit("customer_deposits", deposit), credit("receivable_customer", deposit)]);
  }
  const firstPayment = a.modality === "cash" ? a.netPrice : a.downPayment;
  if (firstPayment > 0) {
    d.payments.push({
      id: uid(d, "pay"),
      direction: "in",
      amount: firstPayment,
      method: a.method,
      status: "pending",
      ref: `${a.method === "cash" ? "EFE" : a.method === "transfer" ? "TRF" : "PAG"}-${saleId}`,
      counterparty: a.buyer.name,
      concept: a.modality === "cash" ? `Pago de contado ${unitLabel(unit)}` : `Cuota inicial ${unitLabel(unit)}`,
      targetType: "sale",
      targetId: saleId,
      branchId: unit.branchId,
      on: ctx.today,
    });
  }
  const number = d.sales[d.sales.length - 1].number;
  audit(d, ctx, `Formalizó ${number} (${MODALITY_LABELS[a.modality]}) de ${unitLabel(unit)} por ${formatCop(a.netPrice)}`, `venta ${saleId}`);
  return done(`Venta ${number} formalizada. Formalizada no es pagada ni entregada: falta confirmar el dinero.`, saleId);
};

export const recordDelivery: Command<{ saleId: string; receiver: string; exceptionReason?: string }> = (d, ctx, a) => {
  const no = denied(ctx, "delivery.write");
  if (no) return no;
  const sale = d.sales.find((s) => s.id === a.saleId);
  if (!sale) return fail("Venta no encontrada.");
  const blockers = deliveryBlockers(deliveryContext(d, sale));
  if (blockers.length && !a.exceptionReason?.trim()) return fail(`No se puede entregar: ${blockers.join("; ")}.`);
  if (blockers.length && !can(ctx.role, "sale.annul")) return fail("Entregar con condiciones pendientes es una excepción que solo puede autorizar un administrador.");
  if (!a.receiver.trim()) return fail("Escribe quién recibe el vehículo.");
  sale.status = "delivered";
  sale.deliveredOn = ctx.today;
  sale.delivery = { receiver: a.receiver.trim(), exceptionReason: blockers.length ? a.exceptionReason : undefined };
  const unit = unitById(d, sale.unitId);
  if (unit) unit.status = "delivered";
  audit(d, ctx, `Entregó ${sale.number}${blockers.length ? ` con excepción: ${a.exceptionReason}` : ""}`, `venta ${sale.id}`);
  return done("Entrega registrada con acta.");
};

/** Anulación: conserva el original, compensa y deja la devolución como obligación pendiente (FR-PAY-06). */
export const annulSale: Command<{ saleId: string; reason: string }> = (d, ctx, a) => {
  const no = denied(ctx, "sale.annul");
  if (no) return no;
  const sale = d.sales.find((s) => s.id === a.saleId);
  if (!sale || sale.status === "annulled") return fail("La venta no se puede anular.");
  if (sale.status === "delivered") return fail("No se puede anular una venta ya entregada desde el demo. Gestiona una devolución del vehículo.");
  if (!a.reason.trim()) return fail("Escribe el motivo de la anulación.");
  const unit = unitById(d, sale.unitId);
  reverseSource(d, ctx, "sale", sale.id, `Anulación ${sale.number}`);
  const received = d.payments
    .filter((p) => p.direction === "in" && p.status === "confirmed" && (p.targetId === sale.id || p.targetId === sale.layawayId || p.targetId === sale.loanId))
    .reduce((acc, p) => acc + p.amount, 0);
  if (received > 0) {
    postTx(d, ctx, "refund", sale.id, `Obligación de devolver lo recibido en ${sale.number}`, [debit("receivable_customer", received), credit("refunds_payable", received)]);
    d.refunds.push({ id: uid(d, "rf"), saleId: sale.id, layawayId: sale.layawayId, buyer: sale.buyer.name, amount: received, reason: `Anulación ${sale.number}: ${a.reason}`, status: "requested", requestedBy: ctx.userId, on: ctx.today });
  }
  sale.status = "annulled";
  sale.annulReason = a.reason;
  if (unit) unit.status = "available";
  const loan = sale.loanId ? d.loans.find((l) => l.id === sale.loanId) : undefined;
  if (loan) loan.status = "cancelled";
  const layaway = sale.layawayId ? d.layaways.find((l) => l.id === sale.layawayId) : undefined;
  if (layaway) layaway.status = "cancelled";
  d.payments.filter((p) => p.status === "pending" && p.targetId === sale.id).forEach((p) => (p.status = "failed"));
  audit(d, ctx, `Anuló ${sale.number}: ${a.reason}`, `venta ${sale.id}`);
  return done(received > 0 ? `Venta anulada. Quedó una devolución pendiente de ${formatCop(received)}: anular no devuelve el dinero.` : "Venta anulada.");
};

/** El banco responde: aprobar no es desembolsar, el dinero se registra aparte (FR-CRE-08). */
export const decideExternal: Command<{ caseId: string; approve: boolean; ref: string }> = (d, ctx, a) => {
  // Lo registra quien lleva la relación con el banco: cartera o el asesor de la venta.
  if (!can(ctx.role, "credit.approve") && !can(ctx.role, "sale.write")) return denied(ctx, "credit.approve")!;
  const c = d.externalCases.find((x) => x.id === a.caseId);
  if (!c || c.status !== "requested") return fail("El expediente no está pendiente de respuesta del banco.");
  if (a.approve && !a.ref.trim()) return fail("Escribe el código de aprobación del banco como evidencia.");
  c.status = a.approve ? "approved" : "rejected";
  if (a.approve) {
    c.approvedAmount = c.requested;
    c.approvalRef = a.ref.trim();
  }
  audit(d, ctx, `${a.approve ? "Registró la aprobación" : "Registró el rechazo"} de ${c.entity}`, `financiación ${c.id}`);
  return done(a.approve ? "Aprobación registrada. El saldo comercial sigue pendiente hasta que el banco desembolse." : "Rechazo registrado. Cambia la modalidad de pago de la venta o anúlala.");
};
