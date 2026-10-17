import { describe, expect, it } from "vitest";
import { checkLimit, checkModule, modulesOf, overLimit, PLANS } from "@/domain/entitlements";
import { confirmedCost, estimatedMargin, photoTemplate, realizedMargin } from "@/domain/inventory";
import { nextListingStatus, publishBlockers } from "@/domain/listing";
import { can, canSee } from "@/domain/rbac";
import { canReserve, deliveryBlockers, discountNeedsApproval } from "@/domain/sales";
import { closeSession, expectedCash, isDuplicateRef, reconcile } from "@/domain/treasury";
import { InsufficientStockError, issueStock, receiveStock } from "@/domain/workshop";
import type { CashSession, Payment, Reservation, Sale, StockLevel, Subscription, Unit, UnitCost } from "@/domain/types";

const unit = (over: Partial<Unit> = {}): Unit => ({
  id: "u1",
  kind: "car",
  make: "Mazda",
  model: "3",
  trim: "Touring",
  year: 2021,
  km: 40_000,
  vin: "VIN1",
  plate: "ABC123",
  color: "Gris",
  city: "Barranquilla",
  branchId: "norte",
  status: "available",
  listPrice: 38_000_000,
  ownership: "owned",
  acquiredOn: "2026-09-01",
  condition: "Rayón declarado en puerta derecha.",
  photos: photoTemplate("car", true),
  docs: [
    { type: "soat", status: "reviewed" },
    { type: "rtm", status: "reviewed" },
    { type: "property_card", status: "reviewed" },
  ],
  sellerVerified: true,
  ...over,
});

