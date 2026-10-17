import { allocatePayment, buildSchedule, toInstallments, type LoanInstallment, ENGINE_VERSION } from "@/domain/credit";
import { addDays, DEMO_TODAY, type IsoDate } from "@/domain/dates";
import { appendAudit } from "@/domain/audit";
import { photoTemplate } from "@/domain/inventory";
import { balances, credit, debit, type Account, type LedgerEntry, type LedgerTx } from "@/domain/ledger";
import { sum } from "@/domain/money";
import { defaultGrants } from "@/domain/rbac";
import type {
  Appointment,
  AuditEvent,
  BankLine,
  BranchId,
  CashSession,
  CounterSale,
  DemoData,
  DocType,
  Expense,
  Lead,
  Loan,
  Member,
  Part,
  Payment,
  PurchaseInvoice,
  Quote,
  Refund,
  Reservation,
  Sale,
  StockMovement,
  SupplierObligation,
  Unit,
  UnitCost,
  UnitStatus,
  VehicleDoc,
  VehicleKind,
  WorkLine,
  WorkOrder,
} from "@/domain/types";

export const BRANCH_NAMES: Record<BranchId, string> = { norte: "Sede Norte", centro: "Sede Centro" };

const today = DEMO_TODAY;
const day = (offset: number): IsoDate => addDays(today, offset);

/* ---------------- Equipo ---------------- */

const members: Member[] = [
  { id: "m-marcela", name: "Marcela Ospino", email: "marcela@autoscaribe.example", role: "admin", branchIds: ["norte", "centro"], status: "active" },
  { id: "m-andres", name: "Andrés Pacheco", email: "andres@autoscaribe.example", role: "asesor", branchIds: ["norte"], status: "active" },
  { id: "m-valentina", name: "Valentina Cure", email: "valentina@autoscaribe.example", role: "asesor", branchIds: ["centro"], status: "active" },
  { id: "m-carlos", name: "Carlos Mendoza", email: "carlos@autoscaribe.example", role: "tesoreria", branchIds: ["norte", "centro"], status: "active" },
  { id: "m-daniela", name: "Daniela Barros", email: "daniela@autoscaribe.example", role: "cartera", branchIds: ["norte", "centro"], status: "active" },
  { id: "m-jorge", name: "Jorge Escorcia", email: "jorge@autoscaribe.example", role: "taller", branchIds: ["norte"], status: "active" },
  { id: "m-luis", name: "Luis Arrieta", email: "luis@autoscaribe.example", role: "taller", branchIds: ["norte"], status: "active" },
  { id: "m-yeison", name: "Yeison Molina", email: "yeison@autoscaribe.example", role: "taller", branchIds: ["centro"], status: "invited" },
];

/* ---------------- Inventario ---------------- */

type UnitRow = [id: string, kind: VehicleKind, make: string, model: string, trim: string, year: number, km: number, plate: string, color: string, price: number, branch: BranchId, status: UnitStatus];

const UNIT_ROWS: UnitRow[] = [
  ["u01", "car", "Chevrolet", "Onix", "LT", 2022, 38_400, "KRB 412", "Blanco", 54_900_000, "norte", "available"],
  ["u02", "car", "Mazda", "3", "Touring", 2021, 52_100, "JTN 228", "Gris", 71_500_000, "norte", "available"],
  ["u03", "car", "Renault", "Duster", "Intens", 2020, 61_800, "GKH 905", "Naranja", 58_900_000, "centro", "available"],
  ["u04", "car", "Kia", "Picanto", "Zenith", 2021, 29_700, "IOP 331", "Rojo", 42_500_000, "norte", "available"],
  ["u05", "car", "Toyota", "Hilux", "SRV", 2019, 93_400, "FXC 774", "Blanco", 148_000_000, "centro", "available"],
  ["u06", "car", "Nissan", "Kicks", "Advance", 2022, 21_500, "LMA 560", "Azul", 69_900_000, "norte", "reserved"],
  ["u07", "car", "Hyundai", "Tucson", "GLS", 2020, 57_900, "HDS 118", "Negro", 79_800_000, "centro", "available"],
  ["u08", "car", "Ford", "Escape", "SE", 2019, 78_300, "EBT 642", "Plata", 64_900_000, "norte", "in_preparation"],
  ["u09", "car", "Suzuki", "Swift", "GL", 2021, 33_200, "KDA 207", "Rojo", 44_900_000, "centro", "available"],
  ["u10", "car", "Volkswagen", "Gol", "Trendline", 2020, 48_900, "GNP 389", "Blanco", 36_500_000, "norte", "in_preparation"],
  ["u11", "car", "Chevrolet", "Tracker", "Premier", 2023, 14_600, "NRQ 915", "Gris", 89_900_000, "norte", "available"],
  ["u12", "car", "Renault", "Sandero", "Stepway", 2019, 70_100, "FYU 273", "Gris", 41_900_000, "centro", "in_preparation"],
  ["u13", "car", "Mazda", "CX-5", "Grand Touring", 2021, 44_800, "JUV 650", "Rojo", 112_000_000, "norte", "available"],
  ["u14", "car", "Kia", "Sportage", "Revolution", 2020, 66_200, "HGB 084", "Blanco", 82_500_000, "centro", "reserved"],
  ["u15", "car", "Toyota", "Corolla", "XEi", 2018, 88_500, "EAZ 531", "Plata", 56_900_000, "norte", "sold"],
  ["u16", "car", "Chevrolet", "Spark", "GT", 2019, 52_000, "FTM 726", "Amarillo", 31_900_000, "centro", "sold"],
  ["u17", "car", "Honda", "CR-V", "EXL", 2020, 59_300, "HKL 449", "Negro", 119_000_000, "norte", "sold"],
  ["u18", "car", "Nissan", "Versa", "Advance", 2019, 74_100, "FBN 902", "Gris", 43_900_000, "centro", "delivered"],
  ["u19", "motorcycle", "Yamaha", "NMAX", "155", 2022, 12_300, "XYK 41F", "Gris", 14_900_000, "norte", "available"],
  ["u20", "motorcycle", "Honda", "CB 190R", "Estándar", 2021, 18_900, "MRS 22E", "Rojo", 9_800_000, "centro", "available"],
  ["u21", "motorcycle", "Bajaj", "Pulsar NS200", "UG", 2021, 22_400, "JKR 07F", "Negro", 9_200_000, "norte", "available"],
  ["u22", "motorcycle", "Suzuki", "Gixxer", "150", 2021, 20_500, "PTA 18F", "Azul", 10_900_000, "centro", "delivered"],
  ["u23", "motorcycle", "Auteco", "Victory", "110", 2019, 40_200, "HYE 90D", "Blanco", 3_900_000, "norte", "in_preparation"],
  ["u24", "motorcycle", "Yamaha", "FZ", "150", 2020, 27_800, "NTR 33E", "Negro", 8_600_000, "norte", "available"],
  ["u25", "car", "Chevrolet", "Sail", "LTZ", 2018, 81_200, "EXY 366", "Plata", 34_900_000, "norte", "delivered"],
];

