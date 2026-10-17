import { photoTemplate } from "@/domain/inventory";
import { credit, debit } from "@/domain/ledger";
import { checkLimit } from "@/domain/entitlements";
import { availableActions, nextListingStatus, publishBlockers, type ListingAction } from "@/domain/listing";
import { formatCop, type Cop } from "@/domain/money";
import type { BranchId, DocStatus, DocType, VehicleKind } from "@/domain/types";
import { addDays } from "@/domain/dates";
import { audit, denied, done, fail, postTx, serial, uid, type Command } from "../engine";
import { unitById, unitLabel, usage } from "../queries";

export interface CreateUnitArgs {
  kind: VehicleKind;
  make: string;
  model: string;
  trim: string;
  year: number;
  km: number;
  plate: string;
  vin: string;
  color: string;
  branchId: BranchId;
  listPrice: Cop;
  acquisitionCost: Cop;
  supplier: string;
}

/** Alta de una unidad individual (FR-VEH-01) con su compra y obligación con el proveedor (FR-FIN-01). */
export const createUnit: Command<CreateUnitArgs, string> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  if (!a.make.trim() || !a.model.trim()) return fail("Escribe marca y línea del vehículo.");
  if (a.listPrice <= 0 || a.acquisitionCost <= 0) return fail("El precio de lista y el costo de compra deben ser mayores que cero.");
  const vin = a.vin.trim().toUpperCase();
  if (vin.length < 8) return fail("El VIN o número de chasis debe tener al menos 8 caracteres.");
  const duplicate = d.units.find((u) => u.vin === vin && u.status !== "delivered" && u.status !== "withdrawn");
  if (duplicate) return fail(`Ya existe una unidad activa con ese VIN: ${unitLabel(duplicate)}.`);
  const id = uid(d, "u");
  d.units.push({
    id,
    kind: a.kind,
    make: a.make.trim(),
    model: a.model.trim(),
    trim: a.trim.trim(),
    year: a.year,
    km: a.km,
    vin,
    plate: a.plate.trim().toUpperCase(),
    color: a.color.trim(),
    city: "Barranquilla",
    branchId: a.branchId,
    status: "in_preparation",
    listPrice: a.listPrice,
    ownership: "owned",
    acquiredOn: ctx.today,
    condition: "",
    photos: photoTemplate(a.kind),
    docs: (["soat", "rtm", "property_card"] as DocType[]).map((type) => ({ type, status: "missing" as DocStatus })),
    sellerVerified: false,
  });
  d.costs.push({ id: uid(d, "c"), unitId: id, concept: "Compra del vehículo", source: "acquisition", amount: a.acquisitionCost, status: "confirmed", date: ctx.today });
  const obligationId = uid(d, "o");
  d.obligations.push({
    id: obligationId,
    supplier: a.supplier.trim() || "Proveedor sin nombre",
    docRef: serial(d, "obligation", "OB"),
    concept: `Compra ${a.make} ${a.model} ${a.year}`,
    amount: a.acquisitionCost,
    outstanding: a.acquisitionCost,
    dueOn: addDays(ctx.today, 15),
    origin: "vehicle",
  });
  postTx(d, ctx, "acquisition", id, `Compra ${a.make} ${a.model}`, [debit("inventory_vehicles", a.acquisitionCost), credit("payable_supplier", a.acquisitionCost)]);
  d.listings.push({ id: uid(d, "li"), unitId: id, status: "draft", price: a.listPrice, views: 0 });
  audit(d, ctx, `Registró la unidad ${a.make} ${a.model} ${a.year} (compra ${formatCop(a.acquisitionCost)})`, `unidad ${id}`);
  return done(`Unidad registrada. Completa fotos y documentos para publicarla.`, id);
};

export const capturePhoto: Command<{ unitId: string; code: string }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  const slot = unit?.photos.find((p) => p.code === a.code);
  if (!unit || !slot) return fail("No se encontró la toma.");
  slot.done = !slot.done;
  audit(d, ctx, `${slot.done ? "Cargó" : "Quitó"} la foto "${slot.label}"`, `unidad ${unit.id}`);
  return done();
};

export const captureAllPhotos: Command<{ unitId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  unit.photos.forEach((p) => (p.done = true));
  audit(d, ctx, "Completó la plantilla fotográfica", `unidad ${unit.id}`);
  return done("Plantilla fotográfica completa.");
};

export const setCondition: Command<{ unitId: string; text: string }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  unit.condition = a.text;
  return done();
};

