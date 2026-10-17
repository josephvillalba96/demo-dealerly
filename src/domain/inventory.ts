import { sum, type Cop } from "./money";
import type { DocType, PhotoSlot, Sale, Unit, UnitCost, UnitStatus, VehicleKind } from "./types";

export const KIND_LABELS: Record<VehicleKind, string> = { car: "Carro", motorcycle: "Moto" };

export const STATUS_LABELS: Record<UnitStatus, string> = {
  in_preparation: "En alistamiento",
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
  delivered: "Entregado",
  withdrawn: "Retirado",
};

export const DOC_LABELS: Record<DocType, string> = {
  soat: "SOAT",
  rtm: "Revisión técnico-mecánica",
  property_card: "Tarjeta de propiedad",
};

const CAR_SLOTS: [string, string][] = [
  ["front34", "3/4 delantero derecho"],
  ["rear34", "3/4 trasero izquierdo"],
  ["left", "Lateral izquierdo"],
  ["right", "Lateral derecho"],
  ["wheels", "Rines y llantas"],
  ["plates", "Placas"],
  ["dash", "Tablero encendido"],
  ["seats_front", "Silletería delantera"],
  ["seats_rear", "Silletería trasera"],
  ["console", "Consola y volante"],
  ["trunk", "Maletero vacío"],
  ["engine", "Vano motor"],
];

const MOTO_SLOTS: [string, string][] = [
  ["left", "Lateral izquierdo"],
  ["right", "Lateral derecho"],
  ["front", "Frontal"],
  ["rear_plate", "Trasera con placa"],
  ["dash", "Tablero encendido"],
  ["engine_l", "Motor lado izquierdo"],
  ["engine_r", "Motor lado derecho"],
  ["tires", "Llantas delantera y trasera"],
  ["seat", "Sillín"],
  ["chassis", "Número de chasis o motor"],
];

/** Plantilla fotográfica según el tipo de vehículo (FR-VEH-09). */
export function photoTemplate(kind: VehicleKind, done = false): PhotoSlot[] {
  return (kind === "car" ? CAR_SLOTS : MOTO_SLOTS).map(([code, label]) => ({ code, label, done }));
}

export function confirmedCost(costs: readonly UnitCost[], unitId: string): Cop {
  return sum(costs.filter((c) => c.unitId === unitId && c.status === "confirmed").map((c) => c.amount));
}

export function pendingCost(costs: readonly UnitCost[], unitId: string): Cop {
  return sum(costs.filter((c) => c.unitId === unitId && c.status === "pending").map((c) => c.amount));
}

/** Margen estimado: precio de lista menos costo confirmado. */
export function estimatedMargin(unit: Unit, costs: readonly UnitCost[]): Cop {
  return unit.listPrice - confirmedCost(costs, unit.id);
}

/** Margen realizado: precio neto de la venta menos costo confirmado. */
export function realizedMargin(sale: Sale, costs: readonly UnitCost[]): Cop {
  return sale.netPrice - confirmedCost(costs, sale.unitId);
}

export function photoProgress(unit: Unit): { done: number; total: number } {
  return { done: unit.photos.filter((p) => p.done).length, total: unit.photos.length };
}