const CONDITIONS = [
  "Rayón superficial en el parachoques trasero. Mantenimientos al día en concesionario.",
  "Sin choques reportados. Desgaste normal de silletería. Segundo dueño.",
  "Pequeño golpe reparado en puerta derecha. Llantas al 70 %.",
  "Único dueño. Cambio de pastillas reciente. Un rayón en el capó.",
];

const DOC_TYPES: DocType[] = ["soat", "rtm", "property_card"];

function docs(unitId: string): VehicleDoc[] {
  return DOC_TYPES.map((type): VehicleDoc => {
    // u10 tiene el SOAT vencido y u12 no tiene tecnomecánica: sirven para mostrar bloqueos de publicación.
    if (unitId === "u10" && type === "soat") return { type, status: "expired", validUntil: day(-12) };
    if (unitId === "u12" && type === "rtm") return { type, status: "missing" };
    return { type, status: "reviewed", validUntil: type === "property_card" ? undefined : day(120) };
  });
}

function photosFor(kind: VehicleKind, status: UnitStatus, id: string) {
  const slots = photoTemplate(kind);
  const partial = status === "in_preparation";
  const done = partial ? Math.max(2, Math.floor(slots.length / 2) - (id.charCodeAt(2) % 3)) : slots.length;
  return slots.map((s, i) => ({ ...s, done: i < done }));
}

const units: Unit[] = UNIT_ROWS.map(([id, kind, make, model, trim, year, km, plate, color, listPrice, branchId, status], i) => ({
  id,
  kind,
  make,
  model,
  trim,
  year,
  km,
  vin: `9BW${kind === "car" ? "ZZZ" : "MTO"}${String(377000 + i * 137).padStart(6, "0")}${String(year % 100)}`,
  plate,
  color,
  city: "Barranquilla",
  branchId,
  status,
  listPrice,
  ownership: "owned",
  acquiredOn: day(-30 - ((i * 7) % 60)),
  condition: status === "in_preparation" && id === "u23" ? "" : CONDITIONS[i % CONDITIONS.length],
  photos: photosFor(kind, status, id),
  docs: docs(id),
  sellerVerified: true,
  inspection:
    i % 3 === 0 && status !== "in_preparation"
      ? { inspector: "Ing. Rafael Contreras", org: "Peritajes del Atlántico", date: day(-14), scope: "Mecánica, carrocería, electrónica y pruebas de ruta", result: "approved", validUntil: day(76), status: "active" }
      : undefined,
}));

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

const costs: UnitCost[] = units.flatMap((u, i) => {
  const acquisition = roundTo(u.listPrice * (u.kind === "car" ? 0.8 : 0.78), 100_000);
  const list: UnitCost[] = [
    { id: `c-${u.id}-a`, unitId: u.id, concept: "Compra del vehículo", source: "acquisition", amount: acquisition, status: "confirmed", date: u.acquiredOn },
    { id: `c-${u.id}-t`, unitId: u.id, concept: "Traslado y trámites", source: "transport", amount: 350_000 + (i % 4) * 90_000, status: "confirmed", date: u.acquiredOn },
  ];
  if (u.id === "u05" || u.id === "u13") {
    list.push({ id: `c-${u.id}-p`, unitId: u.id, concept: "Peritaje sin soporte cargado", source: "other", amount: 280_000, status: "pending", date: day(-6) });
  }
  return list;
});

/* ---------------- Repuestos y taller ---------------- */

const parts: Part[] = [
  { id: "p01", ref: "FIL-ACE-001", oem: "15208-65F0A", description: "Filtro de aceite", compat: "Chevrolet, Renault, Nissan (1.0 a 1.6)", kind: "car", salePrice: 32_000 },
  { id: "p02", ref: "PAS-DEL-014", oem: "58101-1RA00", description: "Pastillas de freno delanteras", compat: "Kia Picanto, Hyundai i10, Chevrolet Spark", kind: "car", salePrice: 138_000 },
  { id: "p03", ref: "ACE-5W30-4L", oem: "ACEL-5W30", description: "Aceite sintético 5W-30 (4 L)", compat: "Motores a gasolina modernos", kind: "car", salePrice: 189_000 },
  { id: "p04", ref: "BUJ-IR-004", oem: "SILFR6A", description: "Bujías de iridio (juego x4)", compat: "Mazda 3, Ford Escape, Nissan Kicks", kind: "car", salePrice: 164_000 },
  { id: "p05", ref: "BAT-12V-60", oem: "L2-60", description: "Batería 12 V 60 Ah", compat: "Vehículos livianos", kind: "car", salePrice: 395_000 },
  { id: "p06", ref: "FIL-AIR-022", oem: "16546-4BA0A", description: "Filtro de aire", compat: "Nissan Kicks, Versa, Renault Duster", kind: "car", salePrice: 54_000 },
  { id: "p07", ref: "AMO-DEL-007", oem: "54302-4KM0A", description: "Amortiguador delantero", compat: "Ford Escape, Mazda CX-5", kind: "car", salePrice: 286_000 },
  { id: "p08", ref: "LLA-185-65R15", oem: "185/65R15", description: "Llanta 185/65 R15", compat: "Sedán y hatchback compacto", kind: "car", salePrice: 365_000 },
  { id: "p09", ref: "KIT-ARR-125", oem: "KA-125-428", description: "Kit de arrastre 125 cc", compat: "AKT NKD, Auteco Victory, Honda CB 125", kind: "motorcycle", salePrice: 98_000 },
  { id: "p10", ref: "CAD-428H", oem: "428H-120L", description: "Cadena 428H", compat: "Motos 110 a 150 cc", kind: "motorcycle", salePrice: 62_000 },
  { id: "p11", ref: "PAS-MOT-DEL", oem: "FA-174", description: "Pastillas de freno de moto", compat: "Yamaha FZ y NMAX, Suzuki Gixxer", kind: "motorcycle", salePrice: 38_000 },
  { id: "p12", ref: "ACE-20W50-1L", oem: "MOT-20W50", description: "Aceite 20W-50 para moto (1 L)", compat: "Motos de 4 tiempos", kind: "motorcycle", salePrice: 36_000 },
  { id: "p13", ref: "BAT-12V-9", oem: "YTX9-BS", description: "Batería 12 V 9 Ah", compat: "Motos 150 a 250 cc", kind: "motorcycle", salePrice: 145_000 },
  { id: "p14", ref: "BOM-LUZ-H4", oem: "H4-60/55", description: "Bombillo H4 (par)", compat: "Carros y motos con óptica H4", kind: "both", salePrice: 28_000 },
];

