"use client";

import { Plus } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, Stat } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { DEMO_TODAY, formatDate } from "@/domain/dates";
import { formatCop, sum } from "@/domain/money";
import { can } from "@/domain/rbac";
import { METHOD_LABELS } from "@/domain/treasury";
import type { BranchId, Expense, PayMethod, SupplierObligation } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";
import { paySupplier, recordExpense } from "@/store/commands/treasury";

export function SuppliersTab() {
  const obligations = useDemo((s) => s.data.obligations);
  const expenses = useDemo((s) => s.data.expenses);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [paying, setPaying] = useState<SupplierObligation | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PayMethod>("transfer");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [concept, setConcept] = useState("");
  const [expAmount, setExpAmount] = useState(0);
  const [expMethod, setExpMethod] = useState<"cash" | "transfer">("cash");
  const [branch, setBranch] = useState<BranchId>("norte");
  const canPay = can(role, "payment.out");

  const columns: Column<SupplierObligation>[] = [
    { header: "Proveedor", cell: (o) => <div><p className="font-medium text-ink">{o.supplier}</p><p className="text-[13px] text-muted">{o.concept}, {o.docRef}</p></div> },
    { header: "Vence", cell: (o) => formatDate(o.dueOn), hideBelow: "md" },
    { header: "Estado", cell: (o) => (o.outstanding === 0 ? <Badge tone="ok">Saldada</Badge> : o.dueOn < DEMO_TODAY ? <Badge tone="bad">Vencida</Badge> : <Badge tone="neutral">Vigente</Badge>) },
    { header: "Saldo", align: "right", cell: (o) => <span className="font-medium text-ink">{formatCop(o.outstanding)} <span className="text-muted">de {formatCop(o.amount)}</span></span> },
    { header: "", align: "right", cell: (o) => (canPay && o.outstanding > 0 ? <Button size="sm" onClick={() => { setPaying(o); setAmount(o.outstanding); }}>Pagar</Button> : null) },
  ];
  const expColumns: Column<Expense>[] = [
    { header: "Concepto", cell: (e) => <span className="font-medium text-ink">{e.concept}</span> },
    { header: "Sede", cell: (e) => BRANCH_NAMES[e.branchId], hideBelow: "md" },
    { header: "Medio", cell: (e) => (e.method === "cash" ? "Efectivo" : "Transferencia") },
    { header: "Fecha", cell: (e) => formatDate(e.on), hideBelow: "md" },
    { header: "Importe", align: "right", cell: (e) => formatCop(e.amount) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Por pagar a proveedores" value={formatCop(sum(obligations.map((o) => o.outstanding)))} hint={`${obligations.filter((o) => o.outstanding > 0).length} obligaciones abiertas`} />
        <Stat label="Vencido" value={formatCop(sum(obligations.filter((o) => o.dueOn < DEMO_TODAY).map((o) => o.outstanding)))} tone="bad" hint="Pasó la fecha de vencimiento" />
        <Stat label="Egresos registrados" value={formatCop(sum(expenses.map((e) => e.amount)))} hint="Gastos menores confirmados" />
      </div>
      <Card>
        <CardHeader title="Cuentas por pagar" description="Una obligación se liquida solo con un pago aplicado. Cambiarle el estado a mano no la paga." />
        <DataTable caption="Cuentas por pagar" columns={columns} rows={obligations} rowKey={(o) => o.id} empty={{ title: "Sin obligaciones" }} />
      </Card>
      <Card>
        <CardHeader title="Egresos de caja y cuenta" action={canPay && <Button size="sm" icon={<Plus size={14} weight="bold" />} onClick={() => setExpenseOpen(true)}>Registrar egreso</Button>} />
        <DataTable caption="Egresos" columns={expColumns} rows={[...expenses].reverse()} rowKey={(e) => e.id} empty={{ title: "Sin egresos" }} />
      </Card>

      <Dialog
        open={Boolean(paying)}
        onOpenChange={(o) => !o && setPaying(null)}
        title="Pagar a proveedor"
        description={paying ? `${paying.supplier}, ${paying.docRef}. Saldo ${formatCop(paying.outstanding)}.` : ""}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button onClick={() => { if (!paying) return; const r = run(paySupplier, { obligationId: paying.id, amount, method }); if (r.ok) setPaying(null); }}>Registrar pago</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Importe">{(id) => <MoneyInput id={id} value={amount} onChange={setAmount} />}</Field>
          <Field label="Medio de pago">{(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{(["transfer", "cash", "pse"] as PayMethod[]).map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}</Select>}</Field>
        </div>
      </Dialog>

      <Dialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        title="Registrar egreso"
        description="Un egreso en efectivo exige caja abierta en la sede y reduce el efectivo esperado."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExpenseOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(recordExpense, { concept, amount: expAmount, method: expMethod, branchId: branch }); if (r.ok) { setExpenseOpen(false); setConcept(""); setExpAmount(0); } }}>Registrar egreso</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Concepto">{(id) => <Input id={id} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ejemplo: Combustible para traslado" />}</Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Importe">{(id) => <MoneyInput id={id} value={expAmount} onChange={setExpAmount} />}</Field>
            <Field label="Medio">{(id) => <Select id={id} value={expMethod} onChange={(e) => setExpMethod(e.target.value as "cash" | "transfer")}><option value="cash">Efectivo</option><option value="transfer">Transferencia</option></Select>}</Field>
          </div>
          <Field label="Sede">{(id) => <Select id={id} value={branch} onChange={(e) => setBranch(e.target.value as BranchId)}><option value="norte">{BRANCH_NAMES.norte}</option><option value="centro">{BRANCH_NAMES.centro}</option></Select>}</Field>
        </div>
      </Dialog>
    </div>
  );
}
