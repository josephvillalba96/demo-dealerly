"use client";

import { Camera, CheckCircle, ImageSquare } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, Notice } from "@/components/ui/surface";
import { photoProgress } from "@/domain/inventory";
import { can } from "@/domain/rbac";
import type { Unit } from "@/domain/types";
import { cn } from "@/lib/cn";
import { useDemo } from "@/store";
import { captureAllPhotos, capturePhoto } from "@/store/commands/inventory";

export function UnitPhotos({ unit }: { unit: Unit }) {
  const run = useDemo((s) => s.run);
  const role = useDemo((s) => s.session.role);
  const { done, total } = photoProgress(unit);
  const canEdit = can(role, "inventory.write");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title={unit.kind === "car" ? "Plantilla fotográfica de carro" : "Plantilla fotográfica de moto"}
          description="Una toma por posición, con silueta guía. Una toma fallida no cuenta como completa."
          action={
            canEdit && done < total && (
              <Button size="sm" variant="secondary" icon={<Camera size={15} />} onClick={() => run(captureAllPhotos, { unitId: unit.id })}>
                Completar todas (demo)
              </Button>
            )
          }
        />
        <div className="px-5 pt-4">
          <div className="mb-1.5 flex justify-between text-[13px]">
            <span className="text-ink-soft">Avance de la plantilla</span>
            <span className="num font-medium text-ink">
              {done} de {total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Avance de fotos">
            <div className="h-2 rounded-full bg-brand-500 transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {unit.photos.map((slot) => (
            <li key={slot.code}>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => run(capturePhoto, { unitId: unit.id, code: slot.code })}
                aria-pressed={slot.done}
                className={cn(
                  "flex w-full flex-col items-center gap-2 rounded-card border p-4 text-center transition",
                  slot.done ? "border-ok/30 bg-ok-bg" : "border-dashed border-line-strong hover:border-brand-500 hover:bg-brand-50/50",
                  !canEdit && "cursor-default",
                )}
              >
                {slot.done ? <CheckCircle size={30} weight="fill" className="text-ok" /> : <ImageSquare size={30} className="text-muted" />}
                <span className="text-[13px] font-medium text-ink">{slot.label}</span>
                <span className={cn("text-xs", slot.done ? "text-ok" : "text-muted")}>{slot.done ? "Cargada" : canEdit ? "Toca para cargar" : "Pendiente"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Notice tone="brand" title="Qué pasa con estas fotos">
        El original queda privado. Para el público se generan copias sin ubicación y con la placa difuminada si lo eliges; la URL pública nunca devuelve el original.
      </Notice>
    </div>
  );
}
