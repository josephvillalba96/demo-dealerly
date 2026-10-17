import { photoProgress } from "./inventory";
import type { ListingStatus, Unit } from "./types";

export const LISTING_LABELS: Record<ListingStatus, string> = {
  draft: "Borrador",
  in_review: "En revisión",
  needs_fix: "Requiere corrección",
  published: "Publicado",
  paused: "Pausado",
  withdrawn: "Retirado",
};

export type ListingAction = "submit" | "approve" | "request_fix" | "pause" | "resume" | "withdraw";

const TRANSITIONS: Record<ListingStatus, Partial<Record<ListingAction, ListingStatus>>> = {
  draft: { submit: "in_review" },
  needs_fix: { submit: "in_review" },
  in_review: { approve: "published", request_fix: "needs_fix" },
  published: { pause: "paused", withdraw: "withdrawn" },
  paused: { resume: "published", withdraw: "withdrawn" },
  withdrawn: {},
};

export function nextListingStatus(from: ListingStatus, action: ListingAction): ListingStatus | null {
  return TRANSITIONS[from][action] ?? null;
}

export function availableActions(from: ListingStatus): ListingAction[] {
  return Object.keys(TRANSITIONS[from]) as ListingAction[];
}

/** Requisitos para enviar a revisión. Lista vacía significa que puede enviarse (FR-VEH-05). */
export function publishBlockers(unit: Unit): string[] {
  const blockers: string[] = [];
  const photos = photoProgress(unit);
  if (photos.done < photos.total) blockers.push(`Faltan ${photos.total - photos.done} fotos de la plantilla`);
  if (unit.condition.trim().length < 10) blockers.push("Falta describir la condición del vehículo");
  for (const doc of unit.docs) {
    if (doc.status === "missing") blockers.push(`Falta el documento: ${doc.type}`);
    if (doc.status === "expired") blockers.push(`Documento vencido: ${doc.type}`);
  }
  if (!unit.sellerVerified) blockers.push("El vendedor aún no está validado");
  return blockers;
}
