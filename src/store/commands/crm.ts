import type { AppointmentStatus, LeadStatus } from "@/domain/types";
import { audit, denied, done, fail, uid, type Command } from "../engine";
import { unitById, unitLabel } from "../queries";

export const assignLead: Command<{ leadId: string; memberId: string | null }> = (d, ctx, a) => {
  const no = denied(ctx, "lead.write");
  if (no) return no;
  const lead = d.leads.find((l) => l.id === a.leadId);
  if (!lead) return fail("Lead no encontrado.");
  lead.assigneeId = a.memberId;
  if (a.memberId && lead.status === "new") lead.status = "contacted";
  audit(d, ctx, `Asignó el lead de ${lead.name}`, `lead ${lead.id}`);
  return done("Lead asignado.");
};

export const setLeadStatus: Command<{ leadId: string; status: LeadStatus }> = (d, ctx, a) => {
  const no = denied(ctx, "lead.write");
  if (no) return no;
  const lead = d.leads.find((l) => l.id === a.leadId);
  if (!lead) return fail("Lead no encontrado.");
  lead.status = a.status;
  audit(d, ctx, `Cambió el lead de ${lead.name} a ${a.status}`, `lead ${lead.id}`);
  return done();
};

export const createAppointment: Command<{ leadId: string; kind: "visit" | "test_drive"; slot: string }> = (d, ctx, a) => {
  const no = denied(ctx, "lead.write");
  if (no) return no;
  const lead = d.leads.find((l) => l.id === a.leadId);
  if (!lead) return fail("Lead no encontrado.");
  const unit = unitById(d, lead.unitId);
  if (!unit) return fail("Unidad no encontrada.");
  const hour = Number(a.slot.slice(11, 13));
  if (!a.slot || Number.isNaN(hour) || hour < 8 || hour >= 18) return fail("La franja debe estar dentro del horario de la sede (8:00 a 18:00).");
  const clash = d.appointments.find((x) => x.unitId === unit.id && x.slot === a.slot && !["cancelled", "no_show"].includes(x.status));
  if (clash) return fail("Esa unidad ya tiene una cita en esa franja. Propón otra hora.");
  d.appointments.push({ id: uid(d, "ap"), leadId: lead.id, unitId: unit.id, kind: a.kind, slot: a.slot, status: "requested", responsibleId: lead.assigneeId ?? ctx.userId });
  if (lead.status === "new" || lead.status === "contacted") lead.status = "appointment";
  audit(d, ctx, `Programó ${a.kind === "visit" ? "visita" : "prueba de manejo"} de ${unitLabel(unit)}`, `lead ${lead.id}`);
  return done("Cita solicitada. Queda pendiente hasta que el vendedor la confirme.");
};

export const appointmentAction: Command<{ id: string; status: AppointmentStatus; slot?: string }> = (d, ctx, a) => {
  const no = denied(ctx, "lead.write");
  if (no) return no;
  const ap = d.appointments.find((x) => x.id === a.id);
  if (!ap) return fail("Cita no encontrada.");
  ap.status = a.status;
  if (a.status === "rescheduled" && a.slot) ap.slot = a.slot;
  audit(d, ctx, `Cita ${ap.id}: ${a.status}`, `cita ${ap.id}`);
  return done(a.status === "confirmed" ? "Cita confirmada con el comprador." : "Cita actualizada.");
};