const AVG_COST: Record<string, number> = { p01: 19_500, p02: 84_000, p03: 121_000, p04: 102_000, p05: 252_000, p06: 31_000, p07: 176_000, p08: 228_000, p09: 59_000, p10: 36_500, p11: 21_000, p12: 22_500, p13: 92_000, p14: 14_000 };

/** Existencia inicial por sede: [parte, sede, cantidad]. */
const OPENING_STOCK: [string, BranchId, number][] = [
  ["p01", "norte", 14], ["p01", "centro", 8], ["p02", "norte", 6], ["p02", "centro", 4], ["p03", "norte", 10], ["p03", "centro", 6],
  ["p04", "norte", 5], ["p05", "norte", 3], ["p05", "centro", 2], ["p06", "norte", 7], ["p06", "centro", 5], ["p07", "norte", 4],
  ["p08", "norte", 8], ["p08", "centro", 4], ["p09", "norte", 6], ["p09", "centro", 5], ["p10", "norte", 9], ["p11", "norte", 12],
  ["p11", "centro", 7], ["p12", "norte", 20], ["p12", "centro", 14], ["p13", "norte", 3], ["p14", "norte", 16], ["p14", "centro", 10],
];

const movements: StockMovement[] = OPENING_STOCK.map(([partId, branchId, qty], i) => ({
  id: `mv-open-${i + 1}`,
  partId,
  branchId,
  type: "purchase_in",
  qty,
  unitCost: AVG_COST[partId],
  sourceId: "apertura",
  on: day(-45),
}));

let lineSeq = 0;
const line = (kind: WorkLine["kind"], description: string, qty: number, unitCost: number, status: WorkLine["status"], partId?: string): WorkLine => ({
  id: `wl-${++lineSeq}`,
  kind,
  description,
  qty,
  unitCost,
  status,
  partId,
});

const workOrders: WorkOrder[] = [
  {
    id: "wo1", number: "OT-0001", unitId: "u08", branchId: "norte", bay: "Bahía 1", technicianId: "m-luis", status: "in_progress", budget: 1_450_000,
    description: "Cambio de amortiguadores delanteros y mantenimiento de frenos.", createdOn: day(-5),
    lines: [line("part", "Amortiguador delantero", 2, AVG_COST.p07, "confirmed", "p07"), line("part", "Pastillas de freno delanteras", 1, AVG_COST.p02, "confirmed", "p02"), line("labor", "Mano de obra mecánica", 3, 45_000, "confirmed"), line("labor", "Alineación y balanceo", 1.5, 45_000, "pending")],
  },
  { id: "wo2", number: "OT-0002", unitId: "u10", branchId: "norte", bay: "Bahía 2", technicianId: "m-luis", status: "diagnosis", budget: 0, description: "Diagnóstico general y renovación de SOAT.", createdOn: day(-1), lines: [] },
  {
    id: "wo3", number: "OT-0003", unitId: "u12", branchId: "centro", bay: "Bahía 3", technicianId: "m-yeison", status: "quality", budget: 780_000,
    description: "Mantenimiento de 70.000 km.", createdOn: day(-8),
    lines: [line("part", "Filtro de aceite", 1, AVG_COST.p01, "confirmed", "p01"), line("part", "Aceite sintético 5W-30 (4 L)", 1, AVG_COST.p03, "confirmed", "p03"), line("part", "Filtro de aire", 1, AVG_COST.p06, "confirmed", "p06"), line("labor", "Mano de obra mecánica", 2, 45_000, "confirmed")],
  },
  {
    id: "wo4", number: "OT-0004", unitId: "u20", branchId: "centro", bay: "Bahía 4", technicianId: "m-yeison", status: "done", budget: 330_000,
    description: "Servicio completo de moto: cadena, pastillas y aceite.", createdOn: day(-12),
    lines: [line("part", "Kit de arrastre 125 cc", 1, AVG_COST.p09, "confirmed", "p09"), line("part", "Pastillas de freno de moto", 1, AVG_COST.p11, "confirmed", "p11"), line("part", "Aceite 20W-50 para moto (1 L)", 1, AVG_COST.p12, "confirmed", "p12"), line("labor", "Mano de obra mecánica", 1.5, 40_000, "confirmed")],
  },
  {
    id: "wo5", number: "OT-0005", unitId: "u23", branchId: "norte", bay: "Bahía 1", technicianId: "m-jorge", status: "approved", budget: 210_000,
    description: "Cadena y bujías para dejar lista para venta.", createdOn: day(-2),
    lines: [line("part", "Cadena 428H", 1, AVG_COST.p10, "pending", "p10")],
  },
];

