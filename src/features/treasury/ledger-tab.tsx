"use client";

import { useMemo } from "react";
import { Badge, Card, CardHeader, Notice } from "@/components/ui/surface";
import { ACCOUNT_LABELS, balances, type Account } from "@/domain/ledger";
import { formatCop } from "@/domain/money";
import { useDemo } from "@/store";

const ORDER: Account[] = ["cash", "bank", "gateway_clearing", "receivable_customer", "inventory_vehicles", "inventory_parts", "payable_supplier", "customer_deposits", "refunds_payable", "sales_revenue", "parts_revenue", "interest_income", "cost_of_sales", "labor_absorbed", "inventory_loss", "expenses", "equity"];

export function LedgerTab() {
  const ledger = useDemo((s) => s.data.ledger);
  const b = useMemo(() => balances(ledger), [ledger]);
  const rows = ORDER.filter((a) => b[a] !== 0);
  const total = ORDER.reduce((acc, a) => acc + b[a], 0);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="space-y-4 xl:col-span-2">
        <Notice tone="brand" title="Libro de doble partida, solo se agrega">
          Cada hecho económico confirmado genera un asiento que balancea. No se edita ni se borra: un error se corrige con un asiento compensatorio que referencia al original. No es contabilidad fiscal.
        </Notice>
      </div>
      <Card>
        <CardHeader title="Saldos por cuenta" description="Signo deudor positivo, acreedor negativo." action={<Badge tone={total === 0 ? "ok" : "bad"}>{total === 0 ? "Balanceado" : "Desbalanceado"}</Badge>} />
        <dl className="divide-y divide-line">
          {rows.map((a) => (
            <div key={a} className="flex items-center justify-between px-5 py-3 text-sm">
              <dt className="text-ink-soft">{ACCOUNT_LABELS[a]}</dt>
              <dd className={`num font-medium ${b[a] < 0 ? "text-ink-soft" : "text-ink"}`}>{formatCop(b[a])}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <CardHeader title="Últimos asientos" description={`${ledger.length} asientos en el libro`} />
        <ul className="divide-y divide-line">
          {[...ledger].reverse().slice(0, 9).map((tx) => (
            <li key={tx.id} className="px-5 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-ink">{tx.memo}</span>
                {tx.reverses && <Badge tone="warn">Reverso</Badge>}
              </div>
              <p className="mt-1 text-[12.5px] text-muted">
                {tx.entries.map((e) => `${e.side === "debit" ? "Debe" : "Haber"} ${ACCOUNT_LABELS[e.account]} ${formatCop(e.amount)}`).join("; ")}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
