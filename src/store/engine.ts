import { appendAudit } from "@/domain/audit";
import type { IsoDate } from "@/domain/dates";
import { DEMO_TODAY } from "@/domain/dates";
import { checkModule } from "@/domain/entitlements";
import { assertBalanced, type Account, type LedgerEntry } from "@/domain/ledger";
import { can, ROLE_LABELS, type Permission } from "@/domain/rbac";
import type { BranchId, DemoData, Id, Member, ModuleId, PayMethod, Role } from "@/domain/types";

/** Quién ejecuta el comando y cuándo ("hoy" es fijo en el demo). */
export interface Ctx {
  role: Role;
  userId: Id;
  actor: string;
  today: IsoDate;
}

export type Outcome<T = undefined> = { ok: true; message?: string; value?: T } | { ok: false; error: string };

export const done = <T = undefined>(message?: string, value?: T): Outcome<T> => ({ ok: true, message, value });
export const fail = (error: string): Outcome<never> => ({ ok: false, error });

/** Comando: recibe una copia de los datos, la modifica y devuelve el resultado. Si falla, la copia se descarta. */
export type Command<A, T = undefined> = (d: DemoData, ctx: Ctx, args: A) => Outcome<T>;

export function ctxFor(member: Member): Ctx {
  return { role: member.role, userId: member.id, actor: member.name, today: DEMO_TODAY };
}

/** Devuelve un fallo si el rol no tiene el permiso; null si puede continuar. */
export function denied(ctx: Ctx, permission: Permission): Outcome<never> | null {
  if (can(ctx.role, permission)) return null;
  return fail(`Tu rol (${ROLE_LABELS[ctx.role]}) no tiene permiso para esta acción.`);
}

/** Verifica en el "servidor" que el plan incluya el módulo (FR-ENT-02). Devuelve fallo o null. */
export function moduleGate(d: DemoData, module: ModuleId): Outcome<never> | null {
  const ent = checkModule(d.subscription, module);
  return ent.ok ? null : fail(ent.message);
}

/** Identificador único legible dentro del demo. */
export function uid(d: DemoData, prefix: string): Id {
  d.counters.id = (d.counters.id ?? 0) + 1;
  return `${prefix}-${d.counters.id}`;
}

/** Número consecutivo por serie, por ejemplo COT-0005. */
export function serial(d: DemoData, key: string, prefix: string): string {
  const value = (d.counters[key] ?? 0) + 1;
  d.counters[key] = value;
  return `${prefix}-${String(value).padStart(4, "0")}`;
}

export function audit(d: DemoData, ctx: Ctx, action: string, resource: string): void {
  d.audit = appendAudit(d.audit, { at: `${ctx.today}T${hourStamp(d.audit.length)}`, actor: ctx.actor, role: ctx.role, action, resource });
}

function hourStamp(n: number): string {
  const minutes = 9 * 60 + n * 3;
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Asienta una transacción balanceada. Si no balancea lanza y todo el comando se descarta (FR-PAY-07). */
export function postTx(d: DemoData, ctx: Ctx, sourceType: string, sourceId: string, memo: string, entries: LedgerEntry[]): string {
  assertBalanced(entries);
  const id = uid(d, "lx");
  d.ledger.push({ id, on: ctx.today, sourceType, sourceId, memo, entries });
  return id;
}

/** Revierte todos los asientos aún vigentes de un origen, conservando los originales. */
export function reverseSource(d: DemoData, ctx: Ctx, sourceType: string, sourceId: string, memo: string): number {
  const reversed = new Set(d.ledger.filter((t) => t.reverses).map((t) => t.reverses));
  const targets = d.ledger.filter((t) => t.sourceType === sourceType && t.sourceId === sourceId && !t.reverses && !reversed.has(t.id));
  for (const original of targets) {
    d.ledger.push({
      id: uid(d, "lx"),
      on: ctx.today,
      sourceType,
      sourceId,
      memo,
      reverses: original.id,
      entries: original.entries.map((e) => ({ ...e, side: e.side === "debit" ? "credit" : "debit" })),
    });
  }
  return targets.length;
}

export function moneyAccount(method: PayMethod): Account {
  if (method === "cash") return "cash";
  if (method === "transfer") return "bank";
  return "gateway_clearing";
}

export function branchOpenSession(d: DemoData, branchId: BranchId) {
  return d.cashSessions.find((s) => s.branchId === branchId && s.status === "open");
}

export function memberName(d: DemoData, id: Id | null | undefined): string {
  return d.members.find((m) => m.id === id)?.name ?? "Sin asignar";
}
