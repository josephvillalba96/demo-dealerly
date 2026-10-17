import type { Role, Unit } from "@/domain/types";

const km = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export const formatKm = (value: number): string => `${km.format(value)} km`;

export const unitName = (u: Pick<Unit, "make" | "model" | "trim" | "year">): string => `${u.make} ${u.model} ${u.trim} ${u.year}`;

/** El costo y el margen son privados: solo los ven quienes administran o manejan el dinero. */
export const canSeeCosts = (role: Role): boolean => role === "admin" || role === "tesoreria";

export function formatDateTime(slot: string): string {
  const [date, time] = slot.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const label = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(dt).replace(/\./g, "");
  return `${label}, ${time}`;
}