// Las líneas confirmadas ya movieron kardex y sumaron costo a su unidad.
for (const wo of workOrders) {
  for (const l of wo.lines) {
    if (l.status !== "confirmed") continue;
    if (l.kind === "part" && l.partId) {
      movements.push({ id: `mv-${l.id}`, partId: l.partId, branchId: wo.branchId, type: "work_order_out", qty: -l.qty, unitCost: l.unitCost, sourceId: wo.id, on: day(-3) });
    }
    costs.push({ id: `c-${l.id}`, unitId: wo.unitId, concept: l.description, source: "work_order", amount: l.qty * l.unitCost, status: "confirmed", date: day(-3), sourceId: wo.id });
  }
}

const purchases: PurchaseInvoice[] = [
  { id: "pi1", supplier: "Autopartes del Caribe S.A.S.", number: "AP-48211", branchId: "norte", on: day(-14), terms: "credit", lines: [{ partId: "p02", qty: 6, unitCost: 84_000 }, { partId: "p07", qty: 4, unitCost: 176_000 }], obligationId: "o2" },
  { id: "pi2", supplier: "Lubricantes Costeños Ltda.", number: "LC-9930", branchId: "centro", on: day(-49), terms: "credit", lines: [{ partId: "p03", qty: 6, unitCost: 121_000 }, { partId: "p12", qty: 14, unitCost: 22_500 }], obligationId: "o3" },
];

for (const p of purchases) {
  p.lines.forEach((l, i) => movements.push({ id: `mv-${p.id}-${i}`, partId: l.partId, branchId: p.branchId, type: "purchase_in", qty: l.qty, unitCost: l.unitCost, sourceId: p.id, on: p.on }));
}

const counterSales: CounterSale[] = [
  { id: "cs1", number: "MO-0001", customer: "Taller El Rápido", branchId: "norte", on: day(-3), status: "confirmed", paymentId: "pay-cs1", lines: [{ partId: "p01", qty: 4, unitPrice: 32_000, unitCost: 19_500 }, { partId: "p03", qty: 2, unitPrice: 189_000, unitCost: 121_000 }] },
  { id: "cs2", number: "MO-0002", customer: "Consumidor final", branchId: "centro", on: day(-1), status: "confirmed", paymentId: "pay-cs2", lines: [{ partId: "p12", qty: 3, unitPrice: 36_000, unitCost: 22_500 }, { partId: "p11", qty: 1, unitPrice: 38_000, unitCost: 21_000 }] },
  { id: "cs3", number: "MO-0003", customer: "Consumidor final", branchId: "norte", on: today, status: "confirmed", paymentId: "pay-cs3", lines: [{ partId: "p14", qty: 2, unitPrice: 28_000, unitCost: 14_000 }, { partId: "p06", qty: 1, unitPrice: 54_000, unitCost: 31_000 }] },
];

for (const s of counterSales) {
  s.lines.forEach((l, i) => movements.push({ id: `mv-${s.id}-${i}`, partId: l.partId, branchId: s.branchId, type: "counter_sale_out", qty: -l.qty, unitCost: l.unitCost, sourceId: s.id, on: s.on }));
}

function deriveStock() {
  const keys = new Map<string, { partId: string; branchId: BranchId; onHand: number }>();
  for (const m of movements) {
    const key = `${m.partId}|${m.branchId}`;
    const cur = keys.get(key) ?? { partId: m.partId, branchId: m.branchId, onHand: 0 };
    cur.onHand += m.qty;
    keys.set(key, cur);
  }
  return [...keys.values()].map((s) => ({ ...s, avgCost: AVG_COST[s.partId] }));
}

/* ---------------- Ventas, crédito y pagos ---------------- */

const buyer = (name: string, doc: string, phone = "300 000 0000") => ({ name, doc, phone });

function makeLoan(id: string, saleId: string, who: ReturnType<typeof buyer>, principal: number, down: number, ea: number, months: number, firstDueOn: IsoDate, paidCount: number): Loan {
  const rows = buildSchedule({ principal, eaPercent: ea, months, firstDueOn });
  let installments: LoanInstallment[] = toInstallments(rows);
  if (paidCount > 0) {
    const amount = sum(rows.slice(0, paidCount).map((r) => r.total));
    installments = allocatePayment(installments, amount, firstDueOn).installments;
    installments = installments.map((i) => (i.number <= paidCount ? { ...i, paidOn: i.dueOn } : i));
  }
  return { id, saleId, borrower: who, principal, downPayment: down, eaPercent: ea, months, engineVersion: ENGINE_VERSION, installments, status: "active", collection: [] };
}

const loan0 = makeLoan("l0", "v1", buyer("Kevin Arévalo", "1.042.771.903"), 8_000_000, 2_600_000, 26, 18, "2026-03-10", 2);
const loan1 = makeLoan("l1", "v2", buyer("Rosa Elena Vargas", "32.771.118"), 28_000_000, 15_500_000, 24, 24, "2026-05-15", 3);
const loan2 = makeLoan("l2", "v4", buyer("Mauricio Delgado", "8.771.440"), 36_000_000, 20_000_000, 22, 36, "2026-11-15", 0);

loan0.collection = [
  { id: "ca1", on: day(-60), channel: "call", stage: "preventive", note: "Se comprometió a pagar el viernes. No pagó.", delivered: true },
  { id: "ca2", on: day(-28), channel: "whatsapp", stage: "pre_legal", note: "Aviso prejurídico enviado con plazo de 10 días.", delivered: true },
];
loan1.collection = [{ id: "ca3", on: day(-20), channel: "call", stage: "preventive", note: "Cliente reporta calamidad familiar. Pide plazo.", delivered: true }];

