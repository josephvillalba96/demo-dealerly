"use client";

import { CalendarPlus } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, Card, Notice, PageIntro, type Tone } from "@/components/ui/surface";
import { addDays, DEMO_TODAY } from "@/domain/dates";
import { can } from "@/domain/rbac";
import type { Appointment, AppointmentStatus } from "@/domain/types";
import { formatDateTime, unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { memberName } from "@/store/engine";
import { appointmentAction, createAppointment } from "@/store/commands/crm";
import { unitById } from "@/store/queries";

const STATUS: Record<AppointmentStatus, { label: string; tone: Tone }> = {
  requested: { label: "Solicitada, sin confirmar", tone: "warn" },
  confirmed: { label: "Confirmada", tone: "ok" },
  rescheduled: { label: "Reprogramada", tone: "brand" },
  cancelled: { label: "Cancelada", tone: "neutral" },
  attended: { label: "Asistió", tone: "ok" },
  no_show: { label: "No asistió", tone: "bad" },
};

export function AgendaView() {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [kind, setKind] = useState<"visit" | "test_drive">("visit");
  const [date, setDate] = useState(addDays(DEMO_TODAY, 2));
  const [time, setTime] = useState("10:00");
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState(addDays(DEMO_TODAY, 3));
  const canWrite = can(role, "lead.write");

  const sorted = useMemo(() => [...data.appointments].sort((a, b) => a.slot.localeCompare(b.slot)), [data.appointments]);
  const upcoming = sorted.filter((a) => a.slot.slice(0, 10) >= DEMO_TODAY);
  const past = sorted.filter((a) => a.slot.slice(0, 10) < DEMO_TODAY).reverse();
  const openLeads = data.leads.filter((l) => !["won", "lost"].includes(l.status));

  const renderRow = (a: Appointment, withActions: boolean) => {
    const lead = data.leads.find((l) => l.id === a.leadId);
    const unit = unitById(data, a.unitId);
    return (
      <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="w-36 shrink-0">
          <p className="num text-sm font-semibold text-ink">{formatDateTime(a.slot)}</p>
          <p className="text-xs text-muted">{a.kind === "visit" ? "Visita" : "Prueba de manejo"}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{lead?.name}</p>
          <p className="truncate text-[13px] text-muted">{unit ? unitName(unit) : ""}, atiende {memberName(data, a.responsibleId)}</p>
        </div>
        <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
        {withActions && canWrite && (
          <div className="flex flex-wrap gap-2">
            {(a.status === "requested" || a.status === "rescheduled") && <Button size="sm" onClick={() => run(appointmentAction, { id: a.id, status: "confirmed" })}>Confirmar</Button>}
            {["requested", "confirmed", "rescheduled"].includes(a.status) && (
              <>
                <Button size="sm" variant="secondary" onClick={() => { setRescheduling(a); setNewDate(a.slot.slice(0, 10)); }}>Reprogramar</Button>
                <Button size="sm" variant="ghost" onClick={() => run(appointmentAction, { id: a.id, status: "cancelled" })}>Cancelar</Button>
              </>
            )}
            {a.status === "confirmed" && (
              <>
                <Button size="sm" variant="secondary" onClick={() => run(appointmentAction, { id: a.id, status: "attended" })}>Asistió</Button>
                <Button size="sm" variant="ghost" onClick={() => run(appointmentAction, { id: a.id, status: "no_show" })}>No asistió</Button>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      <PageIntro actions={canWrite && <Button icon={<CalendarPlus size={16} />} onClick={() => setOpen(true)}>Programar visita</Button>}>
        Una solicitud enviada no es una cita confirmada: queda pendiente hasta que el vendedor la confirma. Reprogramar y cancelar conservan su historial.
      </PageIntro>
      <div className="space-y-6">
        <Card>
          <h2 className="border-b border-line px-5 py-4 text-[15px] font-semibold text-ink">Próximas</h2>
          <ul className="divide-y divide-line">{upcoming.length ? upcoming.map((a) => renderRow(a, true)) : <li className="px-5 py-8 text-center text-sm text-muted">No hay visitas próximas.</li>}</ul>
        </Card>
        <Card>
          <h2 className="border-b border-line px-5 py-4 text-[15px] font-semibold text-ink">Anteriores</h2>
          <ul className="divide-y divide-line">{past.map((a) => renderRow(a, false))}</ul>
        </Card>
        <Notice tone="neutral">Las citas no se pueden programar fuera del horario de la sede (8:00 a 18:00) ni cruzarse sobre la misma unidad.</Notice>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Programar visita o prueba de manejo"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!leadId} onClick={() => { const r = run(createAppointment, { leadId, kind, slot: `${date}T${time}` }); if (r.ok) setOpen(false); }}>Solicitar cita</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Interesado">{(id) => <Select id={id} value={leadId} onChange={(e) => setLeadId(e.target.value)}><option value="">Elige un interesado</option>{openLeads.map((l) => <option key={l.id} value={l.id}>{l.name}, {unitById(data, l.unitId)?.model}</option>)}</Select>}</Field>
          <Field label="Tipo">{(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as "visit" | "test_drive")}><option value="visit">Visita</option><option value="test_drive">Prueba de manejo</option></Select>}</Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha">{(id) => <Input id={id} type="date" value={date} min={DEMO_TODAY} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Hora" hint="Entre 8:00 y 17:59">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(rescheduling)}
        onOpenChange={(o) => !o && setRescheduling(null)}
        title="Reprogramar cita"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRescheduling(null)}>Cancelar</Button>
            <Button onClick={() => { if (!rescheduling) return; const r = run(appointmentAction, { id: rescheduling.id, status: "rescheduled", slot: `${newDate}T${rescheduling.slot.slice(11)}` }); if (r.ok) setRescheduling(null); }}>Reprogramar</Button>
          </>
        }
      >
        <Field label="Nueva fecha">{(id) => <Input id={id} type="date" value={newDate} min={DEMO_TODAY} onChange={(e) => setNewDate(e.target.value)} />}</Field>
      </Dialog>
    </>
  );
}
