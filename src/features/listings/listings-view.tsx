"use client";

import { Eye, Sparkle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Select, Field } from "@/components/ui/form";
import { Badge, Card, CardHeader, Notice, PageIntro } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { DEMO_TODAY, formatDate } from "@/domain/dates";
import { PLANS } from "@/domain/entitlements";
import { DOC_LABELS } from "@/domain/inventory";
import { LISTING_LABELS, publishBlockers, type ListingAction } from "@/domain/listing";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { Listing, Unit } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { formatKm } from "@/lib/format";
import { useDemo } from "@/store";
import { featureListing, listingAction } from "@/store/commands/inventory";
import { unitById } from "@/store/queries";
import { ListingBadge } from "../shared/badges";
import { UnitCell } from "../shared/unit-link";

function PublicPreview({ unit, listing }: { unit: Unit; listing: Listing }) {
  const ins = unit.inspection;
  return (
    <div className="space-y-4">
      <Notice tone="brand">Esto es exactamente lo que verá el comprador. No aparecen el VIN completo, el costo, el propietario anterior ni los documentos originales.</Notice>
      <div className="rounded-card border border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">{unit.make} {unit.model} {unit.trim}</h3>
            <p className="num text-sm text-muted">{unit.year}, {formatKm(unit.km)} declarados, {unit.city}</p>
          </div>
          <div className="text-right">
            <p className="num text-xl font-bold text-ink">{formatCop(listing.price)}</p>
            {listing.featuredUntil && listing.featuredUntil >= DEMO_TODAY && <Badge tone="brand">Publicidad pagada</Badge>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="neutral">Vendedor: Autos del Caribe</Badge>
          <Badge tone="neutral">{BRANCH_NAMES[unit.branchId]}</Badge>
          {ins ? <Badge tone="ok">Inspeccionado por {ins.org}</Badge> : <Badge tone="warn">Sin inspección independiente</Badge>}
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">Condición declarada por el vendedor</p>
          <p className="mt-1 text-sm text-ink-soft">{unit.condition || "Aún sin describir."}</p>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">Documentos (solo estado)</p>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {unit.docs.map((d) => <li key={d.type}><Badge tone={d.status === "reviewed" ? "ok" : "warn"}>{DOC_LABELS[d.type]}: {d.status === "reviewed" ? "revisado" : "pendiente"}</Badge></li>)}
          </ul>
        </div>
        <p className="mt-4 text-[13px] text-muted">{unit.photos.filter((p) => p.done).length} fotos públicas, sin ubicación y con placa difuminada.</p>
      </div>
    </div>
  );
}

export function ListingsView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [preview, setPreview] = useState<Listing | null>(null);
  const [featuring, setFeaturing] = useState<Listing | null>(null);
  const [days, setDays] = useState(7);
  const canWrite = can(role, "listing.write");

  const published = data.listings.filter((l) => l.status === "published").length;
  const limit = PLANS[data.subscription.planId].limits.activeListings;
  const leadsByUnit = useMemo(() => {
    const m = new Map<string, number>();
    data.leads.forEach((l) => m.set(l.unitId, (m.get(l.unitId) ?? 0) + 1));
    return m;
  }, [data.leads]);

  const act = (listing: Listing, action: ListingAction) => run(listingAction, { listingId: listing.id, action });

  const columns: Column<Listing>[] = [
    { header: "Vehículo", cell: (l) => <UnitCell unit={unitById(data, l.unitId)} /> },
    { header: "Estado", cell: (l) => <ListingBadge status={l.status} /> },
    { header: "Precio", align: "right", cell: (l) => <span className="font-medium text-ink">{formatCop(l.price)}</span> },
    { header: "Vistas", align: "right", cell: (l) => l.views, hideBelow: "lg" },
    { header: "Interesados", align: "right", cell: (l) => leadsByUnit.get(l.unitId) ?? 0, hideBelow: "lg" },
    { header: "Destacado", cell: (l) => (l.featuredUntil && l.featuredUntil >= DEMO_TODAY ? <Badge tone="brand">Hasta {formatDate(l.featuredUntil)}</Badge> : <span className="text-muted">No</span>), hideBelow: "md" },
    {
      header: "Acciones",
      align: "right",
      cell: (l) => {
        const unit = unitById(data, l.unitId);
        const blockers = unit ? publishBlockers(unit).length : 0;
        return (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" icon={<Eye size={15} />} onClick={() => setPreview(l)}>Vista pública</Button>
            {canWrite && (l.status === "draft" || l.status === "needs_fix") && <Button size="sm" disabled={blockers > 0} title={blockers > 0 ? `${blockers} requisitos pendientes` : undefined} onClick={() => act(l, "submit")}>Enviar a revisión</Button>}
            {canWrite && l.status === "in_review" && <Button size="sm" variant="secondary" onClick={() => act(l, "approve")}>Simular aprobación (demo)</Button>}
            {canWrite && l.status === "published" && (
              <>
                <Button size="sm" variant="secondary" icon={<Sparkle size={15} />} onClick={() => setFeaturing(l)}>Destacar</Button>
                <Button size="sm" variant="ghost" onClick={() => act(l, "pause")}>Pausar</Button>
                <Button size="sm" variant="ghost" onClick={() => act(l, "withdraw")}>Retirar</Button>
              </>
            )}
            {canWrite && l.status === "paused" && <Button size="sm" variant="secondary" onClick={() => act(l, "resume")}>Reanudar</Button>}
          </div>
        );
      },
    },
  ];

  const previewUnit = preview ? unitById(data, preview.unitId) : undefined;
  return (
    <>
      <PageIntro>Solo se publica una versión aprobada y autorizada del vehículo. Lo privado (costos, propietario, documentos originales) nunca sale en la ficha pública.</PageIntro>
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-ink-soft">Anuncios activos en tu plan {PLANS[data.subscription.planId].name}</span>
          <span className="num font-semibold text-ink">{published} de {limit}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-surface" role="progressbar" aria-valuenow={published} aria-valuemax={limit} aria-label="Anuncios activos frente al límite del plan">
          <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, (published / limit) * 100)}%` }} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Anuncios" description={`${LISTING_LABELS.draft}s, en revisión, publicados y pausados.`} />
        <DataTable caption="Anuncios" columns={columns} rows={data.listings.filter((l) => l.status !== "withdrawn")} rowKey={(l) => l.id} empty={{ title: "Sin anuncios" }} />
      </Card>

      <Dialog open={Boolean(preview)} onOpenChange={(o) => !o && setPreview(null)} title="Vista previa pública" description="Lo que ve el comprador en el marketplace." width="md">
        {preview && previewUnit && <PublicPreview unit={previewUnit} listing={preview} />}
      </Dialog>

      <Dialog
        open={Boolean(featuring)}
        onOpenChange={(o) => !o && setFeaturing(null)}
        title="Destacar anuncio"
        description="Es publicidad pagada a la plataforma: se distingue del sello de inspección y del orden normal."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFeaturing(null)}>Cancelar</Button>
            <Button onClick={() => { if (!featuring) return; const r = run(featureListing, { listingId: featuring.id, days }); if (r.ok) setFeaturing(null); }}>Pagar y destacar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Duración">{(id) => <Select id={id} value={days} onChange={(e) => setDays(Number(e.target.value))}>{[3, 7, 15].map((d) => <option key={d} value={d}>{d} días, {formatCop(d * 12_000)}</option>)}</Select>}</Field>
          <Notice tone="neutral">Este cobro es de la plataforma y no toca la caja de tu concesionario. El beneficio se activa solo con el pago confirmado y un pago repetido no duplica la duración.</Notice>
        </div>
      </Dialog>
    </>
  );
}
