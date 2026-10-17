import { describe, expect, it } from "vitest";
import {
  agingBuckets,
  allocatePayment,
  buildSchedule,
  monthlyRateFromEA,
  outstandingPrincipal,
  payoffQuote,
  toInstallments,
  totalDue,
} from "@/domain/credit";
import { addMonths, daysBetween } from "@/domain/dates";

const input = { principal: 40_000_000, eaPercent: 24, months: 36, firstDueOn: "2026-11-15" };

describe("tasa", () => {
  it("convierte E.A. a mensual equivalente (no divide entre 12)", () => {
    const r = monthlyRateFromEA(24);
    expect(r).toBeCloseTo(0.018087, 5);
    expect(r).toBeLessThan(0.24 / 12);
    expect(Math.pow(1 + r, 12)).toBeCloseTo(1.24, 10);
  });

  it("tasa cero reparte el capital en partes iguales", () => {
    const rows = buildSchedule({ principal: 1_200_000, eaPercent: 0, months: 12, firstDueOn: "2026-11-01" });
    expect(rows.every((row) => row.interest === 0)).toBe(true);
    expect(rows[0].principal).toBe(100_000);
  });
});

describe("cronograma", () => {
  it("caso SRS: capital neto 40.000.000, Σ capital = capital y saldo final 0", () => {
    const rows = buildSchedule(input);
    expect(rows).toHaveLength(36);
    expect(rows.reduce((acc, r) => acc + r.principal, 0)).toBe(40_000_000);
    expect(rows[rows.length - 1].balanceAfter).toBe(0);
  });

  it("el interés se calcula sobre el saldo, nunca sobre la inicial", () => {
    const rows = buildSchedule(input);
    expect(rows[0].interest).toBe(Math.round(40_000_000 * monthlyRateFromEA(24)));
  });

  it("propiedad: para varias combinaciones Σ capital = capital y saldo final 0", () => {
    for (const principal of [5_000_001, 12_345_678, 87_654_321]) {
      for (const months of [6, 12, 24, 48, 60]) {
        for (const ea of [0, 9.5, 24, 31.2]) {
          const rows = buildSchedule({ principal, eaPercent: ea, months, firstDueOn: "2026-01-31" });
          expect(rows.reduce((a, r) => a + r.principal, 0)).toBe(principal);
          expect(rows[rows.length - 1].balanceAfter).toBe(0);
        }
      }
    }
  });

  it("respeta el fin de mes", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
  });
});

describe("aplicación de pagos", () => {
  const base = toInstallments(buildSchedule(input));

  it("un pago parcial paga primero interés y luego capital, y conserva el importe", () => {
    const r = allocatePayment(base, 1_000_000, "2026-11-15");
    const total = r.allocations.reduce((a, x) => a + x.toInterest + x.toPrincipal, 0) + r.surplus;
    expect(total).toBe(1_000_000);
    expect(r.allocations[0].toInterest).toBe(base[0].interest);
    expect(r.allocations[0].toPrincipal).toBe(1_000_000 - base[0].interest);
  });

  it("un pago menor que el interés vigente se aplica solo a interés", () => {
    const r = allocatePayment(base, 500_000, "2026-11-15");
    expect(r.allocations[0]).toEqual({ number: 1, toInterest: 500_000, toPrincipal: 0 });
    expect(r.installments[0].paidOn).toBeUndefined();
  });

  it("pagar exactamente una cuota la cierra", () => {
    const r = allocatePayment(base, base[0].total, "2026-11-15");
    expect(r.installments[0].paidOn).toBe("2026-11-15");
    expect(r.surplus).toBe(0);
  });

  it("el excedente se identifica y no se pierde", () => {
    const tiny = toInstallments(buildSchedule({ principal: 1_000_000, eaPercent: 12, months: 2, firstDueOn: "2026-11-01" }));
    const r = allocatePayment(tiny, totalDue(tiny) + 777, "2026-11-01");
    expect(r.surplus).toBe(777);
    expect(totalDue(r.installments)).toBe(0);
  });

  it("no muta los datos de entrada", () => {
    const snapshot = JSON.stringify(base);
    allocatePayment(base, 900_000, "2026-11-15");
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it("rechaza pagos no positivos", () => {
    expect(() => allocatePayment(base, 0, "2026-11-15")).toThrow();
  });
});

describe("liquidación anticipada", () => {
  const base = toInstallments(buildSchedule(input));

  it("no cobra intereses futuros", () => {
    const quote = payoffQuote(base, "2026-12-01");
    const allFutureInterest = base.reduce((a, i) => a + i.interest, 0);
    expect(quote.total).toBeLessThan(40_000_000 + allFutureInterest);
    expect(quote.principal).toBe(40_000_000);
    expect(quote.total).toBe(quote.principal + quote.overdueInterest + quote.accruedInterest);
    expect(quote.futureInterestWaived).toBeGreaterThan(0);
  });

  it("pagar el importe vigente cierra la obligación de capital", () => {
    const quote = payoffQuote(base, "2026-12-01");
    expect(quote.principal).toBe(outstandingPrincipal(base));
  });
});

describe("mora por franjas", () => {
  it("clasifica por días de atraso a una fecha de corte y se puede reconstruir un corte anterior", () => {
    const inst = toInstallments(buildSchedule({ ...input, months: 6, firstDueOn: "2026-05-15" }));
    const cut = "2026-10-16";
    const a = agingBuckets(inst, cut);
    expect(a.total).toBe(totalDue(inst));
    expect(daysBetween("2026-05-15", cut)).toBeGreaterThan(90);
    expect(a.d90plus).toBeGreaterThan(0);
    const earlier = agingBuckets(inst, "2026-06-20");
    expect(earlier.d1_30).toBeGreaterThan(0);
    expect(earlier.d90plus).toBe(0);
    expect(agingBuckets(inst, cut)).toEqual(a);
  });
});