const sales: Sale[] = [
  { id: "v1", number: "V-0001", unitId: "u22", buyer: loan0.borrower, modality: "own_credit", netPrice: 10_600_000, downPayment: 2_600_000, status: "delivered", invoice: "fiscal_ok", loanId: "l0", formalizedOn: "2026-02-18", advisorId: "m-valentina", deliveredOn: "2026-02-20", delivery: { receiver: "Kevin Arévalo" } },
  { id: "v2", number: "V-0002", unitId: "u18", buyer: loan1.borrower, modality: "own_credit", netPrice: 43_500_000, downPayment: 15_500_000, status: "delivered", invoice: "fiscal_ok", loanId: "l1", formalizedOn: "2026-04-18", advisorId: "m-valentina", deliveredOn: "2026-04-20", delivery: { receiver: "Rosa Elena Vargas" } },
  { id: "v3", number: "V-0003", unitId: "u25", buyer: buyer("Distribuciones Marlin S.A.S.", "901.332.118-4"), modality: "cash", netPrice: 33_800_000, downPayment: 0, status: "delivered", invoice: "fiscal_ok", formalizedOn: day(-62), advisorId: "m-andres", deliveredOn: day(-60), delivery: { receiver: "Pedro Marlin" } },
  { id: "v4", number: "V-0004", unitId: "u15", buyer: loan2.borrower, modality: "own_credit", netPrice: 56_000_000, downPayment: 20_000_000, status: "formalized", invoice: "internal", loanId: "l2", formalizedOn: day(-2), advisorId: "m-andres" },
  { id: "v5", number: "V-0005", unitId: "u16", buyer: buyer("Johana Castillo", "1.129.554.002"), modality: "external", netPrice: 31_500_000, downPayment: 9_500_000, status: "formalized", invoice: "internal", caseId: "x1", formalizedOn: day(-4), advisorId: "m-valentina" },
  { id: "v6", number: "V-0006", unitId: "u17", buyer: buyer("Inversiones Gómez Hnos.", "900.118.552-1"), modality: "layaway", netPrice: 118_000_000, downPayment: 5_000_000, status: "formalized", invoice: "internal", layawayId: "ly1", formalizedOn: day(-30), advisorId: "m-andres" },
  { id: "v7", number: "V-0007", unitId: "u09", buyer: buyer("Esteban Rojas", "1.045.332.776"), modality: "layaway", netPrice: 44_900_000, downPayment: 5_000_000, status: "annulled", invoice: "none", layawayId: "ly2", formalizedOn: day(-40), advisorId: "m-valentina", annulReason: "El cliente desistió y no consiguió el saldo antes de la fecha límite." },
];

const pay = (p: Partial<Payment> & Pick<Payment, "id" | "amount" | "method" | "ref" | "targetType" | "targetId" | "on">): Payment => ({
  direction: "in",
  status: "confirmed",
  counterparty: "",
  concept: "",
  branchId: "norte",
  ...p,
});

const payments: Payment[] = [];

// Pagos históricos de cuotas pagadas.
for (const loan of [loan0, loan1]) {
  const sale = sales.find((s) => s.id === loan.saleId)!;
  payments.push(pay({ id: `pay-${loan.id}-down`, amount: loan.downPayment, method: "transfer", ref: `TRF-${loan.id}-0`, targetType: "sale", targetId: sale.id, on: sale.formalizedOn, counterparty: loan.borrower.name, concept: `Cuota inicial ${sale.number}`, branchId: "centro" }));
  for (const inst of loan.installments.filter((i) => i.paidOn)) {
    payments.push(
      pay({
        id: `pay-${loan.id}-${inst.number}`,
        amount: inst.total,
        method: inst.number % 2 ? "pse" : "nequi",
        ref: `${inst.number % 2 ? "PSE" : "NEQ"}-${loan.id}-${inst.number}`,
        targetType: "installment",
        targetId: loan.id,
        on: inst.dueOn,
        counterparty: loan.borrower.name,
        concept: `Cuota ${inst.number} de ${loan.months}`,
        branchId: "centro",
        allocations: [{ label: `Cuota ${inst.number}: intereses`, amount: inst.interest }, { label: `Cuota ${inst.number}: capital`, amount: inst.principal }],
      }),
    );
  }
}

payments.push(
  pay({ id: "pay-v3-1", amount: 10_000_000, method: "transfer", ref: "TRF-V3-1", targetType: "sale", targetId: "v3", on: day(-62), counterparty: "Distribuciones Marlin S.A.S.", concept: "Anticipo V-0003" }),
  pay({ id: "pay-v3-2", amount: 23_800_000, method: "transfer", ref: "TRF-V3-2", targetType: "sale", targetId: "v3", on: day(-61), counterparty: "Distribuciones Marlin S.A.S.", concept: "Saldo V-0003" }),
  pay({ id: "pay-l2-down-1", amount: 12_000_000, method: "transfer", ref: "TRF-L2-1", targetType: "sale", targetId: "v4", on: day(-2), counterparty: "Mauricio Delgado", concept: "Cuota inicial V-0004 (parte 1)" }),
  pay({ id: "pay-l2-down-2", amount: 8_000_000, method: "transfer", ref: "TRF-L2-2", targetType: "sale", targetId: "v4", on: today, counterparty: "Mauricio Delgado", concept: "Cuota inicial V-0004 (parte 2)", status: "pending" }),
  pay({ id: "pay-v5-down", amount: 9_500_000, method: "transfer", ref: "TRF-V5-1", targetType: "sale", targetId: "v5", on: day(-4), counterparty: "Johana Castillo", concept: "Cuota inicial V-0005", branchId: "centro" }),
  pay({ id: "pay-ly1-1", amount: 5_000_000, method: "transfer", ref: "TRF-LY1-1", targetType: "layaway", targetId: "ly1", on: day(-30), counterparty: "Inversiones Gómez Hnos.", concept: "Inicial Plan Separe V-0006" }),
  pay({ id: "pay-ly1-2", amount: 15_000_000, method: "pse", ref: "PSE-LY1-2", targetType: "layaway", targetId: "ly1", on: day(-15), counterparty: "Inversiones Gómez Hnos.", concept: "Abono Plan Separe V-0006" }),
  pay({ id: "pay-ly1-3", amount: 20_000_000, method: "transfer", ref: "TRF-LY1-3", targetType: "layaway", targetId: "ly1", on: day(-6), counterparty: "Inversiones Gómez Hnos.", concept: "Abono Plan Separe V-0006" }),
  pay({ id: "pay-ly2-1", amount: 5_000_000, method: "transfer", ref: "TRF-LY2-1", targetType: "layaway", targetId: "ly2", on: day(-40), counterparty: "Esteban Rojas", concept: "Inicial Plan Separe V-0007", branchId: "centro" }),
  pay({ id: "pay-ly2-2", amount: 10_000_000, method: "pse", ref: "PSE-LY2-2", targetType: "layaway", targetId: "ly2", on: day(-25), counterparty: "Esteban Rojas", concept: "Abono Plan Separe V-0007", branchId: "centro" }),
  pay({ id: "pay-res1", amount: 1_000_000, method: "cash", ref: "EFE-R1", targetType: "reservation", targetId: "r1", on: today, counterparty: "Sandra Peñaranda", concept: "Anticipo reserva Nissan Kicks", sessionId: "cs-norte-0" }),
  pay({ id: "pay-cs1", amount: 4 * 32_000 + 2 * 189_000, method: "transfer", ref: "TRF-MO1", targetType: "counter_sale", targetId: "cs1", on: day(-3), counterparty: "Taller El Rápido", concept: "Venta de mostrador MO-0001" }),
  pay({ id: "pay-cs2", amount: 3 * 36_000 + 38_000, method: "nequi", ref: "NEQ-MO2", targetType: "counter_sale", targetId: "cs2", on: day(-1), counterparty: "Consumidor final", concept: "Venta de mostrador MO-0002", branchId: "centro" }),
  pay({ id: "pay-cs3", amount: 2 * 28_000 + 54_000, method: "cash", ref: "EFE-MO3", targetType: "counter_sale", targetId: "cs3", on: today, counterparty: "Consumidor final", concept: "Venta de mostrador MO-0003", sessionId: "cs-norte-0" }),
  pay({ id: "pay-o1", direction: "out", amount: 12_000_000, method: "transfer", ref: "TRF-O1-1", targetType: "supplier", targetId: "o1", on: day(-9), counterparty: "Subastas Andina S.A.", concept: "Abono compra Toyota Hilux" }),
  pay({ id: "pay-pending-nequi", amount: 480_000, method: "nequi", ref: "NEQ-PEND-1", targetType: "counter_sale", targetId: "cs3", on: today, counterparty: "Cliente de mostrador", concept: "Pago pendiente de confirmar por la pasarela", status: "pending" }),
);

