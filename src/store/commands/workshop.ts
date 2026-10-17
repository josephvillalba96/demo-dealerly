import { addDays } from "@/domain/dates";
import { credit, debit } from "@/domain/ledger";
import { formatCop, roundCop, sum, type Cop } from "@/domain/money";
import { issueStock, InsufficientStockError, nextWorkStatus, receiveStock, WORK_LABELS } from "@/domain/workshop";
import type { BranchId, DemoData, PayMethod, StockLevel } from "@/domain/types";
import { audit, branchOpenSession, denied, done, fail, moduleGate, moneyAccount, postTx, reverseSource, serial, uid, type Command } from "../engine";
import { listingOfUnit, partById, stockOf, unitById, unitLabel } from "../queries";

function levelFor(d: DemoData, partId: string, branchId: BranchId): StockLevel {
  let level = stockOf(d, partId, branchId);
  if (!level) {
    level = { partId, branchId, onHand: 0, avgCost: 0 };
    d.stock.push(level);
  }
  return level;
}

/* ---------------- Órdenes de reacondicionamiento ---------------- */

export interface OpenOrderArgs {
  unitId: string;
  branchId: BranchId;
  bay: string;
  technicianId: string;
  description: string;
  budget: Cop;
}

export const openWorkOrder: Command<OpenOrderArgs, string> = (d, ctx, a) => {
  const no = denied(ctx, "workshop.write") ?? moduleGate(d, "workshop");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  if (unit.ownership !== "owned" || unit.status === "sold" || unit.status === "delivered") return fail("Solo se reacondicionan unidades propias que sigan en inventario.");
  if (d.workOrders.some((w) => w.unitId === unit.id && w.status !== "done" && w.status !== "cancelled")) return fail("Esa unidad ya tiene una orden abierta.");
  if (!a.description.trim()) return fail("Describe el trabajo solicitado.");
  const id = uid(d, "wo");
  d.workOrders.push({ id, number: serial(d, "workorder", "OT"), unitId: unit.id, branchId: a.branchId, bay: a.bay, technicianId: a.technicianId, status: "received", budget: a.budget, description: a.description.trim(), lines: [], createdOn: ctx.today });
  if (unit.status === "available") unit.status = "in_preparation";
  const listing = listingOfUnit(d, unit.id);
  if (listing?.status === "published") listing.status = "paused";
  audit(d, ctx, `Abrió orden de reacondicionamiento de ${unitLabel(unit)}`, `orden ${id}`);
  return done("Orden creada. El anuncio queda pausado mientras la unidad está en taller.", id);
};

export const advanceWorkOrder: Command<{ orderId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "workshop.write");
  if (no) return no;
  const wo = d.workOrders.find((w) => w.id === a.orderId);
  if (!wo) return fail("Orden no encontrada.");
  const next = nextWorkStatus(wo.status);
  if (!next) return fail("La orden no puede avanzar más.");
  if (next === "done" && wo.lines.some((l) => l.status === "pending")) return fail("Hay líneas pendientes de consumir. Confírmalas o quítalas antes de terminar la orden.");
  wo.status = next;
  if (next === "done") {
    const unit = unitById(d, wo.unitId);
    if (unit && unit.status === "in_preparation") unit.status = "available";
    const listing = listingOfUnit(d, wo.unitId);
    if (listing?.status === "paused") listing.status = "published";
  }
  audit(d, ctx, `Orden ${wo.number}: ${WORK_LABELS[next]}`, `orden ${wo.id}`);
  return done(next === "done" ? "Orden terminada. La unidad vuelve a estar disponible para publicar." : `Orden en ${WORK_LABELS[next].toLowerCase()}.`);
};

export const cancelWorkOrder: Command<{ orderId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "workshop.write");
  if (no) return no;
  const wo = d.workOrders.find((w) => w.id === a.orderId);
  if (!wo || wo.status === "done" || wo.status === "cancelled") return fail("La orden no se puede cancelar.");
  if (wo.lines.some((l) => l.status === "confirmed")) return fail("Hay consumos confirmados: reviértelos antes de cancelar la orden.");
  wo.status = "cancelled";
  audit(d, ctx, `Canceló la orden ${wo.number}`, `orden ${wo.id}`);
  return done("Orden cancelada.");
};

