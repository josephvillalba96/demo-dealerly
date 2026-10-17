import { ctxFor, done, fail, type Command } from "../engine";
import { activeReservation, unitById } from "../queries";
import { changePlan } from "./admin";
import { reserveUnit } from "./sales";
import { replayWebhook } from "./treasury";

/** Dos asesores intentan reservar la misma unidad a la vez: gana uno, el otro recibe un error de negocio. */
export const scenarioDoubleReservation: Command<undefined> = (d, ctx) => {
  const unit = unitById(d, "u04");
  if (!unit || unit.status !== "available" || activeReservation(d, unit.id)) return fail("Este escenario ya se ejecutó. Reinicia el demo para repetirlo.");
  const a = d.members.find((m) => m.id === "m-andres");
  const b = d.members.find((m) => m.id === "m-valentina");
  if (!a || !b) return fail("Faltan los asesores del demo.");
  const first = reserveUnit(d, { ...ctxFor(a), today: ctx.today }, { unitId: unit.id, buyer: { name: "Cliente de Andrés", doc: "10.000.001" }, deposit: 0, days: 3 });
  const second = reserveUnit(d, { ...ctxFor(b), today: ctx.today }, { unitId: unit.id, buyer: { name: "Cliente de Valentina", doc: "10.000.002" }, deposit: 0, days: 3 });
  if (!first.ok) return first;
  return done(`Andrés reservó el Kia Picanto. Valentina, al mismo tiempo, recibió: "${second.ok ? "reservó también (error)" : second.error}"`);
};

/** El mismo evento de la pasarela llega tres veces: un solo pago aplicado. */
export const scenarioDuplicateWebhook: Command<undefined> = (d, ctx) => {
  const p = d.payments.find((x) => x.id === "pay-pending-nequi");
  if (!p || p.status !== "pending") return fail("Este escenario ya se ejecutó. Reinicia el demo para repetirlo.");
  const admin = d.members.find((m) => m.id === "m-carlos");
  if (!admin) return fail("Falta Tesorería en el demo.");
  return replayWebhook(d, { ...ctxFor(admin), today: ctx.today }, { paymentId: p.id, times: 3 });
};

export const scenarioBasicPlan: Command<undefined> = (d, ctx) => {
  const admin = d.members.find((m) => m.id === "m-marcela");
  if (!admin) return fail("Falta el administrador del demo.");
  return changePlan(d, { ...ctxFor(admin), today: ctx.today }, { planId: "basico" });
};
