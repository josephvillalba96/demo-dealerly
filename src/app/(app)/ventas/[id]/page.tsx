import { SaleDetail } from "@/features/sales/sale-detail";

export const metadata = { title: "Venta | Dealerly" };

export default async function VentaPage(props: PageProps<"/ventas/[id]">) {
  const { id } = await props.params;
  return <SaleDetail saleId={id} />;
}
