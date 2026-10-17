import type { LoanInstallment } from "./credit";
import type { Grants } from "./rbac";
import type { IsoDate } from "./dates";
import type { LedgerTx } from "./ledger";
import type { Cop } from "./money";

export type Id = string;
export type Role = "admin" | "asesor" | "tesoreria" | "cartera" | "taller";
export type BranchId = "norte" | "centro";

/* ---------------- Inventario ---------------- */

export type VehicleKind = "car" | "motorcycle";
export type UnitStatus = "in_preparation" | "available" | "reserved" | "sold" | "delivered" | "withdrawn";
export type DocType = "soat" | "rtm" | "property_card";
export type DocStatus = "missing" | "uploaded" | "reviewed" | "expired";

export interface PhotoSlot {
  code: string;
  label: string;
  done: boolean;
}

export interface VehicleDoc {
  type: DocType;
  status: DocStatus;
  validUntil?: IsoDate;
}

export interface Inspection {
  inspector: string;
  org: string;
  date: IsoDate;
  scope: string;
  result: "approved" | "with_observations";
  validUntil: IsoDate;
  status: "active" | "revoked" | "expired";
}

export interface Unit {
  id: Id;
  kind: VehicleKind;
  make: string;
  model: string;
  trim: string;
  year: number;
  km: number;
  vin: string;
  plate: string;
  color: string;
  city: string;
  branchId: BranchId;
  status: UnitStatus;
  listPrice: Cop;
  ownership: "owned" | "consigned";
  acquiredOn: IsoDate;
  condition: string;
  photos: PhotoSlot[];
  docs: VehicleDoc[];
  inspection?: Inspection;
  sellerVerified: boolean;
}

export interface UnitCost {
  id: Id;
  unitId: Id;
  concept: string;
  source: "acquisition" | "transport" | "work_order" | "other";
  amount: Cop;
  status: "confirmed" | "pending";
  date: IsoDate;
  sourceId?: Id;
}

/* ---------------- Publicaciones y CRM ---------------- */

export type ListingStatus = "draft" | "in_review" | "needs_fix" | "published" | "paused" | "withdrawn";

export interface Listing {
  id: Id;
  unitId: Id;
  status: ListingStatus;
  price: Cop;
  views: number;
  featuredUntil?: IsoDate;
  note?: string;
}

export type LeadStatus = "new" | "contacted" | "appointment" | "quoted" | "won" | "lost";

export interface Lead {
  id: Id;
  unitId: Id;
  name: string;
  phone: string;
  channel: "marketplace" | "whatsapp" | "visit" | "phone";
  status: LeadStatus;
  assigneeId: Id | null;
  createdOn: IsoDate;
  note?: string;
}

export type AppointmentStatus = "requested" | "confirmed" | "rescheduled" | "cancelled" | "attended" | "no_show";

export interface Appointment {
  id: Id;
  leadId: Id;
  unitId: Id;
  kind: "visit" | "test_drive";
  slot: string; // YYYY-MM-DDTHH:mm
  status: AppointmentStatus;
  responsibleId: Id;
}

/* ---------------- Ventas ---------------- */

export type Modality = "cash" | "own_credit" | "external" | "layaway";

export interface Buyer {
  name: string;
  doc: string;
  phone?: string;
}

export type QuoteStatus = "draft" | "pending_approval" | "issued" | "accepted" | "rejected" | "expired";

export interface Quote {
  id: Id;
  number: string;
  unitId: Id;
  buyer: Buyer;
  price: Cop;
  discount: Cop;
  status: QuoteStatus;
  version: number;
  validUntil: IsoDate;
  advisorId: Id;
  createdOn: IsoDate;
}

export interface Reservation {
  id: Id;
  unitId: Id;
  quoteId?: Id;
  buyer: Buyer;
  advisorId: Id;
  expiresOn: IsoDate;
  deposit: Cop;
  status: "active" | "converted" | "expired" | "cancelled";
}

export type InvoiceState = "none" | "internal" | "fiscal_pending" | "fiscal_ok";

