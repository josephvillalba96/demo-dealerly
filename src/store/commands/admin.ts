import { ADDON_MODULES, checkLimit, MODULE_LABELS, overLimit, PLANS } from "@/domain/entitlements";
import { defaultGrants, ROLE_LABELS, type Permission } from "@/domain/rbac";
import type { BranchId, CollectionAction, DemoData, ModuleId, PlanId, Role } from "@/domain/types";
import { audit, denied, done, fail, uid, type Command } from "../engine";
import { usage } from "../queries";

export const inviteMember: Command<{ name: string; email: string; role: Role; branchIds: BranchId[] }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  if (!a.name.trim() || !a.email.includes("@")) return fail("Escribe nombre y un correo válido.");
  if (d.members.some((m) => m.email.toLowerCase() === a.email.trim().toLowerCase() && m.status !== "revoked")) return fail("Ya existe un miembro con ese correo.");
  const ent = checkLimit(d.subscription, "users", usage(d, ctx.today).users);
  if (!ent.ok) return fail(ent.message);
  d.members.push({ id: uid(d, "m"), name: a.name.trim(), email: a.email.trim(), role: a.role, branchIds: a.branchIds, status: "invited" });
  audit(d, ctx, `Invitó a ${a.name} como ${ROLE_LABELS[a.role]}`, "equipo");
  return done("Invitación enviada. La persona queda con permisos solo de su rol.");
};

export const revokeMember: Command<{ memberId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  const m = d.members.find((x) => x.id === a.memberId);
  if (!m) return fail("Miembro no encontrado.");
  if (m.id === ctx.userId) return fail("No puedes revocar tu propio acceso.");
  m.status = "revoked";
  audit(d, ctx, `Revocó el acceso de ${m.name}`, `miembro ${m.id}`);
  return done("Acceso revocado: las solicitudes nuevas de esa persona se rechazan.");
};

export const updateMember: Command<{ memberId: string; name: string; role: Role; branchIds: BranchId[] }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  const m = d.members.find((x) => x.id === a.memberId);
  if (!m) return fail("Miembro no encontrado.");
  if (!a.name.trim()) return fail("Escribe el nombre de la persona.");
  if (a.branchIds.length === 0) return fail("Elige al menos una sede.");
  if (m.id === ctx.userId && a.role !== m.role) return fail("No puedes cambiar tu propio rol: otro administrador debe hacerlo.");
  const changes: string[] = [];
  if (m.name !== a.name.trim()) changes.push("nombre");
  if (m.role !== a.role) changes.push(`rol a ${ROLE_LABELS[a.role]}`);
  if (m.branchIds.join() !== a.branchIds.join()) changes.push("sedes");
  if (changes.length === 0) return fail("No hay cambios que guardar.");
  m.name = a.name.trim();
  m.role = a.role;
  m.branchIds = a.branchIds;
  audit(d, ctx, `Editó a ${m.name}: ${changes.join(", ")}`, `miembro ${m.id}`);
  return done("Cambios guardados. Los permisos nuevos aplican desde la siguiente acción de esa persona.");
};

export const restoreMember: Command<{ memberId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  const m = d.members.find((x) => x.id === a.memberId);
  if (!m) return fail("Miembro no encontrado.");
  if (m.status !== "revoked") return fail("Esa persona no tiene el acceso revocado.");
  const ent = checkLimit(d.subscription, "users", usage(d, ctx.today).users);
  if (!ent.ok) return fail(ent.message);
  m.status = "active";
  audit(d, ctx, `Restableció el acceso de ${m.name}`, `miembro ${m.id}`);
  return done("Acceso restablecido con su rol anterior.");
};

/** Simula que la persona invitada abre el enlace y crea su cuenta. */
export const acceptInvitation: Command<{ memberId: string }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  const m = d.members.find((x) => x.id === a.memberId);
  if (!m || m.status !== "invited") return fail("No hay una invitación pendiente para esa persona.");
  m.status = "active";
  audit(d, ctx, `${m.name} aceptó la invitación`, `miembro ${m.id}`);
  return done(`${m.name} ya tiene acceso como ${ROLE_LABELS[m.role]}.`);
};

export const setRolePermission: Command<{ role: Role; permission: Permission; granted: boolean }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  if (a.role === "admin") return fail("El rol Administrador siempre conserva todos los permisos.");
  const list = d.grants[a.role];
  if (list.includes(a.permission) === a.granted) return fail("Ese permiso ya estaba así.");
  d.grants[a.role] = a.granted ? [...list, a.permission] : list.filter((p) => p !== a.permission);
  audit(d, ctx, `${a.granted ? "Concedió" : "Quitó"} ${a.permission} al rol ${ROLE_LABELS[a.role]}`, "permisos");
  return done(a.granted ? "Permiso concedido al rol." : "Permiso retirado del rol.");
};

