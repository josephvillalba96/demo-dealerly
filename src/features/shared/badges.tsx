import { Badge, type Tone } from "@/components/ui/surface";
import { STATUS_LABELS } from "@/domain/inventory";
import { LISTING_LABELS } from "@/domain/listing";
import { METHOD_LABELS } from "@/domain/treasury";
import { WORK_LABELS } from "@/domain/workshop";
import type { ListingStatus, Payment, Sale, UnitStatus, WorkStatus } from "@/domain/types";

const UNIT_TONE: Record<UnitStatus, Tone> = {
  in_preparation: "warn",
  available: "ok",
  reserved: "brand",
  sold: "neutral",
  delivered: "neutral",
  withdrawn: "neutral",
};

export const UnitStatusBadge = ({ status }: { status: UnitStatus }) => <Badge tone={UNIT_TONE[status]}>{STATUS_LABELS[status]}</Badge>;

const LISTING_TONE: Record<ListingStatus, Tone> = { draft: "neutral", in_review: "warn", needs_fix: "bad", published: "ok", paused: "warn", withdrawn: "neutral" };
export const ListingBadge = ({ status }: { status: ListingStatus }) => <Badge tone={LISTING_TONE[status]}>{LISTING_LABELS[status]}</Badge>;

const PAY_LABEL = { pending: "Pendiente", confirmed: "Confirmado", failed: "Fallido", reversed: "Revertido" } as const;
const PAY_TONE: Record<Payment["status"], Tone> = { pending: "warn", confirmed: "ok", failed: "bad", reversed: "neutral" };
export const PaymentBadge = ({ status }: { status: Payment["status"] }) => <Badge tone={PAY_TONE[status]}>{PAY_LABEL[status]}</Badge>;

const SALE_LABEL: Record<Sale["status"], string> = { formalized: "Formalizada", delivered: "Entregada", annulled: "Anulada" };
const SALE_TONE: Record<Sale["status"], Tone> = { formalized: "brand", delivered: "ok", annulled: "neutral" };
export const SaleBadge = ({ status }: { status: Sale["status"] }) => <Badge tone={SALE_TONE[status]}>{SALE_LABEL[status]}</Badge>;

const WORK_TONE: Record<WorkStatus, Tone> = { received: "neutral", diagnosis: "warn", approved: "brand", in_progress: "brand", quality: "warn", done: "ok", cancelled: "neutral" };
export const WorkBadge = ({ status }: { status: WorkStatus }) => <Badge tone={WORK_TONE[status]}>{WORK_LABELS[status]}</Badge>;

export const methodLabel = (m: Payment["method"]): string => METHOD_LABELS[m];
