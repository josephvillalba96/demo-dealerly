"use client";

import { SealCheck } from "@phosphor-icons/react";
import { Select } from "@/components/ui/form";
import { Badge, Card, CardHeader, Notice, type Tone } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { formatDate } from "@/domain/dates";
import { DOC_LABELS } from "@/domain/inventory";
import { can } from "@/domain/rbac";
import type { DocStatus, Unit, VehicleDoc } from "@/domain/types";
import { useDemo } from "@/store";
import { setDocument } from "@/store/commands/inventory";

const STATUS: Record<DocStatus, { label: string; tone: Tone }> = {
  missing: { label: "Falta", tone: "bad" },
  uploaded: { label: "Cargado", tone: "warn" },
  reviewed: { label: "Revisado", tone: "ok" },
  expired: { label: "Vencido", tone: "bad" },
};

export function UnitDocs({ unit }: { unit: Unit }) {
  const run = useDemo((s) => s.run);
  const role = useDemo((s) => s.session.role);
  const canEdit = can(role, "inventory.write");

  const columns: Column<VehicleDoc>[] = [
    { header: "Documento", cell: (d) => <span className="font-medium text-ink">{DOC_LABELS[d.type]}</span> },
    { header: "Estado", cell: (d) => <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge> },
    { header: "Vigencia", cell: (d) => (d.validUntil ? formatDate(d.validUntil) : "No aplica"), hideBelow: "md" },
    {
      header: "Cambiar estado",
      align: "right",
      cell: (d) =>
        canEdit ? (
          <Select aria-label={`Estado de ${DOC_LABELS[d.type]}`} value={d.status} onChange={(e) => run(setDocument, { unitId: unit.id, type: d.type, status: e.target.value as DocStatus })} className="ml-auto h-8 w-36 text-[13px]">
            {(Object.keys(STATUS) as DocStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </Select>
        ) : null,
    },
  ];

  const ins = unit.inspection;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Documentos privados" description="Nadie los descarga adivinando un enlace: cada descarga exige permiso y queda auditada." />
        <DataTable caption="Documentos de la unidad" columns={columns} rows={unit.docs} rowKey={(d) => d.type} />
      </Card>
      <Notice tone="warn" title="Cargado no es verificado">
        Subir un PDF no marca el documento como verificado. Eso solo ocurre con una fuente autorizada o una revisión de tu equipo.
      </Notice>
      <Card>
        <CardHeader title="Inspección independiente" description="El comprador ve quién inspeccionó y qué cubrió. Pertenecer al concesionario no basta para obtener el sello." />
        {ins ? (
          <div className="flex flex-wrap items-start gap-4 p-5">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ok-bg text-ok">
              <SealCheck size={28} weight="fill" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink">{ins.org}</p>
              <p className="mt-0.5 text-sm text-muted">
                {ins.inspector}, {formatDate(ins.date)}
              </p>
              <p className="mt-2 text-sm text-ink-soft">Alcance: {ins.scope}.</p>
            </div>
            <div className="text-right">
              <Badge tone="ok">{ins.result === "approved" ? "Aprobada" : "Con observaciones"}</Badge>
              <p className="mt-1.5 text-[13px] text-muted">Vigente hasta {formatDate(ins.validUntil)}</p>
            </div>
          </div>
        ) : (
          <div className="p-5 text-sm text-muted">Esta unidad no tiene inspección. Puedes publicarla sin sello; el anuncio dirá que no fue inspeccionada.</div>
        )}
      </Card>
    </div>
  );
}
