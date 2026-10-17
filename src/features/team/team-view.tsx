"use client";

import { ArrowCounterClockwise, Check, Minus, PencilSimple, UserPlus } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, CardHeader, PageIntro } from "@/components/ui/surface";
import { DataTable, type Column } from "@/components/ui/table";
import { DEMO_TODAY } from "@/domain/dates";
import { PLANS } from "@/domain/entitlements";
import { can, defaultGrants, ROLE_BLURBS, ROLE_LABELS, type Permission } from "@/domain/rbac";
import type { BranchId, Member, Role } from "@/domain/types";
import { BRANCH_NAMES } from "@/data/seed";
import { useDemo } from "@/store";
import { acceptInvitation, inviteMember, resetRoleGrants, restoreMember, revokeMember, setRolePermission, updateMember } from "@/store/commands/admin";
import { usage } from "@/store/queries";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

const MATRIX: { label: string; permission: Permission }[] = [
  { label: "Registrar y editar vehículos", permission: "inventory.write" },
  { label: "Publicar anuncios", permission: "listing.write" },
  { label: "Cotizar y reservar", permission: "quote.write" },
  { label: "Aprobar descuentos", permission: "quote.approve_discount" },
  { label: "Formalizar ventas", permission: "sale.write" },
  { label: "Anular ventas", permission: "sale.annul" },
  { label: "Aprobar créditos", permission: "credit.approve" },
  { label: "Gestionar cobro", permission: "credit.collect" },
  { label: "Confirmar dinero recibido", permission: "payment.confirm" },
  { label: "Pagar proveedores y gastos", permission: "payment.out" },
  { label: "Cerrar caja", permission: "cash.close" },
  { label: "Operar el taller", permission: "workshop.write" },
  { label: "Operar repuestos", permission: "parts.write" },
  { label: "Administrar equipo y plan", permission: "team.manage" },
];