export const resetRoleGrants: Command<{ role: Role }> = (d, ctx, a) => {
  const no = denied(ctx, "team.manage");
  if (no) return no;
  d.grants[a.role] = defaultGrants()[a.role];
  audit(d, ctx, `Restableció los permisos de fábrica del rol ${ROLE_LABELS[a.role]}`, "permisos");
  return done("Permisos del rol restablecidos.");
};

/** Al bajar de plan nada se borra: lo que excede el cupo se pausa (FR-ENT-03). */
function enforcePlan(d: DemoData, today: string): string[] {
  const notes: string[] = [];
  const limit = PLANS[d.subscription.planId].limits.activeListings;
  const published = d.listings.filter((l) => l.status === "published");
  if (published.length > limit) {
    const toPause = [...published].sort((x, y) => Number(Boolean(x.featuredUntil)) - Number(Boolean(y.featuredUntil)) || y.views - x.views).slice(limit);
    toPause.forEach((l) => {
      l.status = "paused";
      l.note = "Pausado por límite del plan";
    });
    notes.push(`${toPause.length} anuncios pausados por el límite de ${limit}`);
  }
  const over = overLimit(d.subscription, usage(d, today));
  if (over.includes("users")) notes.push("hay más usuarios que el cupo: pasan a solo lectura los excedentes");
  if (over.includes("branches")) notes.push("hay más sedes que el cupo: no se podrán crear nuevas");
  return notes;
}

export const changePlan: Command<{ planId: PlanId }> = (d, ctx, a) => {
  const no = denied(ctx, "plan.manage");
  if (no) return no;
  if (d.subscription.planId === a.planId) return fail("Ya tienes ese plan.");
  d.subscription.planId = a.planId;
  const notes = enforcePlan(d, ctx.today);
  audit(d, ctx, `Cambió al plan ${PLANS[a.planId].name}`, "suscripción");
  return done(notes.length ? `Plan cambiado. Nada se borró: ${notes.join("; ")}.` : `Plan cambiado a ${PLANS[a.planId].name}.`);
};

export const toggleAddon: Command<{ module: ModuleId }> = (d, ctx, a) => {
  const no = denied(ctx, "plan.manage");
  if (no) return no;
  if (!ADDON_MODULES.includes(a.module)) return fail("Ese módulo no se contrata como complemento.");
  if (PLANS[d.subscription.planId].modules.includes(a.module)) return fail("Ese módulo ya viene incluido en tu plan.");
  const has = d.subscription.addons.includes(a.module);
  d.subscription.addons = has ? d.subscription.addons.filter((m) => m !== a.module) : [...d.subscription.addons, a.module];
  audit(d, ctx, `${has ? "Desactivó" : "Activó"} ${MODULE_LABELS[a.module].name}`, "suscripción");
  return done(has ? `${MODULE_LABELS[a.module].name} desactivado: lo existente se conserva y se puede consultar.` : `${MODULE_LABELS[a.module].name} activado como complemento.`);
};

/** Alteración manual de la bitácora para demostrar que la cadena detecta cambios. */
export const tamperAudit: Command<{ seq: number }> = (d, _ctx, a) => {
  const e = d.audit.find((x) => x.seq === a.seq);
  if (!e) return fail("Evento no encontrado.");
  e.resource = `${e.resource} (alterado)`;
  return done("Se alteró una fila de la bitácora solo para esta demostración. Verifica la cadena para ver cómo se detecta.");
};

export const logCollection: Command<{ loanId: string; channel: CollectionAction["channel"]; stage: CollectionAction["stage"]; note: string }> = (d, ctx, a) => {
  const no = denied(ctx, "credit.collect");
  if (no) return no;
  const loan = d.loans.find((l) => l.id === a.loanId);
  if (!loan) return fail("Crédito no encontrado.");
  if (!a.note.trim()) return fail("Escribe qué se acordó o qué pasó en la gestión.");
  loan.collection.push({ id: uid(d, "ca"), on: ctx.today, channel: a.channel, stage: a.stage, note: a.note.trim(), delivered: a.channel === "letter" ? undefined : true });
  audit(d, ctx, `Registró gestión de cobro (${a.stage}) a ${loan.borrower.name}`, `crédito ${loan.id}`);
  return done(a.stage === "legal" ? "Caso trasladado a etapa jurídica. El demo no simula actuación judicial." : "Gestión de cobro registrada con su evidencia.");
};
