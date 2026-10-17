"use client";

import { ShieldCheck, ShieldWarning } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, Notice, PageIntro } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { verifyChain } from "@/domain/audit";
import { ROLE_LABELS } from "@/domain/rbac";
import type { AuditEvent } from "@/domain/types";
import { useDemo } from "@/store";
import { tamperAudit } from "@/store/commands/admin";

export function AuditView() {
  const audit = useDemo((s) => s.data.audit);
  const run = useDemo((s) => s.run);
  const check = useMemo(() => verifyChain(audit), [audit]);
  const rows = useMemo(() => [...audit].reverse(), [audit]);

  const columns: Column<AuditEvent>[] = [
    { header: "N°", cell: (e) => <span className="num font-medium text-ink">{e.seq}</span> },
    { header: "Cuándo", cell: (e) => <span className="num">{e.at.slice(0, 16).replace("T", " ")}</span>, hideBelow: "md" },
    { header: "Quién", cell: (e) => <div><p className="font-medium text-ink">{e.actor}</p><p className="text-[13px] text-muted">{ROLE_LABELS[e.role]}</p></div>, hideBelow: "md" },
    { header: "Qué hizo", cell: (e) => <span className="max-w-lg">{e.action}</span> },
    { header: "Huella", cell: (e) => <code className="num text-xs text-muted">{e.hash.slice(0, 10)}</code>, hideBelow: "lg" },
    { header: "", align: "right", cell: (e) => (!check.ok && check.brokenAtSeq === e.seq ? <Badge tone="bad">Rota aquí</Badge> : <Button size="sm" variant="ghost" onClick={() => run(tamperAudit, { seq: e.seq })}>Alterar (demo)</Button>) },
  ];

  return (
    <>
      <PageIntro>Cada acción importante queda en una bitácora encadenada con SHA-256: la huella de cada evento incluye la del anterior. Si alguien cambia o borra una fila, la verificación lo detecta.</PageIntro>
      <div className="mb-6">
        {check.ok ? (
          <Card className="flex items-center gap-4 border-ok/30 bg-ok-bg p-5">
            <ShieldCheck size={32} weight="fill" className="text-ok" />
            <div>
              <p className="text-[15px] font-semibold text-ok">Cadena íntegra</p>
              <p className="text-sm text-ok/90">Se recalcularon los {check.length} eventos y todas las huellas coinciden.</p>
            </div>
          </Card>
        ) : (
          <Card className="flex items-center gap-4 border-bad/30 bg-bad-bg p-5">
            <ShieldWarning size={32} weight="fill" className="text-bad" />
            <div>
              <p className="text-[15px] font-semibold text-bad">Cadena rota en el evento {check.brokenAtSeq}</p>
              <p className="text-sm text-bad/90">Alguien alteró esa fila después de registrada. Reinicia el demo para restaurarla.</p>
            </div>
          </Card>
        )}
      </div>
      <Card>
        <CardHeader title="Bitácora" description={`${audit.length} eventos, del más reciente al más antiguo.`} />
        <DataTable caption="Bitácora de auditoría" columns={columns} rows={rows} rowKey={(e) => String(e.seq)} />
      </Card>
      <div className="mt-6">
        <Notice tone="brand">En el producto real la bitácora vive en el servidor, un proceso ancla periódicamente su última huella en un almacenamiento que no se puede reescribir y el operador de la plataforma no puede editarla.</Notice>
      </div>
    </>
  );
}
