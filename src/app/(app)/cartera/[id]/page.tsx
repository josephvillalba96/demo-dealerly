import { LoanDetail } from "@/features/credit/loan-detail";

export const metadata = { title: "Crédito | Dealerly" };

export default async function CreditoPage(props: PageProps<"/cartera/[id]">) {
  const { id } = await props.params;
  return <LoanDetail loanId={id} />;
}
