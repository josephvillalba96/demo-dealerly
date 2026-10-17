"use client";

import { CheckCircle, Circle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { Badge, Card, CardHeader, Notice } from "@/components/ui/surface";
import { formatDate } from "@/domain/dates";
import { KIND_LABELS } from "@/domain/inventory";
import { publishBlockers } from "@/domain/listing";
import { can } from "@/domain/rbac";
import type { Unit } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { formatKm } from "@/lib/format";
import { useDemo } from "@/store";
import { setCondition, verifySeller } from "@/store/commands/inventory";
import { listingOfUnit } from "@/store/queries";

export function UnitOverview({ unit }: { unit: Unit }) {
  const run = useDemo((s) => s.run);
  const role = useDemo((s) => s.session.role);
  const listing = useDemo((s) => listingOfUnit(s.data, unit.id));
  const [text, setText] = useState(unit.condition);
  const blockers = publishBlockers(unit);
  const canEdit = can(role, "inventory.write");

  const facts: [string, string][] = [
    ["Tipo", KIND_LABELS[unit.kind]],
    ["Año", String(unit.year)],
    ["Kilometraje declarado", formatKm(unit.km)],
    ["Color", unit.color],
    ["Placa", unit.plate],
    ["VIN", unit.vin],
    ["Sede", BRANCH_NAMES[unit.branchId]],
    ["Ciudad", unit.city],
    ["Propiedad", unit.ownership === "owned" ? "Propia" : "En consignación"],
    ["Ingresó", formatDate(unit.acquiredOn)],
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <Card>
          <CardHeader title="Ficha del vehículo" description="El kilometraje es el declarado por el vendedor, no un diagnóstico." />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="num mt-0.5 text-sm font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Condición declarada" description="Lo que verá el comprador. Se muestra como declarado por el vendedor, con su fecha." />
          <div className="space-y-3 p-5">
            <Field label="Descripción de la condición">
              {(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} disabled={!canEdit} rows={4} placeholder="Ejemplo: Rayón superficial en el parachoques trasero. Mantenimientos al día." />}
            </Field>
            {canEdit && (
              <Button variant="secondary" size="sm" disabled={text === unit.condition} onClick={() => run(setCondition, { unitId: unit.id, text })}>
                Guardar condición
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="¿Listo para publicar?" description="Estos requisitos se verifican en el servidor, no solo en pantalla." />
          <div className="space-y-3 p-5">
            {blockers.length === 0 ? (
              <Notice tone="ok">Cumple todos los requisitos. Ya se puede enviar a revisión desde Publicaciones.</Notice>
            ) : (
              <ul className="space-y-2.5">
                {blockers.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-ink-soft">
                    <Circle size={18} className="mt-px shrink-0 text-warn" weight="bold" />
                    {b}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 border-t border-line pt-3 text-sm">
              <CheckCircle size={18} weight="fill" className={unit.sellerVerified ? "text-ok" : "text-faint"} />
              <span className="text-ink-soft">Vendedor validado</span>
              {unit.sellerVerified ? (
                <Badge tone="ok">Validado</Badge>
              ) : (
                canEdit && (
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => run(verifySeller, { unitId: unit.id })}>
                    Validar titularidad (demo)
                  </Button>
                )
              )}
            </div>
            {listing && (
              <Link href="/publicaciones" className="block text-[13px] font-semibold text-brand-700 hover:underline">
                Ver el anuncio en Publicaciones
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
