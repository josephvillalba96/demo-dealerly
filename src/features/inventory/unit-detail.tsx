"use client";

import { ArrowLeft, Receipt, Wrench } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/tabs";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { BRANCH_NAMES } from "@/data/seed";
import { formatKm } from "@/lib/format";
import { useDemo } from "@/store";
import { listingOfUnit } from "@/store/queries";
import { ListingBadge, UnitStatusBadge } from "../shared/badges";
import { UnitMark } from "../shared/unit-chip";
import { UnitCosts } from "./unit-costs";
import { UnitDocs } from "./unit-docs";
import { UnitHistory } from "./unit-history";
import { UnitOverview } from "./unit-overview";
import { UnitPhotos } from "./unit-photos";

export function UnitDetail({ unitId }: { unitId: string }) {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const unit = data.units.find((u) => u.id === unitId);

  if (!unit) {
    return (
      <Card>
        <EmptyState
          title="No encontramos esa unidad"
          description="Pudo ser un enlace de otro demo. Vuelve al inventario."
          action={
            <Link href="/inventario">
              <Button variant="secondary">Volver al inventario</Button>
            </Link>
          }
        />
      </Card>
    );
  }

  const listing = listingOfUnit(data, unit.id);
  const photosDone = unit.photos.filter((p) => p.done).length;
  const sellable = unit.status === "available" || unit.status === "reserved";

  return (
    <div className="space-y-6">
      <Link href="/inventario" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft size={14} /> Inventario
      </Link>

      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-5">
          <UnitMark unit={unit} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-ink">
                {unit.make} {unit.model} {unit.trim}
              </h2>
              <UnitStatusBadge status={unit.status} />
              {listing && <ListingBadge status={listing.status} />}
            </div>
            <p className="num mt-1.5 text-sm text-muted">
              {unit.year}, {formatKm(unit.km)} declarados, placa {unit.plate}, {BRANCH_NAMES[unit.branchId]}
            </p>
            <p className="num mt-1 text-[13px] text-muted">VIN {unit.vin}</p>
          </div>
          <div className="text-right">
            <p className="text-[13px] text-muted">Precio de lista</p>
            <p className="num text-[28px] leading-tight font-bold tracking-tight text-ink">{formatCop(unit.listPrice)}</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {can(role, "quote.write") && sellable && (
                <Link href={`/ventas?cotizar=${unit.id}`}>
                  <Button size="sm" icon={<Receipt size={15} />}>
                    Cotizar
                  </Button>
                </Link>
              )}
              {can(role, "workshop.write") && unit.status !== "sold" && unit.status !== "delivered" && (
                <Link href={`/taller?nueva=${unit.id}`}>
                  <Button size="sm" variant="secondary" icon={<Wrench size={15} />}>
                    Orden de taller
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Tabs
        tabs={[
          { value: "resumen", label: "Resumen", content: <UnitOverview unit={unit} /> },
          { value: "costos", label: "Costos y margen", content: <UnitCosts unit={unit} /> },
          { value: "fotos", label: "Fotos guiadas", count: photosDone, content: <UnitPhotos unit={unit} /> },
          { value: "documentos", label: "Documentos e inspección", content: <UnitDocs unit={unit} /> },
          { value: "historial", label: "Historial", content: <UnitHistory unit={unit} /> },
        ]}
      />
    </div>
  );
}