export const addWorkLine: Command<{ orderId: string; kind: "labor" | "part"; description: string; partId?: string; qty: number; unitCost?: Cop }> = (d, ctx, a) => {
  const no = denied(ctx, "workshop.write");
  if (no) return no;
  const wo = d.workOrders.find((w) => w.id === a.orderId);
  if (!wo || wo.status === "done" || wo.status === "cancelled") return fail("La orden no admite más líneas.");
  if (a.qty <= 0) return fail("La cantidad debe ser mayor que cero.");
  if (a.kind === "part") {
    const part = a.partId ? partById(d, a.partId) : undefined;
    if (!part) return fail("Elige un repuesto del catálogo.");
    const level = stockOf(d, part.id, wo.branchId);
    d.workOrders.find((w) => w.id === wo.id)!.lines.push({ id: uid(d, "wl"), kind: "part", description: part.description, partId: part.id, qty: a.qty, unitCost: level?.avgCost ?? 0, status: "pending" });
  } else {
    if (!a.description.trim() || !a.unitCost || a.unitCost <= 0) return fail("Escribe la descripción y la tarifa por hora.");
    wo.lines.push({ id: uid(d, "wl"), kind: "labor", description: a.description.trim(), qty: a.qty, unitCost: a.unitCost, status: "pending" });
  }
  return done("Línea agregada como pendiente.");
};

/**
 * Consumir una línea es un solo hecho económico: kardex, costo de la unidad y asiento se confirman juntos
 * o no se confirma nada (FR-WSH-03).
 */
export const consumeLine: Command<{ orderId: string; lineId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "workshop.write");
  if (no) return no;
  const wo = d.workOrders.find((w) => w.id === a.orderId);
  const line = wo?.lines.find((l) => l.id === a.lineId);
  if (!wo || !line || line.status !== "pending") return fail("La línea no está pendiente.");
  if (wo.status === "received" || wo.status === "diagnosis") return fail("La orden debe estar aprobada antes de consumir repuestos o mano de obra.");
  const unit = unitById(d, wo.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  let amount: Cop;
  if (line.kind === "part" && line.partId) {
    const level = levelFor(d, line.partId, wo.branchId);
    try {
      const issued = issueStock(level, line.qty);
      level.onHand = issued.level.onHand;
      line.unitCost = issued.unitCost;
    } catch (e) {
      if (e instanceof InsufficientStockError) return fail(`Existencia insuficiente de ${line.description}: hay ${e.available} y se piden ${e.requested}. Nada se confirmó.`);
      throw e;
    }
    amount = roundCop(line.qty * line.unitCost);
    d.movements.push({ id: uid(d, "mv"), partId: line.partId, branchId: wo.branchId, type: "work_order_out", qty: -line.qty, unitCost: line.unitCost, sourceId: line.id, on: ctx.today });
    postTx(d, ctx, "work_line", line.id, `Consumo ${line.description} en ${wo.number}`, [debit("inventory_vehicles", amount), credit("inventory_parts", amount)]);
  } else {
    amount = roundCop(line.qty * line.unitCost);
    postTx(d, ctx, "work_line", line.id, `Mano de obra en ${wo.number}`, [debit("inventory_vehicles", amount), credit("labor_absorbed", amount)]);
  }
  line.status = "confirmed";
  d.costs.push({ id: uid(d, "c"), unitId: wo.unitId, concept: `${wo.number}: ${line.description}`, source: "work_order", amount, status: "confirmed", date: ctx.today, sourceId: line.id });
  audit(d, ctx, `Consumió ${line.description} (${formatCop(amount)}) en ${wo.number}`, `orden ${wo.id}`);
  return done(`Consumo confirmado: ${formatCop(amount)} sumados al costo de ${unitLabel(unit)}.`);
};

export const reverseLine: Command<{ orderId: string; lineId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "workshop.write");
  if (no) return no;
  const wo = d.workOrders.find((w) => w.id === a.orderId);
  const line = wo?.lines.find((l) => l.id === a.lineId);
  if (!wo || !line || line.status !== "confirmed") return fail("Solo se revierten consumos confirmados.");
  const amount = roundCop(line.qty * line.unitCost);
  if (line.kind === "part" && line.partId) {
    const level = levelFor(d, line.partId, wo.branchId);
    const next = receiveStock(level, line.qty, line.unitCost);
    level.onHand = next.onHand;
    level.avgCost = next.avgCost;
    d.movements.push({ id: uid(d, "mv"), partId: line.partId, branchId: wo.branchId, type: "reversal", qty: line.qty, unitCost: line.unitCost, sourceId: line.id, on: ctx.today });
  }
  reverseSource(d, ctx, "work_line", line.id, `Reverso de consumo ${line.description}`);
  d.costs.push({ id: uid(d, "c"), unitId: wo.unitId, concept: `Reverso ${wo.number}: ${line.description}`, source: "work_order", amount: -amount, status: "confirmed", date: ctx.today, sourceId: line.id });
  line.status = "reversed";
  audit(d, ctx, `Revirtió el consumo ${line.description} (${formatCop(amount)})`, `orden ${wo.id}`);
  return done("Consumo revertido con movimiento compensatorio. El original se conserva.");
};

