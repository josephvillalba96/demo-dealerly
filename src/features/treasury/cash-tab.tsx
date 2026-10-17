"use client";

import { LockKey, LockKeyOpen } from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, MoneyInput } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, Notice } from "@/components/ui/surface";
import { formatDate } from "@/domain/dates";
import { formatCop } from "@/domain/money";
import { can } from "@/domain/rbac";
import { closeSession, expectedCash } from "@/domain/treasury";
import type { BranchId, CashSession } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";
import { closeCashSession, openCashSession } from "@/store/commands/treasury";

export function CashTab() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [closing, setClosing] = useState<CashSession | null>(null);
  const [counted, setCounted] = useState(0);
  const [withdrawal, setWithdrawal] = useState(0);
  const [nextBase, setNextBase] = useState(300_000);
  const canClose = can(role, "cash.close");

  const open = data.cashSessions.filter((s) => s.status === "open");
  const closed = data.cashSessions.filter((s) => s.status === "closed");
  const branchesWithoutCash = (["norte", "centro"] as BranchId[]).filter((b) => !open.some((s) => s.branchId === b));
  const expected = closing ? expectedCash(closing, data.payments, data.expenses) : 0;
  const preview = closing ? closeSession(expected, counted) : null;

  const movements = (s: CashSession) => {
    const cashIn = data.payments.filter((p) => p.sessionId === s.id && p.method === "cash" && p.direction === "in" && p.status === "confirmed");
    const exp = data.expenses.filter((e) => e.sessionId === s.id && e.method === "cash" && e.status === "confirmed");
    return { cashIn, exp };
  };

  return (
    <div className="space-y-6">
      <Notice tone="brand">Cada movimiento en efectivo pertenece a un solo turno de caja. El cierre compara lo esperado con lo contado y deja la diferencia a la vista.</Notice>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {open.map((s) => {
          const m = movements(s);
          const exp = expectedCash(s, data.payments, data.expenses);
          return (
            <Card key={s.id}>
              <CardHeader title={BRANCH_NAMES[s.branchId]} description={`Caja abierta desde ${formatDate(s.openedOn)}`} action={<Badge tone="ok">Abierta</Badge>} />
              <dl className="grid grid-cols-3 gap-4 p-5 text-sm">
                <div><dt className="text-xs text-muted">Base inicial</dt><dd className="num mt-0.5 font-medium text-ink">{formatCop(s.openingBase)}</dd></div>
                <div><dt className="text-xs text-muted">Entradas en efectivo</dt><dd className="num mt-0.5 font-medium text-ink">{formatCop(m.cashIn.reduce((a, p) => a + p.amount, 0))}</dd></div>
                <div><dt className="text-xs text-muted">Egresos en efectivo</dt><dd className="num mt-0.5 font-medium text-ink">{formatCop(m.exp.reduce((a, e) => a + e.amount, 0))}</dd></div>
              </dl>
              <div className="flex items-center justify-between border-t border-line px-5 py-4">
                <div><p className="text-xs text-muted">Efectivo esperado</p><p className="num text-xl font-bold text-ink">{formatCop(exp)}</p></div>
                {canClose && (
                  <Button icon={<LockKey size={16} />} onClick={() => { setClosing(s); setCounted(exp); setWithdrawal(Math.max(0, exp - 300_000)); }}>
                    Cerrar caja
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {canClose && branchesWithoutCash.map((b) => (
          <Card key={b} className="flex flex-col items-start justify-center gap-3 p-6">
            <p className="font-semibold text-ink">{BRANCH_NAMES[b]}</p>
            <p className="text-sm text-muted">No hay caja abierta. Sin caja abierta no se recibe efectivo ni se pagan gastos en efectivo.</p>
            <Button variant="secondary" icon={<LockKeyOpen size={16} />} onClick={() => run(openCashSession, { branchId: b, base: 300_000 })}>Abrir caja con base de $300.000</Button>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Cierres anteriores" />
        <ul className="divide-y divide-line">
          {closed.length === 0 && <li className="px-5 py-6 text-sm text-muted">Todavía no hay cierres.</li>}
          {[...closed].reverse().map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
              <div><p className="font-medium text-ink">{BRANCH_NAMES[s.branchId]}, {formatDate(s.openedOn)}</p><p className="num text-[13px] text-muted">Esperado {formatCop(s.expected ?? 0)}, contado {formatCop(s.counted ?? 0)}, retiro {formatCop(s.withdrawal ?? 0)}</p></div>
              <Badge tone={s.difference === 0 ? "ok" : "bad"}>{s.difference === 0 ? "Cuadrado" : `${(s.difference ?? 0) > 0 ? "Sobrante" : "Faltante"} ${formatCop(Math.abs(s.difference ?? 0))}`}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Dialog
        open={Boolean(closing)}
        onOpenChange={(o) => !o && setClosing(null)}
        title={`Cerrar caja de ${closing ? BRANCH_NAMES[closing.branchId] : ""}`}
        description="Cuenta el efectivo físico. La diferencia se registra, no se esconde."
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setClosing(null)}>Cancelar</Button>
            <Button onClick={() => { if (!closing) return; const r = run(closeCashSession, { sessionId: closing.id, counted, withdrawal, nextBase }); if (r.ok) setClosing(null); }}>Cerrar caja</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex justify-between rounded-control bg-surface p-4 text-sm"><span className="text-muted">Efectivo esperado</span><span className="num font-semibold text-ink">{formatCop(expected)}</span></div>
          <Field label="Efectivo contado">{(id) => <MoneyInput id={id} value={counted} onChange={setCounted} />}</Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Retiro a banco">{(id) => <MoneyInput id={id} value={withdrawal} onChange={setWithdrawal} />}</Field>
            <Field label="Base del siguiente turno">{(id) => <MoneyInput id={id} value={nextBase} onChange={setNextBase} />}</Field>
          </div>
          {preview && <Notice tone={preview.verdict === "cuadrado" ? "ok" : "bad"}>{preview.verdict === "cuadrado" ? "La caja cuadra." : `Habría un ${preview.verdict} de ${formatCop(Math.abs(preview.difference))}.`}</Notice>}
        </div>
      </Dialog>
    </div>
  );
}