export function TeamView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const userId = useDemo((s) => s.session.userId);
  const run = useDemo((s) => s.run);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<Role>("asesor");
  const [branch, setBranch] = useState<BranchId>("norte");
  const [editing, setEditing] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("asesor");
  const [editBranches, setEditBranches] = useState<BranchId[]>([]);
  const canManage = can(role, "team.manage");
  const factory = defaultGrants();

  const startEdit = (m: Member) => {
    setEditing(m);
    setEditName(m.name);
    setEditRole(m.role);
    setEditBranches(m.branchIds);
  };
  const toggleBranch = (b: BranchId) => setEditBranches((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));
  const users = usage(data, DEMO_TODAY).users;
  const limit = PLANS[data.subscription.planId].limits.users;

  const columns: Column<Member>[] = [
    { header: "Persona", cell: (m) => <div><p className="font-medium text-ink">{m.name}{m.id === userId && <span className="ml-2 text-xs text-muted">(tú)</span>}</p><p className="text-[13px] text-muted">{m.email}</p></div> },
    { header: "Rol", cell: (m) => ROLE_LABELS[m.role] },
    { header: "Sedes", cell: (m) => m.branchIds.map((b) => BRANCH_NAMES[b]).join(", "), hideBelow: "lg" },
    { header: "Estado", cell: (m) => <Badge tone={m.status === "active" ? "ok" : m.status === "invited" ? "warn" : "neutral"}>{{ active: "Activo", invited: "Invitación pendiente", revoked: "Acceso revocado" }[m.status]}</Badge> },
    {
      header: "",
      align: "right",
      cell: (m) =>
        canManage ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {m.status === "invited" && <Button size="sm" variant="secondary" onClick={() => run(acceptInvitation, { memberId: m.id })}>Simular aceptación</Button>}
            {m.status !== "revoked" && <Button size="sm" variant="secondary" icon={<PencilSimple size={14} />} onClick={() => startEdit(m)}>Editar</Button>}
            {m.status === "revoked" && <Button size="sm" variant="secondary" onClick={() => run(restoreMember, { memberId: m.id })}>Restablecer acceso</Button>}
            {m.status !== "revoked" && m.id !== userId && <Button size="sm" variant="ghost" onClick={() => run(revokeMember, { memberId: m.id })}>{m.status === "invited" ? "Cancelar invitación" : "Revocar acceso"}</Button>}
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageIntro actions={canManage && <Button icon={<UserPlus size={16} />} onClick={() => setOpen(true)}>Invitar persona</Button>}>
        Cada persona tiene permisos por acción y por sede. Un asesor no aprueba su propio crédito ni confirma dinero salvo que se le conceda de forma explícita.
      </PageIntro>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Miembros" description={`${users} de ${limit} usuarios en ${PLANS[data.subscription.planId].name}`} />
          <DataTable caption="Miembros del equipo" columns={columns} rows={data.members} rowKey={(m) => m.id} />
        </Card>
        <Card>
          <CardHeader title="Quién puede qué" description={canManage ? "Activa o desactiva cada permiso por rol. El cambio aplica de inmediato en todo el demo: cambia de rol desde tu avatar para comprobarlo." : "Se evalúa en el servidor en cada acción. Es la misma tabla que usa este demo."} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Permisos por rol</caption>
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="px-5 py-3 text-left font-medium">Acción</th>
                  {ROLES.map((r) => {
                    const edited = r !== "admin" && [...data.grants[r]].sort().join() !== [...factory[r]].sort().join();
                    return (
                      <th key={r} scope="col" className="px-3 py-3 text-center font-medium">
                        {ROLE_LABELS[r]}
                        {edited && canManage && (
                          <button type="button" onClick={() => run(resetRoleGrants, { role: r })} className="mx-auto mt-1 flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline">
                            <ArrowCounterClockwise size={11} /> Restablecer
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {MATRIX.map((row) => (
                  <tr key={row.permission}>
                    <th scope="row" className="px-5 py-3 text-left font-normal text-ink-soft">{row.label}</th>
                    {ROLES.map((r) => (
                      <td key={r} className="px-3 py-3 text-center">
                        {canManage && r !== "admin" ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={data.grants[r].includes(row.permission)}
                            aria-label={`${row.label}: ${ROLE_LABELS[r]}`}
                            onClick={() => run(setRolePermission, { role: r, permission: row.permission, granted: !data.grants[r].includes(row.permission) })}
                            className={cn("mx-auto flex size-7 items-center justify-center rounded-control border transition focus-visible:outline-2 focus-visible:outline-brand-500", data.grants[r].includes(row.permission) ? "border-brand-500 bg-brand-500 text-white" : "border-line-strong bg-canvas text-faint hover:border-faint")}
                          >
                            {data.grants[r].includes(row.permission) ? <Check size={16} weight="bold" /> : <Minus size={14} />}
                          </button>
                        ) : data.grants[r].includes(row.permission) ? (
                          <Check size={18} weight="bold" className="mx-auto text-ok" aria-label="Puede" />
                        ) : (
                          <Minus size={16} className="mx-auto text-faint" aria-label="No puede" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Invitar a una persona"
        description={`Quedan ${Math.max(0, limit - users)} cupos en tu plan.`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => { const r = run(inviteMember, { name, email, role: newRole, branchIds: [branch] }); if (r.ok) { setOpen(false); setName(""); setEmail(""); } }}>Enviar invitación</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Correo">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Rol" hint={ROLE_BLURBS[newRole]}>{(id) => <Select id={id} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>}</Field>
            <Field label="Sede">{(id) => <Select id={id} value={branch} onChange={(e) => setBranch(e.target.value as BranchId)}><option value="norte">{BRANCH_NAMES.norte}</option><option value="centro">{BRANCH_NAMES.centro}</option></Select>}</Field>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title="Editar persona"
        description={editing?.email}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => { if (!editing) return; const r = run(updateMember, { memberId: editing.id, name: editName, role: editRole, branchIds: editBranches }); if (r.ok) setEditing(null); }}>Guardar cambios</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nombre">{(id) => <Input id={id} value={editName} onChange={(e) => setEditName(e.target.value)} />}</Field>
          <Field label="Rol" hint={editing?.id === userId ? "No puedes cambiar tu propio rol." : ROLE_BLURBS[editRole]}>
            {(id) => (
              <Select id={id} value={editRole} disabled={editing?.id === userId} onChange={(e) => setEditRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-soft">Sedes con acceso</legend>
            <div className="flex flex-wrap gap-4">
              {(Object.keys(BRANCH_NAMES) as BranchId[]).map((b) => (
                <label key={b} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="size-4 accent-brand-500" checked={editBranches.includes(b)} onChange={() => toggleBranch(b)} />
                  {BRANCH_NAMES[b]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Dialog>
    </>
  );
}
