import { UnitDetail } from "@/features/inventory/unit-detail";

export const metadata = { title: "Expediente de unidad | Dealerly" };

export default async function UnidadPage(props: PageProps<"/inventario/[id]">) {
  const { id } = await props.params;
  return <UnitDetail unitId={id} />;
}
