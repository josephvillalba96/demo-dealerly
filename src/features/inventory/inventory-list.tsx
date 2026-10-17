"use client";

import { Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Segmented, Select } from "@/components/ui/form";
import { Card, PageIntro } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { confirmedCost, STATUS_LABELS } from "@/domain/inventory";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import type { BranchId, Unit, UnitStatus, VehicleKind } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { canSeeCosts, formatKm } from "@/lib/format";
import { useDemo } from "@/store";
import { UnitStatusBadge } from "../shared/badges";
import { UnitCell } from "../shared/unit-link";

export function InventoryList() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const router = useRouter();
  const params = useSearchParams();
  const [kind, setKind] = useState<VehicleKind | "all">("all");
  const [branch, setBranch] = useState<BranchId | "all">("all");
  const [status, setStatus] = useState<UnitStatus | "all">("all");
  const [text, setText] = useState(params.get("q") ?? "");

  const rows = useMemo(() => {
    const q = text.trim().toLowerCase();
    return data.units.filter(
      (u) =>
        (kind === "all" || u.kind === kind) &&
        (branch === "all" || u.branchId === branch) &&
        (status === "all" || u.status === status) &&
        (!q || `${u.make} ${u.model} ${u.trim} ${u.plate} ${u.vin} ${u.year}`.toLowerCase().includes(q)),
    );
  }, [data.units, kind, branch, status, text]);

  const showCosts = canSeeCosts(role);
  const columns: Column<Unit>[] = [
    { header: "Vehículo", cell: (u) => <UnitCell unit={u} subtitle={`${u.plate}, ${u.year}, ${u.kind === "car" ? "Carro" : "Moto"}`} /> },
    { header: "Sede", cell: (u) => BRANCH_NAMES[u.branchId], hideBelow: "md" },
    { header: "Kilometraje", cell: (u) => formatKm(u.km), hideBelow: "lg", align: "right" },
    { header: "Precio de lista", cell: (u) => <span className="font-medium text-ink">{formatCop(u.listPrice)}</span>, align: "right" },
    ...(showCosts
      ? [{ header: "Margen estimado", cell: (u: Unit) => formatCop(u.listPrice - confirmedCost(data.costs, u.id)), align: "right" as const, hideBelow: "lg" as const }]
      : []),
    { header: "Estado", cell: (u) => <UnitStatusBadge status={u.status} /> },
  ];

  return (
    <>
      <PageIntro
        actions={
          can(role, "inventory.write") && (
            <Link href="/inventario/nuevo">
              <Button icon={<Plus size={16} weight="bold" />}>Registrar vehículo</Button>
            </Link>
          )
        }
      >
        Cada carro y cada moto es una unidad individual con su VIN, su costo y su expediente. No hay &quot;cantidad en stock&quot; de vehículos.
      </PageIntro>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <Segmented
            label="Tipo de vehículo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Todos" },
              { value: "car", label: "Carros" },
              { value: "motorcycle", label: "Motos" },
            ]}
          />
          <Select aria-label="Sede" value={branch} onChange={(e) => setBranch(e.target.value as BranchId | "all")} className="w-40">
            <option value="all">Todas las sedes</option>
            <option value="norte">{BRANCH_NAMES.norte}</option>
            <option value="centro">{BRANCH_NAMES.centro}</option>
          </Select>
          <Select aria-label="Estado" value={status} onChange={(e) => setStatus(e.target.value as UnitStatus | "all")} className="w-44">
            <option value="all">Todos los estados</option>
            {(Object.keys(STATUS_LABELS) as UnitStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Input aria-label="Buscar" value={text} onChange={(e) => setText(e.target.value)} placeholder="Placa, VIN o modelo" className="w-52" />
          <p className="num ml-auto text-[13px] text-muted">{rows.length} unidades</p>
        </div>
        <DataTable
          caption="Inventario de unidades"
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          onRowClick={(u) => router.push(`/inventario/${u.id}`)}
          empty={{ title: "Ninguna unidad coincide", description: "Cambia los filtros o registra un vehículo nuevo." }}
        />
      </Card>
    </>
  );
}
