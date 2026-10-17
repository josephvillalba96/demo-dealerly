import { roundCop, sum, type Cop } from "./money";
import type { StockLevel, WorkOrder, WorkStatus } from "./types";

export const WORK_LABELS: Record<WorkStatus, string> = {
  received: "Recibida",
  diagnosis: "Diagnóstico",
  approved: "Aprobada",
  in_progress: "En trabajo",
  quality: "Control de calidad",
  done: "Terminada",
  cancelled: "Cancelada",
};

export const WORK_FLOW: WorkStatus[] = ["received", "diagnosis", "approved", "in_progress", "quality", "done"];

export function nextWorkStatus(status: WorkStatus): WorkStatus | null {
  const i = WORK_FLOW.indexOf(status);
  return i >= 0 && i < WORK_FLOW.length - 1 ? WORK_FLOW[i + 1] : null;
}

/** Costo promedio ponderado móvil (FR-PRT-04): corrige el uso del "último costo" del prototipo. */
export function receiveStock(level: StockLevel, qty: number, unitCost: Cop): StockLevel {
  if (qty <= 0) throw new Error("La cantidad de entrada debe ser mayor que cero");
  const total = level.onHand + qty;
  const avgCost = roundCop((level.onHand * level.avgCost + qty * unitCost) / total);
  return { ...level, onHand: total, avgCost };
}

export class InsufficientStockError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(`Existencia insuficiente: hay ${available} y se piden ${requested}`);
    this.name = "InsufficientStockError";
  }
}

/** Salida de kardex al costo promedio vigente. Nunca deja existencia negativa (FR-PRT-02). */
export function issueStock(level: StockLevel, qty: number): { level: StockLevel; unitCost: Cop } {
  if (qty <= 0) throw new Error("La cantidad de salida debe ser mayor que cero");
  if (qty > level.onHand) throw new InsufficientStockError(level.onHand, qty);
  return { level: { ...level, onHand: level.onHand - qty }, unitCost: level.avgCost };
}

/** Costo confirmado de una orden: repuestos y mano de obra que ya se trasladaron a la unidad. */
export function orderCost(order: WorkOrder): Cop {
  return sum(order.lines.filter((l) => l.status === "confirmed").map((l) => l.qty * l.unitCost));
}

export function pendingOrderCost(order: WorkOrder): Cop {
  return sum(order.lines.filter((l) => l.status === "pending").map((l) => l.qty * l.unitCost));
}