/* ---------------- Repuestos ---------------- */

export const createPart: Command<{ ref: string; oem: string; description: string; compat: string; kind: "car" | "motorcycle" | "both"; salePrice: Cop }, string> = (d, ctx, a) => {
  const no = denied(ctx, "parts.write") ?? moduleGate(d, "parts_counter");
  if (no) return no;
  const ref = a.ref.trim().toUpperCase();
  if (!ref || !a.description.trim()) return fail("Escribe la referencia y la descripción.");
  if (d.parts.some((p) => p.ref === ref)) return fail(`La referencia ${ref} ya existe en el catálogo.`);
  const id = uid(d, "p");
  d.parts.push({ id, ref, oem: a.oem.trim(), description: a.description.trim(), compat: a.compat.trim(), kind: a.kind, salePrice: a.salePrice });
  audit(d, ctx, `Creó el repuesto ${ref}`, `repuesto ${id}`);
  return done("Repuesto creado en el catálogo.", id);
};

export const receivePurchase: Command<{ supplier: string; number: string; branchId: BranchId; terms: "cash" | "credit"; lines: { partId: string; qty: number; unitCost: Cop }[] }> = (d, ctx, a) => {
  const no = denied(ctx, "parts.write") ?? moduleGate(d, "parts_counter");
  if (no) return no;
  if (!a.supplier.trim() || !a.number.trim()) return fail("Escribe proveedor y número de factura.");
  if (a.lines.length === 0 || a.lines.some((l) => l.qty <= 0 || l.unitCost <= 0)) return fail("Cada línea necesita cantidad y costo mayores que cero.");
  if (d.purchases.some((p) => p.supplier.toLowerCase() === a.supplier.trim().toLowerCase() && p.number === a.number.trim())) return fail("Esa factura del proveedor ya fue registrada.");
  const id = uid(d, "pi");
  const total = sum(a.lines.map((l) => l.qty * l.unitCost));
  for (const l of a.lines) {
    const level = levelFor(d, l.partId, a.branchId);
    const next = receiveStock(level, l.qty, l.unitCost);
    level.onHand = next.onHand;
    level.avgCost = next.avgCost;
    d.movements.push({ id: uid(d, "mv"), partId: l.partId, branchId: a.branchId, type: "purchase_in", qty: l.qty, unitCost: l.unitCost, sourceId: id, on: ctx.today });
  }
  let obligationId: string | undefined;
  if (a.terms === "credit") {
    obligationId = uid(d, "o");
    d.obligations.push({ id: obligationId, supplier: a.supplier.trim(), docRef: a.number.trim(), concept: "Compra de repuestos", amount: total, outstanding: total, dueOn: addDays(ctx.today, 30), origin: "parts" });
    postTx(d, ctx, "purchase", id, `Compra ${a.number}`, [debit("inventory_parts", total), credit("payable_supplier", total)]);
  } else {
    postTx(d, ctx, "purchase", id, `Compra de contado ${a.number}`, [debit("inventory_parts", total), credit("bank", total)]);
  }
  d.purchases.push({ id, supplier: a.supplier.trim(), number: a.number.trim(), branchId: a.branchId, on: ctx.today, terms: a.terms, lines: a.lines, obligationId });
  audit(d, ctx, `Registró compra ${a.number} por ${formatCop(total)} (${a.terms === "credit" ? "a crédito" : "de contado"})`, `compra ${id}`);
  return done(a.terms === "credit" ? "Compra registrada: entró al kardex y quedó una cuenta por pagar. Marcarla como pagada exige un pago real." : "Compra de contado registrada.");
};