export const setDocument: Command<{ unitId: string; type: DocType; status: DocStatus }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  const doc = unit?.docs.find((x) => x.type === a.type);
  if (!unit || !doc) return fail("Documento no encontrado.");
  doc.status = a.status;
  doc.validUntil = a.status === "reviewed" && a.type !== "property_card" ? addDays(ctx.today, 180) : doc.validUntil;
  audit(d, ctx, `Marcó ${a.type} como ${a.status}`, `unidad ${unit.id}`);
  return done();
};

/** Simula la validación del vendedor que haría la plataforma (FR-SLR-01). */
export const verifySeller: Command<{ unitId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  unit.sellerVerified = true;
  audit(d, ctx, "Validó la titularidad del vendedor", `unidad ${unit.id}`);
  return done("Vendedor validado.");
};

export const addCost: Command<{ unitId: string; concept: string; amount: Cop; supported: boolean }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const unit = unitById(d, a.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  if (a.amount <= 0 || !a.concept.trim()) return fail("Escribe el concepto y un importe mayor que cero.");
  d.costs.push({ id: uid(d, "c"), unitId: unit.id, concept: a.concept.trim(), source: "other", amount: a.amount, status: a.supported ? "confirmed" : "pending", date: ctx.today });
  if (a.supported) postTx(d, ctx, "cost", unit.id, a.concept, [debit("inventory_vehicles", a.amount), credit("bank", a.amount)]);
  audit(d, ctx, `Registró costo ${formatCop(a.amount)} (${a.supported ? "con soporte" : "pendiente de soporte"})`, `unidad ${unit.id}`);
  return done(a.supported ? "Costo confirmado y sumado a la unidad." : "Costo registrado como pendiente: no suma al margen hasta que tenga soporte.");
};

export const confirmCost: Command<{ costId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "inventory.write");
  if (no) return no;
  const cost = d.costs.find((c) => c.id === a.costId);
  if (!cost || cost.status !== "pending") return fail("El costo no está pendiente.");
  cost.status = "confirmed";
  postTx(d, ctx, "cost", cost.unitId, cost.concept, [debit("inventory_vehicles", cost.amount), credit("bank", cost.amount)]);
  audit(d, ctx, `Confirmó con soporte el costo "${cost.concept}"`, `unidad ${cost.unitId}`);
  return done("Costo confirmado.");
};

/* ---------------- Publicaciones ---------------- */

export const listingAction: Command<{ listingId: string; action: ListingAction }> = (d, ctx, a) => {
  const no = denied(ctx, "listing.write");
  if (no) return no;
  const listing = d.listings.find((l) => l.id === a.listingId);
  if (!listing) return fail("Anuncio no encontrado.");
  const unit = unitById(d, listing.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  const next = nextListingStatus(listing.status, a.action);
  if (!next) return fail(`No se puede ejecutar esa acción desde "${listing.status}". Disponibles: ${availableActions(listing.status).join(", ") || "ninguna"}.`);
  if (a.action === "submit") {
    const blockers = publishBlockers(unit);
    if (blockers.length) return fail(`No se puede enviar a revisión: ${blockers.join("; ")}.`);
  }
  if (next === "published") {
    const ent = checkLimit(d.subscription, "activeListings", usage(d, ctx.today).activeListings);
    if (!ent.ok) return fail(ent.message);
    listing.price = unit.listPrice;
  }
  listing.status = next;
  audit(d, ctx, `Anuncio ${unitLabel(unit)}: ${a.action}`, `anuncio ${listing.id}`);
  return done(next === "published" ? "Anuncio publicado en el marketplace." : "Estado del anuncio actualizado.");
};

/** El cobro del destacado es de la plataforma y no toca la caja del concesionario (CON-02). */
export const featureListing: Command<{ listingId: string; days: number }> = (d, ctx, a) => {
  const no = denied(ctx, "listing.write");
  if (no) return no;
  const listing = d.listings.find((l) => l.id === a.listingId);
  if (!listing || listing.status !== "published") return fail("Solo se pueden destacar anuncios publicados.");
  const price = a.days * 12_000;
  const start = listing.featuredUntil && listing.featuredUntil > ctx.today ? listing.featuredUntil : ctx.today;
  listing.featuredUntil = addDays(start, a.days);
  audit(d, ctx, `Destacó el anuncio ${a.days} días (cobro de plataforma ${formatCop(price)})`, `anuncio ${listing.id}`);
  return done(`Destacado activo hasta ${listing.featuredUntil}. Cobro de la plataforma ${formatCop(price)}: no afecta la caja del concesionario.`);
};