const obligations: SupplierObligation[] = [
  { id: "o1", supplier: "Subastas Andina S.A.", docRef: "SA-2210", concept: "Compra Toyota Hilux SRV 2019", amount: 30_000_000, outstanding: 18_000_000, dueOn: day(12), origin: "vehicle" },
  { id: "o2", supplier: "Autopartes del Caribe S.A.S.", docRef: "AP-48211", concept: "Repuestos (frenos y amortiguadores)", amount: 6 * 84_000 + 4 * 176_000, outstanding: 6 * 84_000 + 4 * 176_000, dueOn: day(5), origin: "parts" },
  { id: "o3", supplier: "Lubricantes Costeños Ltda.", docRef: "LC-9930", concept: "Aceites y lubricantes", amount: 6 * 121_000 + 14 * 22_500, outstanding: 6 * 121_000 + 14 * 22_500, dueOn: day(-17), origin: "parts" },
];

const expenses: Expense[] = [
  { id: "e1", concept: "Papelería y fotocopias", amount: 38_000, method: "cash", status: "confirmed", branchId: "norte", on: today, sessionId: "cs-norte-0" },
  { id: "e2", concept: "Lavado y alistamiento de vitrina", amount: 120_000, method: "transfer", status: "confirmed", branchId: "norte", on: day(-1) },
];

const refunds: Refund[] = [
  { id: "rf1", layawayId: "ly2", saleId: "v7", buyer: "Esteban Rojas", amount: 15_000_000, reason: "Cancelación de Plan Separe V-0007 por desistimiento del cliente.", status: "requested", requestedBy: "m-valentina", on: day(-3) },
];

const cashSessions: CashSession[] = [
  { id: "cs-norte-0", branchId: "norte", openedOn: today, openingBase: 300_000, status: "open" },
  { id: "cs-centro-0", branchId: "centro", openedOn: today, openingBase: 250_000, status: "open" },
  { id: "cs-norte-prev", branchId: "norte", openedOn: day(-1), openingBase: 300_000, status: "closed", expected: 1_480_000, counted: 1_460_000, difference: -20_000, withdrawal: 1_160_000, nextBase: 300_000, closedBy: "m-carlos" },
];

const bankLines: BankLine[] = [
  { id: "bl1", on: day(-3), description: "Abono TRF-MO1 Taller El Rápido", gross: 506_000, fee: 0, matchedPaymentId: "pay-cs1" },
  { id: "bl2", on: day(-1), description: "Liquidación pasarela NEQ-MO2", gross: 145_000, fee: 4_205, matchedPaymentId: "pay-cs2" },
  { id: "bl3", on: day(-2), description: "Transferencia Mauricio Delgado", gross: 12_000_000, fee: 0, matchedPaymentId: "pay-l2-down-1" },
  { id: "bl4", on: day(-4), description: "Transferencia Johana Castillo", gross: 9_500_000, fee: 0, matchedPaymentId: "pay-v5-down" },
  { id: "bl5", on: day(-6), description: "Transferencia Inversiones Gómez", gross: 20_000_000, fee: 0, matchedPaymentId: "pay-ly1-3" },
  { id: "bl6", on: day(-2), description: "Depósito sin identificar", gross: 750_000, fee: 0 },
  { id: "bl7", on: day(-1), description: "Liquidación pasarela PSE lote 118", gross: 2_300_000, fee: 66_700 },
];

/* ---------------- CRM ---------------- */