export const counterSale: Command<{ customer: string; branchId: BranchId; method: PayMethod; lines: { partId: string; qty: number }[]; confirmNow?: boolean }, string> = (d, ctx, a) => {
  const no = denied(ctx, "parts.write") ?? moduleGate(d, "parts_counter");
  if (no) return no;
  if (a.lines.length === 0) return fail("Agrega al menos un repuesto.");
  const lines: { partId: string; qty: number; unitPrice: Cop; unitCost: Cop }[] = [];
  for (const l of a.lines) {
    const part = partById(d, l.partId);
    if (!part) return fail("Repuesto no encontrado.");
    const level = stockOf(d, l.partId, a.branchId);
    if (!level) return fail(`No hay existencias de ${part.description} en esta sede.`);
    try {
      issueStock(level, l.qty);
    } catch (e) {
      if (e instanceof InsufficientStockError) return fail(`Existencia insuficiente de ${part.description}: hay ${e.available} y se piden ${e.requested}.`);
      throw e;
    }
    lines.push({ partId: l.partId, qty: l.qty, unitPrice: part.salePrice, unitCost: level.avgCost });
  }
  const total = sum(lines.map((l) => l.qty * l.unitPrice));
  const costTotal = sum(lines.map((l) => l.qty * l.unitCost));
  const id = uid(d, "cs");
  for (const l of lines) {
    const level = levelFor(d, l.partId, a.branchId);
    level.onHand -= l.qty;
    d.movements.push({ id: uid(d, "mv"), partId: l.partId, branchId: a.branchId, type: "counter_sale_out", qty: -l.qty, unitCost: l.unitCost, sourceId: id, on: ctx.today });
  }
  postTx(d, ctx, "counter_sale", id, "Costo de venta de mostrador", [debit("cost_of_sales", costTotal), credit("inventory_parts", costTotal)]);
  const paymentId = uid(d, "pay");
  const sessionOk = a.method !== "cash" || branchOpenSession(d, a.branchId);
  if (!sessionOk) return fail("Abre la caja de la sede antes de cobrar en efectivo.");
  d.payments.push({
    id: paymentId,
    direction: "in",
    amount: total,
    method: a.method,
    status: "pending",
    ref: `${a.method === "cash" ? "EFE" : a.method.toUpperCase()}-${serial(d, "payref", "R")}`,
    counterparty: a.customer.trim() || "Consumidor final",
    concept: "Venta de mostrador",
    targetType: "counter_sale",
    targetId: id,
    branchId: a.branchId,
    on: ctx.today,
  });
  d.counterSales.push({ id, number: serial(d, "counter", "MO"), customer: a.customer.trim() || "Consumidor final", branchId: a.branchId, on: ctx.today, lines, paymentId, status: "confirmed" });
  audit(d, ctx, `Venta de mostrador por ${formatCop(total)}`, `mostrador ${id}`);
  if (a.confirmNow && ctx.role === "admin") {
    // El administrador puede cobrar y confirmar en un paso; los demás roles dejan el pago pendiente para Tesorería.
    const p = d.payments.find((x) => x.id === paymentId)!;
    const session = branchOpenSession(d, a.branchId);
    if (a.method === "cash" && session) p.sessionId = session.id;
    p.status = "confirmed";
    d.processedRefs.push(p.ref);
    p.allocations = [{ label: "Venta de mostrador", amount: total }];
    postTx(d, ctx, "payment", p.id, `Mostrador ${p.ref}`, [debit(moneyAccount(a.method), total), credit("parts_revenue", total)]);
    return done(`Venta de mostrador cobrada: ${formatCop(total)}.`, id);
  }
  return done(`Venta de mostrador por ${formatCop(total)}. El cobro queda pendiente hasta que Tesorería lo confirme.`, id);
};

export const adjustStock: Command<{ partId: string; branchId: BranchId; counted: number; loss: boolean; reason: string }> = (d, ctx, a) => {
  const no = denied(ctx, "parts.write") ?? moduleGate(d, "parts_counter");
  if (no) return no;
  if (!a.reason.trim()) return fail("Escribe el motivo del ajuste.");
  const level = levelFor(d, a.partId, a.branchId);
  const diff = a.counted - level.onHand;
  if (diff === 0) return fail("El conteo coincide con el sistema: no hay nada que ajustar.");
  if (a.counted < 0) return fail("El conteo no puede ser negativo.");
  const value = roundCop(Math.abs(diff) * level.avgCost);
  level.onHand = a.counted;
  const id = uid(d, "mv");
  d.movements.push({ id, partId: a.partId, branchId: a.branchId, type: a.loss && diff < 0 ? "loss" : "adjustment", qty: diff, unitCost: level.avgCost, sourceId: a.reason, on: ctx.today });
  if (value > 0) {
    postTx(d, ctx, "adjustment", id, a.reason, diff < 0 ? [debit("inventory_loss", value), credit("inventory_parts", value)] : [debit("inventory_parts", value), credit("inventory_loss", value)]);
  }
  audit(d, ctx, `Ajustó ${diff > 0 ? "+" : ""}${diff} unidades: ${a.reason}`, `repuesto ${a.partId}`);
  return done(`Ajuste registrado (${diff > 0 ? "+" : ""}${diff}). El conteo físico quedó explicado por un movimiento.`);
};