export interface Sale {
  id: Id;
  number: string;
  unitId: Id;
  buyer: Buyer;
  modality: Modality;
  netPrice: Cop;
  downPayment: Cop;
  status: "formalized" | "delivered" | "annulled";
  invoice: InvoiceState;
  loanId?: Id;
  caseId?: Id;
  layawayId?: Id;
  formalizedOn: IsoDate;
  advisorId: Id;
  deliveredOn?: IsoDate;
  delivery?: { receiver: string; exceptionReason?: string };
  annulReason?: string;
}

/* ---------------- Crédito ---------------- */

export interface CreditApplication {
  id: Id;
  unitId: Id;
  applicant: Buyer;
  monthlyIncome: Cop;
  amount: Cop;
  months: number;
  eaPercent: number;
  status: "pending" | "approved" | "rejected";
  decidedBy?: Id;
  note?: string;
  createdOn: IsoDate;
}

export interface Loan {
  id: Id;
  saleId: Id;
  borrower: Buyer;
  principal: Cop;
  downPayment: Cop;
  eaPercent: number;
  months: number;
  engineVersion: string;
  installments: LoanInstallment[];
  status: "active" | "paid_off" | "cancelled";
  collection: CollectionAction[];
}

export interface CollectionAction {
  id: Id;
  on: IsoDate;
  channel: "call" | "whatsapp" | "letter";
  stage: "preventive" | "pre_legal" | "legal";
  note: string;
  delivered?: boolean;
}

export interface ExternalCase {
  id: Id;
  saleId: Id;
  entity: string;
  requested: Cop;
  approvedAmount?: Cop;
  approvalRef?: string;
  status: "requested" | "approved" | "rejected" | "disbursed";
  disbursedPaymentId?: Id;
}

export interface Layaway {
  id: Id;
  saleId: Id;
  unitId: Id;
  buyer: Buyer;
  total: Cop;
  paid: Cop;
  deadlineOn: IsoDate;
  status: "active" | "completed" | "cancelled";
}

/* ---------------- Tesorería ---------------- */

export type PayMethod = "cash" | "transfer" | "pse" | "card" | "nequi";
export type PayTarget = "sale" | "installment" | "layaway" | "reservation" | "supplier" | "counter_sale" | "expense" | "refund" | "external";

export interface Payment {
  id: Id;
  direction: "in" | "out";
  amount: Cop;
  method: PayMethod;
  status: "pending" | "confirmed" | "failed" | "reversed";
  ref: string;
  counterparty: string;
  concept: string;
  targetType: PayTarget;
  targetId: Id;
  branchId: BranchId;
  on: IsoDate;
  sessionId?: Id;
  allocations?: { label: string; amount: Cop }[];
  /** Liquidación anticipada: al confirmarse cierra el préstamo sin cobrar intereses futuros. */
  settlesLoan?: boolean;
}

export interface SupplierObligation {
  id: Id;
  supplier: string;
  docRef: string;
  concept: string;
  amount: Cop;
  outstanding: Cop;
  dueOn: IsoDate;
  origin: "vehicle" | "parts" | "other";
}

export interface Expense {
  id: Id;
  concept: string;
  amount: Cop;
  method: "cash" | "transfer";
  status: "pending" | "confirmed";
  branchId: BranchId;
  on: IsoDate;
  sessionId?: Id;
}

export interface Refund {
  id: Id;
  saleId?: Id;
  layawayId?: Id;
  buyer: string;
  amount: Cop;
  reason: string;
  status: "requested" | "approved" | "sent" | "confirmed" | "failed";
  requestedBy: Id;
  on: IsoDate;
}

export interface CashSession {
  id: Id;
  branchId: BranchId;
  openedOn: IsoDate;
  openingBase: Cop;
  status: "open" | "closed";
  counted?: Cop;
  expected?: Cop;
  difference?: Cop;
  withdrawal?: Cop;
  nextBase?: Cop;
  closedBy?: Id;
}