const leads: Lead[] = [
  { id: "ld1", unitId: "u02", name: "Camilo Ariza", phone: "301 555 0142", channel: "marketplace", status: "quoted", assigneeId: "m-andres", createdOn: day(-5), note: "Quiere financiar a 48 meses." },
  { id: "ld2", unitId: "u13", name: "Paola Cantillo", phone: "310 555 0188", channel: "whatsapp", status: "appointment", assigneeId: "m-andres", createdOn: day(-3) },
  { id: "ld3", unitId: "u05", name: "Ganadería La Esperanza", phone: "315 555 0121", channel: "phone", status: "contacted", assigneeId: "m-valentina", createdOn: day(-6), note: "Pide ver la Hilux con su mecánico." },
  { id: "ld4", unitId: "u11", name: "Natalia Fontalvo", phone: "304 555 0173", channel: "marketplace", status: "new", assigneeId: null, createdOn: day(0) },
  { id: "ld5", unitId: "u19", name: "Brayan Sarmiento", phone: "320 555 0166", channel: "marketplace", status: "new", assigneeId: null, createdOn: day(0) },
  { id: "ld6", unitId: "u07", name: "Luis Fernando Pinedo", phone: "312 555 0135", channel: "visit", status: "contacted", assigneeId: "m-valentina", createdOn: day(-2) },
  { id: "ld7", unitId: "u01", name: "Ingrid Mendoza", phone: "301 555 0199", channel: "whatsapp", status: "appointment", assigneeId: "m-andres", createdOn: day(-4) },
  { id: "ld8", unitId: "u21", name: "Juan David Lozano", phone: "317 555 0104", channel: "marketplace", status: "contacted", assigneeId: "m-andres", createdOn: day(-2) },
  { id: "ld9", unitId: "u06", name: "Sandra Peñaranda", phone: "300 555 0112", channel: "visit", status: "won", assigneeId: "m-andres", createdOn: day(-9) },
  { id: "ld10", unitId: "u14", name: "Hernando Rueda", phone: "314 555 0127", channel: "phone", status: "won", assigneeId: "m-valentina", createdOn: day(-8) },
  { id: "ld11", unitId: "u03", name: "Mónica Barraza", phone: "311 555 0150", channel: "marketplace", status: "lost", assigneeId: "m-valentina", createdOn: day(-12), note: "Compró en otro patio." },
  { id: "ld12", unitId: "u24", name: "Edwin Navarro", phone: "318 555 0149", channel: "marketplace", status: "new", assigneeId: null, createdOn: day(-1) },
];

const appointments: Appointment[] = [
  { id: "ap1", leadId: "ld2", unitId: "u13", kind: "test_drive", slot: `${day(1)}T10:00`, status: "requested", responsibleId: "m-andres" },
  { id: "ap2", leadId: "ld7", unitId: "u01", kind: "visit", slot: `${day(1)}T15:30`, status: "confirmed", responsibleId: "m-andres" },
  { id: "ap3", leadId: "ld3", unitId: "u05", kind: "visit", slot: `${day(3)}T09:00`, status: "requested", responsibleId: "m-valentina" },
  { id: "ap4", leadId: "ld6", unitId: "u07", kind: "test_drive", slot: `${day(2)}T11:00`, status: "rescheduled", responsibleId: "m-valentina" },
  { id: "ap5", leadId: "ld9", unitId: "u06", kind: "visit", slot: `${day(-3)}T16:00`, status: "attended", responsibleId: "m-andres" },
  { id: "ap6", leadId: "ld11", unitId: "u03", kind: "visit", slot: `${day(-7)}T10:30`, status: "no_show", responsibleId: "m-valentina" },
];

const quotes: Quote[] = [
  { id: "q1", number: "COT-0001", unitId: "u06", buyer: buyer("Sandra Peñaranda", "1.140.882.311"), price: 69_900_000, discount: 1_400_000, status: "accepted", version: 2, validUntil: day(4), advisorId: "m-andres", createdOn: day(-6) },
  { id: "q2", number: "COT-0002", unitId: "u14", buyer: buyer("Hernando Rueda", "72.188.904"), price: 82_500_000, discount: 1_500_000, status: "accepted", version: 1, validUntil: day(5), advisorId: "m-valentina", createdOn: day(-5) },
  { id: "q3", number: "COT-0003", unitId: "u02", buyer: buyer("Camilo Ariza", "1.047.221.508"), price: 71_500_000, discount: 3_200_000, status: "pending_approval", version: 1, validUntil: day(6), advisorId: "m-andres", createdOn: day(-1) },
  { id: "q4", number: "COT-0004", unitId: "u13", buyer: buyer("Paola Cantillo", "1.129.003.455"), price: 112_000_000, discount: 0, status: "issued", version: 1, validUntil: day(7), advisorId: "m-andres", createdOn: day(0) },
];

const reservations: Reservation[] = [
  { id: "r1", unitId: "u06", quoteId: "q1", buyer: quotes[0].buyer, advisorId: "m-andres", expiresOn: day(3), deposit: 1_000_000, status: "active" },
  { id: "r2", unitId: "u14", quoteId: "q2", buyer: quotes[1].buyer, advisorId: "m-valentina", expiresOn: day(5), deposit: 0, status: "active" },
];

/* ---------------- Publicaciones ---------------- */

const listings = units
  .filter((u) => u.status !== "sold" && u.status !== "delivered")
  .map((u, i) => ({
    id: `li-${u.id}`,
    unitId: u.id,
    status: (u.status === "in_preparation" ? "draft" : "published") as "draft" | "published",
    price: u.listPrice,
    views: u.status === "in_preparation" ? 0 : 40 + ((i * 53) % 260),
    featuredUntil: u.id === "u02" || u.id === "u13" ? day(9) : undefined,
  }));

/* ---------------- Libro y auditoría ---------------- */

/** Asientos históricos: permiten anular ventas y revertir consumos sembrados con su compensación real. */
function historyTxs(): LedgerTx[] {
  const txs: LedgerTx[] = [];
  let n = 0;
  for (const sale of sales) {
    if (sale.status === "annulled") continue;
    const unitCost = sum(costs.filter((c) => c.unitId === sale.unitId && c.status === "confirmed").map((c) => c.amount));
    txs.push({ id: `lh-${++n}`, on: sale.formalizedOn, sourceType: "sale", sourceId: sale.id, memo: `Venta ${sale.number}`, entries: [debit("receivable_customer", sale.netPrice), credit("sales_revenue", sale.netPrice)] });
    txs.push({ id: `lh-${++n}`, on: sale.formalizedOn, sourceType: "sale", sourceId: sale.id, memo: `Costo de ${sale.number}`, entries: [debit("cost_of_sales", unitCost), credit("inventory_vehicles", unitCost)] });
  }
  for (const wo of workOrders) {
    for (const l of wo.lines.filter((x) => x.status === "confirmed")) {
      const amount = Math.round(l.qty * l.unitCost);
      txs.push({ id: `lh-${++n}`, on: wo.createdOn, sourceType: "work_line", sourceId: l.id, memo: `${wo.number}: ${l.description}`, entries: [debit("inventory_vehicles", amount), credit(l.kind === "part" ? "inventory_parts" : "labor_absorbed", amount)] });
    }
  }
  return txs;
}