describe("reserva exclusiva", () => {
  const reservation: Reservation = { id: "r1", unitId: "u1", buyer: { name: "Laura", doc: "1" }, advisorId: "m1", expiresOn: "2026-10-20", deposit: 0, status: "active" };

  it("permite reservar una unidad disponible sin reserva activa", () => {
    expect(canReserve(unit(), [])).toEqual({ ok: true });
  });

  it("bloquea la segunda reserva e identifica a quién ganó", () => {
    const r = canReserve(unit(), [reservation]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("Laura");
  });

  it("una reserva vencida libera la unidad", () => {
    expect(canReserve(unit(), [{ ...reservation, status: "expired" }]).ok).toBe(true);
  });

  it("no reserva unidades vendidas", () => {
    expect(canReserve(unit({ status: "sold" }), []).ok).toBe(false);
  });
});

describe("descuentos", () => {
  it("hasta 3 % no necesita aprobación y más sí", () => {
    expect(discountNeedsApproval(50_000_000, 1_500_000)).toBe(false);
    expect(discountNeedsApproval(50_000_000, 1_600_000)).toBe(true);
  });
});

describe("costo y margen: caso taller B.2-13", () => {
  const costs: UnitCost[] = [
    { id: "c1", unitId: "u1", concept: "Compra", source: "acquisition", amount: 30_000_000, status: "confirmed", date: "2026-09-01" },
    { id: "c2", unitId: "u1", concept: "Repuestos", source: "work_order", amount: 1_200_000, status: "confirmed", date: "2026-09-05" },
    { id: "c3", unitId: "u1", concept: "Mano de obra", source: "work_order", amount: 800_000, status: "confirmed", date: "2026-09-05" },
    { id: "c4", unitId: "u1", concept: "Sin soporte", source: "other", amount: 500_000, status: "pending", date: "2026-09-06" },
  ];

  it("el costo suma 32.000.000 y el costo pendiente no cuenta", () => {
    expect(confirmedCost(costs, "u1")).toBe(32_000_000);
  });

  it("margen realizado 6.000.000 al vender en 38.000.000", () => {
    const sale = { unitId: "u1", netPrice: 38_000_000 } as Sale;
    expect(realizedMargin(sale, costs)).toBe(6_000_000);
    expect(estimatedMargin(unit({ listPrice: 38_000_000 }), costs)).toBe(6_000_000);
  });
});

describe("publicación", () => {
  it("una unidad completa no tiene bloqueos", () => {
    expect(publishBlockers(unit())).toEqual([]);
  });

  it("lista cada requisito faltante", () => {
    const blockers = publishBlockers(unit({ photos: photoTemplate("car", false), condition: "", sellerVerified: false }));
    expect(blockers.length).toBeGreaterThanOrEqual(3);
  });

  it("la moto no exige tomas de silletería trasera ni maletero", () => {
    const codes = photoTemplate("motorcycle").map((p) => p.code);
    expect(codes).not.toContain("trunk");
    expect(codes).not.toContain("seats_rear");
  });

  it("transiciones válidas e inválidas", () => {
    expect(nextListingStatus("draft", "submit")).toBe("in_review");
    expect(nextListingStatus("draft", "approve")).toBeNull();
    expect(nextListingStatus("published", "withdraw")).toBe("withdrawn");
    expect(nextListingStatus("withdrawn", "resume")).toBeNull();
  });
});

describe("entrega por modalidad", () => {
  const sale = (modality: Sale["modality"]) => ({ status: "formalized", modality, downPayment: 10_000_000 }) as Sale;

  it("contado exige saldo cero", () => {
    expect(deliveryBlockers({ sale: sale("cash"), downPaymentPaid: 0, cashBalance: 5 }).length).toBe(1);
    expect(deliveryBlockers({ sale: sale("cash"), downPaymentPaid: 0, cashBalance: 0 })).toEqual([]);
  });

  it("crédito propio exige préstamo e inicial confirmada", () => {
    expect(deliveryBlockers({ sale: sale("own_credit"), downPaymentPaid: 0, cashBalance: 0 }).length).toBe(2);
  });

  it("financiación externa exige desembolso, no basta la aprobación", () => {
    const approved = { status: "approved" } as never;
    expect(deliveryBlockers({ sale: sale("external"), externalCase: approved, downPaymentPaid: 0, cashBalance: 0 }).length).toBe(1);
  });
});

describe("tesorería", () => {
  const session: CashSession = { id: "s1", branchId: "norte", openedOn: "2026-10-16", openingBase: 200_000, status: "open" };
  const pay = (over: Partial<Payment>): Payment => ({
    id: "p",
    direction: "in",
    amount: 0,
    method: "cash",
    status: "confirmed",
    ref: "x",
    counterparty: "",
    concept: "",
    targetType: "sale",
    targetId: "s",
    branchId: "norte",
    on: "2026-10-16",
    sessionId: "s1",
    ...over,
  });

  it("efectivo esperado = base + entradas en efectivo - salidas en efectivo - gastos", () => {
    const payments = [pay({ amount: 1_000_000 }), pay({ amount: 400_000, method: "pse" }), pay({ amount: 100_000, status: "pending" }), pay({ amount: 150_000, direction: "out" })];
    const expenses = [{ id: "e", concept: "", amount: 50_000, method: "cash" as const, status: "confirmed" as const, branchId: "norte" as const, on: "x", sessionId: "s1" }];
    expect(expectedCash(session, payments, expenses)).toBe(200_000 + 1_000_000 - 150_000 - 50_000);
  });

  it("cierre cuadrado, sobrante y faltante", () => {
    expect(closeSession(1_000, 1_000).verdict).toBe("cuadrado");
    expect(closeSession(1_000, 1_200).verdict).toBe("sobrante");
    expect(closeSession(1_000, 900)).toMatchObject({ verdict: "faltante", difference: -100 });
  });

  it("idempotencia por referencia externa", () => {
    expect(isDuplicateRef(["WMP-1"], "WMP-1")).toBe(true);
    expect(isDuplicateRef(["WMP-1"], "WMP-2")).toBe(false);
  });

  it("conciliación: bruto menos comisiones reales es el neto", () => {
    const r = reconcile([
      { id: "1", on: "x", description: "", gross: 1_000_000, fee: 29_000, matchedPaymentId: "p" },
      { id: "2", on: "x", description: "", gross: 500_000, fee: 14_500 },
    ]);
    expect(r).toMatchObject({ gross: 1_500_000, fees: 43_500, net: 1_456_500, matched: 1, open: 1 });
  });
});

describe("kardex y costo promedio ponderado", () => {
  const level: StockLevel = { partId: "p", branchId: "norte", onHand: 10, avgCost: 100_000 };

  it("entrada recalcula el promedio, no usa el último costo", () => {
    const next = receiveStock(level, 10, 120_000);
    expect(next.onHand).toBe(20);
    expect(next.avgCost).toBe(110_000);
  });

  it("salida usa el costo promedio vigente", () => {
    const { level: after, unitCost } = issueStock(level, 4);
    expect(unitCost).toBe(100_000);
    expect(after.onHand).toBe(6);
  });

  it("nunca deja existencia negativa", () => {
    expect(() => issueStock(level, 11)).toThrow(InsufficientStockError);
  });
});

describe("planes y permisos", () => {
  const basico: Subscription = { planId: "basico", addons: [] };

  it("Básico no incluye crédito propio y el mensaje sugiere el camino", () => {
    const r = checkModule(basico, "own_credit");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("module_not_in_plan");
  });

  it("un complemento habilita el módulo", () => {
    expect(modulesOf({ planId: "basico", addons: ["workshop"] })).toContain("workshop");
    expect(checkModule({ planId: "basico", addons: ["workshop"] }, "workshop").ok).toBe(true);
  });

  it("el límite de anuncios impide crear el 26 en Básico", () => {
    expect(checkLimit(basico, "activeListings", 24).ok).toBe(true);
    expect(checkLimit(basico, "activeListings", 25).ok).toBe(false);
  });

  it("bajar de plan reporta lo que excede sin borrar nada", () => {
    expect(overLimit(basico, { activeListings: 40, users: 2, branches: 1, featuredPerMonth: 0 })).toEqual(["activeListings"]);
    expect(PLANS.pro.limits.activeListings).toBe(150);
  });

  it("el asesor no aprueba crédito ni confirma pagos; tesorería sí confirma", () => {
    expect(can("asesor", "credit.approve")).toBe(false);
    expect(can("asesor", "payment.confirm")).toBe(false);
    expect(can("tesoreria", "payment.confirm")).toBe(true);
    expect(can("admin", "sale.annul")).toBe(true);
  });

  it("las secciones respetan el rol", () => {
    expect(canSee("asesor", "tesoreria")).toBe(false);
    expect(canSee("taller", "taller")).toBe(true);
  });
});
