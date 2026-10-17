/** Importes en pesos colombianos como enteros. El backend real usará `numeric` (ver ADR-007). */
export type Cop = number;

const copFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export function formatCop(amount: Cop): string {
  return copFmt.format(amount);
}

/** Formato corto para tarjetas de KPI: "$ 142,5 M" o "$ 850 mil". */
export function formatCopCompact(amount: Cop): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$ ${decimalFmt.format(abs / 1_000_000)} M`;
  if (abs >= 1_000) return `${sign}$ ${decimalFmt.format(abs / 1_000)} mil`;
  return `${sign}$ ${abs}`;
}

export function roundCop(value: number): Cop {
  return Math.round(value);
}

export function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
