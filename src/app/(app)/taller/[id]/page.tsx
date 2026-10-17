import { OrderDetail } from "@/features/workshop/order-detail";

export const metadata = { title: "Orden de taller | Dealerly" };

export default async function OrdenPage(props: PageProps<"/taller/[id]">) {
  const { id } = await props.params;
  return <OrderDetail orderId={id} />;
}
