import { afterEach, describe, expect, it } from "vitest";
import { createSeed } from "@/data/seed";
import { can, setGrants } from "@/domain/rbac";
import { ctxFor, type Command } from "@/store/engine";
import { execute } from "@/store/execute";
import { acceptInvitation, inviteMember, resetRoleGrants, restoreMember, revokeMember, setRolePermission, updateMember } from "@/store/commands/admin";
import type { DemoData } from "@/domain/types";

const ADMIN = "m-marcela";
const ASESOR = "m-andres";

function run<A>(d: DemoData, who: string, cmd: Command<A>, args: A) {
  const r = execute(d, ctxFor(d.members.find((m) => m.id === who)!), cmd, args);
  if (r.outcome.ok) setGrants(r.data.grants);
  return r;
}

afterEach(() => setGrants(createSeed().grants));

describe("gestión de equipo editable", () => {
  it("edita rol, nombre y sedes y deja rastro en la bitácora", () => {
    const d = createSeed();
    const r = run(d, ADMIN, updateMember, { memberId: ASESOR, name: "Andrés P.", role: "cartera", branchIds: ["norte", "centro"] });
    expect(r.outcome.ok).toBe(true);
    const m = r.data.members.find((x) => x.id === ASESOR)!;
    expect(m).toMatchObject({ name: "Andrés P.", role: "cartera", branchIds: ["norte", "centro"] });
    expect(r.data.audit.length).toBe(d.audit.length + 1);
  });

  it("no deja cambiar el propio rol ni quedarse sin sedes", () => {
    const d = createSeed();
    const self = d.members.find((m) => m.id === ADMIN)!;
    expect(run(d, ADMIN, updateMember, { memberId: ADMIN, name: self.name, role: "asesor", branchIds: self.branchIds }).outcome.ok).toBe(false);
    expect(run(d, ADMIN, updateMember, { memberId: ASESOR, name: "X", role: "asesor", branchIds: [] }).outcome.ok).toBe(false);
  });

  it("un asesor no puede gestionar el equipo", () => {
    const d = createSeed();
    expect(run(d, ASESOR, updateMember, { memberId: ADMIN, name: "X", role: "admin", branchIds: ["norte"] }).outcome.ok).toBe(false);
  });

  it("revoca y restablece el acceso; acepta una invitación", () => {
    let d = createSeed();
    d = run(d, ADMIN, revokeMember, { memberId: ASESOR }).data;
    expect(d.members.find((m) => m.id === ASESOR)!.status).toBe("revoked");
    d = run(d, ADMIN, restoreMember, { memberId: ASESOR }).data;
    expect(d.members.find((m) => m.id === ASESOR)!.status).toBe("active");
    d = run(d, ADMIN, inviteMember, { name: "Nueva Persona", email: "nueva@demo.co", role: "taller", branchIds: ["norte"] }).data;
    const invited = d.members.find((m) => m.email === "nueva@demo.co")!;
    expect(invited.status).toBe("invited");
    d = run(d, ADMIN, acceptInvitation, { memberId: invited.id }).data;
    expect(d.members.find((m) => m.id === invited.id)!.status).toBe("active");
  });

  it("conceder o quitar un permiso cambia lo que el rol puede hacer", () => {
    let d = createSeed();
    expect(can("asesor", "payment.confirm")).toBe(false);
    d = run(d, ADMIN, setRolePermission, { role: "asesor", permission: "payment.confirm", granted: true }).data;
    expect(can("asesor", "payment.confirm")).toBe(true);
    d = run(d, ADMIN, resetRoleGrants, { role: "asesor" }).data;
    setGrants(d.grants);
    expect(can("asesor", "payment.confirm")).toBe(false);
  });

  it("el rol Administrador no puede perder permisos", () => {
    const d = createSeed();
    expect(run(d, ADMIN, setRolePermission, { role: "admin", permission: "team.manage", granted: false }).outcome.ok).toBe(false);
  });
});