export interface BankLine {
  id: Id;
  on: IsoDate;
  description: string;
  gross: Cop;
  fee: Cop;
  matchedPaymentId?: Id;
}

/* ---------------- Taller y repuestos ---------------- */

export type WorkStatus = "received" | "diagnosis" | "approved" | "in_progress" | "quality" | "done" | "cancelled";

export interface WorkLine {
  id: Id;
  kind: "labor" | "part";
  description: string;
  partId?: Id;
  qty: number;
  unitCost: Cop;
  status: "pending" | "confirmed" | "reversed";
}

export interface WorkOrder {
  id: Id;
  number: string;
  unitId: Id;
  branchId: BranchId;
  bay: string;
  technicianId: Id;
  status: WorkStatus;
  budget: Cop;
  description: string;
  lines: WorkLine[];
  createdOn: IsoDate;
}

export interface Part {
  id: Id;
  ref: string;
  oem: string;
  description: string;
  compat: string;
  kind: VehicleKind | "both";
  salePrice: Cop;
}

export interface StockLevel {
  partId: Id;
  branchId: BranchId;
  onHand: number;
  avgCost: Cop;
}

export type MovementType = "purchase_in" | "work_order_out" | "counter_sale_out" | "adjustment" | "loss" | "reversal";

export interface StockMovement {
  id: Id;
  partId: Id;
  branchId: BranchId;
  type: MovementType;
  qty: number; // positivo entra, negativo sale
  unitCost: Cop;
  sourceId: string;
  on: IsoDate;
}

export interface PurchaseInvoice {
  id: Id;
  supplier: string;
  number: string;
  branchId: BranchId;
  on: IsoDate;
  terms: "cash" | "credit";
  lines: { partId: Id; qty: number; unitCost: Cop }[];
  obligationId?: Id;
}

export interface CounterSale {
  id: Id;
  number: string;
  customer: string;
  branchId: BranchId;
  on: IsoDate;
  lines: { partId: Id; qty: number; unitPrice: Cop; unitCost: Cop }[];
  paymentId?: Id;
  status: "confirmed" | "annulled";
}

/* ---------------- Administración ---------------- */

export interface Member {
  id: Id;
  name: string;
  email: string;
  role: Role;
  branchIds: BranchId[];
  status: "active" | "revoked" | "invited";
}

export type ModuleId = "own_credit" | "layaway" | "external_financing" | "workshop" | "parts_counter" | "advanced_reports";

export interface Subscription {
  planId: PlanId;
  addons: ModuleId[];
}

export type PlanId = "basico" | "pro" | "grupo";

export interface AuditEvent {
  seq: number;
  at: string;
  actor: string;
  role: Role;
  action: string;
  resource: string;
  prevHash: string;
  hash: string;
}

export interface Notice {
  id: Id;
  title: string;
  detail: string;
  href: string;
  tone: "warn" | "bad" | "info";
}

export interface DemoData {
  units: Unit[];
  costs: UnitCost[];
  listings: Listing[];
  leads: Lead[];
  appointments: Appointment[];
  quotes: Quote[];
  reservations: Reservation[];
  sales: Sale[];
  applications: CreditApplication[];
  loans: Loan[];
  externalCases: ExternalCase[];
  layaways: Layaway[];
  payments: Payment[];
  obligations: SupplierObligation[];
  expenses: Expense[];
  refunds: Refund[];
  cashSessions: CashSession[];
  bankLines: BankLine[];
  workOrders: WorkOrder[];
  parts: Part[];
  stock: StockLevel[];
  movements: StockMovement[];
  purchases: PurchaseInvoice[];
  counterSales: CounterSale[];
  members: Member[];
  /** Permisos por rol; el administrador puede editarlos desde Equipo. */
  grants: Grants;
  subscription: Subscription;
  ledger: LedgerTx[];
  audit: AuditEvent[];
  /** Referencias de pago ya procesadas (idempotencia por referencia externa). */
  processedRefs: string[];
  counters: Record<string, number>;
}