function openingLedger(): LedgerTx[] {
  const history = historyTxs();
  const stockValue = sum(deriveStock().map((s) => s.onHand * s.avgCost));
  const vehicleValue = sum(
    units
      .filter((u) => u.status !== "sold" && u.status !== "delivered")
      .map((u) => sum(costs.filter((c) => c.unitId === u.id && c.status === "confirmed").map((c) => c.amount))),
  );
  const loanPrincipal = sum([loan0, loan1, loan2].map((l) => sum(l.installments.map((i) => i.principal - i.paidPrincipal))));
  const receivable = loanPrincipal + 8_000_000 + 22_000_000 + (118_000_000 - 5_000_000 - 15_000_000 - 20_000_000);
  // Saldos objetivo de las cuentas de balance; las de resultados quedan con lo que dicta la historia.
  const target: Partial<Record<Account, number>> = {
    cash: 300_000 + 250_000 + 1_000_000 + 54_000 + 56_000,
    bank: 96_400_000,
    inventory_vehicles: vehicleValue,
    inventory_parts: stockValue,
    receivable_customer: receivable,
    payable_supplier: -sum(obligations.map((o) => o.outstanding)),
    refunds_payable: -15_000_000,
  };
  const historic = balances(history);
  const entries: LedgerEntry[] = [];
  for (const [account, wanted] of Object.entries(target) as [Account, number][]) {
    const delta = wanted - historic[account];
    if (delta > 0) entries.push(debit(account, delta));
    else if (delta < 0) entries.push(credit(account, -delta));
  }
  const net = sum(entries.map((e) => (e.side === "debit" ? e.amount : -e.amount)));
  if (net > 0) entries.push(credit("equity", net));
  else if (net < 0) entries.push(debit("equity", -net));
  return [{ id: "lx-0", on: day(-1), sourceType: "opening", sourceId: "apertura", memo: "Saldos de apertura del demo", entries }, ...history];
}

function seedAudit(): AuditEvent[] {
  const base = [
    ["Marcela Ospino", "admin", "Inició sesión", "sesión"],
    ["Carlos Mendoza", "tesoreria", "Cerró la caja de Sede Norte con faltante de $20.000", "caja cs-norte-prev"],
    ["Andrés Pacheco", "asesor", "Creó la cotización COT-0003 con descuento pendiente de aprobación", "cotización q3"],
    ["Valentina Cure", "asesor", "Solicitó la devolución rf1 por $15.000.000", "devolución rf1"],
    ["Daniela Barros", "cartera", "Registró gestión prejurídica de cobro", "crédito l0"],
  ] as const;
  let chain: AuditEvent[] = [];
  base.forEach(([actor, role, action, resource], i) => {
    chain = appendAudit(chain, { at: `${day(-2 + (i > 2 ? 1 : 0))}T0${8 + i}:15`, actor, role, action, resource });
  });
  return chain;
}

/** Datos ficticios iniciales. Se llama de nuevo para reiniciar el demo. */
export function createSeed(): DemoData {
  const data: DemoData = {
    units: structuredClone(units),
    costs: structuredClone(costs),
    listings: structuredClone(listings),
    leads: structuredClone(leads),
    appointments: structuredClone(appointments),
    quotes: structuredClone(quotes),
    reservations: structuredClone(reservations),
    sales: structuredClone(sales),
    applications: [
      { id: "ca-1", unitId: "u06", applicant: buyer("Sandra Peñaranda", "1.140.882.311"), monthlyIncome: 6_800_000, amount: 40_000_000, months: 48, eaPercent: 23, status: "pending", createdOn: day(-1) },
      { id: "ca-2", unitId: "u15", applicant: loan2.borrower, monthlyIncome: 9_200_000, amount: 36_000_000, months: 36, eaPercent: 22, status: "approved", decidedBy: "m-daniela", createdOn: day(-3), note: "Aprobado con codeudor." },
      { id: "ca-3", unitId: "u04", applicant: buyer("Fabián Torres", "1.002.554.810"), monthlyIncome: 2_100_000, amount: 30_000_000, months: 60, eaPercent: 24, status: "rejected", decidedBy: "m-daniela", createdOn: day(-10), note: "Relación cuota/ingreso superior al 40 %." },
    ],
    loans: structuredClone([loan0, loan1, loan2]),
    externalCases: [{ id: "x1", saleId: "v5", entity: "Bancolombia Libranza Vehículo", requested: 22_000_000, approvedAmount: 22_000_000, approvalRef: "BC-884213", status: "approved" }],
    layaways: [
      { id: "ly1", saleId: "v6", unitId: "u17", buyer: sales[5].buyer, total: 118_000_000, paid: 40_000_000, deadlineOn: day(60), status: "active" },
      { id: "ly2", saleId: "v7", unitId: "u09", buyer: sales[6].buyer, total: 44_900_000, paid: 15_000_000, deadlineOn: day(-5), status: "cancelled" },
    ],
    payments: structuredClone(payments),
    obligations: structuredClone(obligations),
    expenses: structuredClone(expenses),
    refunds: structuredClone(refunds),
    cashSessions: structuredClone(cashSessions),
    bankLines: structuredClone(bankLines),
    workOrders: structuredClone(workOrders),
    parts: structuredClone(parts),
    stock: deriveStock(),
    movements: structuredClone(movements),
    purchases: structuredClone(purchases),
    counterSales: structuredClone(counterSales),
    members: structuredClone(members),
    grants: defaultGrants(),
    subscription: { planId: "pro", addons: ["workshop", "parts_counter"] },
    ledger: openingLedger(),
    audit: seedAudit(),
    processedRefs: payments.filter((p) => p.status === "confirmed").map((p) => p.ref),
    counters: { quote: 4, sale: 7, reservation: 2, workorder: 5, counter: 3, id: 100 },
  };
  return data;
}

