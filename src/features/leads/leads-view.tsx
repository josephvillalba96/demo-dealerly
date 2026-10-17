"use client";

import { ChatCircle, Phone, Storefront, Globe } from "@phosphor-icons/react";
import Link from "next/link";
import { Card, Notice, PageIntro } from "@/components/ui/surface";
import { Select } from "@/components/ui/form";
import { formatDate } from "@/domain/dates";
import { can } from "@/domain/rbac";
import type { Lead, LeadStatus } from "@/domain/types";
import { unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { assignLead, setLeadStatus } from "@/store/commands/crm";
import { unitById } from "@/store/queries";

const COLUMNS: { status: LeadStatus; title: string }[] = [
  { status: "new", title: "Nuevos" },
  { status: "contacted", title: "Contactados" },
  { status: "appointment", title: "Con cita" },
  { status: "quoted", title: "Con cotización" },
  { status: "won", title: "Cerrados" },
  { status: "lost", title: "Perdidos" },
];

const CHANNEL = {
  marketplace: { label: "Marketplace", icon: Globe },
  whatsapp: { label: "WhatsApp (intento de contacto)", icon: ChatCircle },
  visit: { label: "Visita al patio", icon: Storefront },
  phone: { label: "Llamada", icon: Phone },
} as const;

function LeadCard({ lead }: { lead: Lead }) {
  const data = useDemo((s) => s.data);
  const role = useDemo((s) => s.session.role);
  const run = useDemo((s) => s.run);
  const unit = unitById(data, lead.unitId);
  const Icon = CHANNEL[lead.channel].icon;
  const canWrite = can(role, "lead.write");
  const advisors = data.members.filter((m) => m.role === "asesor" && m.status === "active");
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink">{lead.name}</p>
      {unit && <Link href={`/inventario/${unit.id}`} className="mt-0.5 block text-[13px] text-brand-700 hover:underline">{unitName(unit)}</Link>}
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Icon size={14} />{CHANNEL[lead.channel].label}, {formatDate(lead.createdOn)}</p>
      <p className="num mt-1 text-xs text-muted">{lead.phone}</p>
      {lead.note && <p className="mt-2 text-[13px] text-ink-soft">{lead.note}</p>}
      {canWrite && (
        <div className="mt-3 space-y-2">
          <Select aria-label={`Asesor de ${lead.name}`} value={lead.assigneeId ?? ""} onChange={(e) => run(assignLead, { leadId: lead.id, memberId: e.target.value || null })} className="h-8 text-[13px]">
            <option value="">Sin asignar</option>
            {advisors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select aria-label={`Etapa de ${lead.name}`} value={lead.status} onChange={(e) => run(setLeadStatus, { leadId: lead.id, status: e.target.value as LeadStatus })} className="h-8 text-[13px]">
            {COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.title}</option>)}
          </Select>
        </div>
      )}
    </Card>
  );
}

export function LeadsView() {
  const leads = useDemo((s) => s.data.leads);
  return (
    <>
      <PageIntro>Cada contacto llega al concesionario dueño del anuncio y a un asesor. Tocar el botón de WhatsApp cuenta como intento de contacto, no como conversación confirmada.</PageIntro>
      <div className="mb-5"><Notice tone="brand">El primer contacto cuenta. Los interesados sin asignar se ven también en el panel y en la campana.</Notice></div>
      <div className="flex gap-4 overflow-x-auto pb-3">
        {COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col.status);
          return (
            <section key={col.status} aria-label={col.title} className="w-[16rem] min-w-[16rem] flex-1 rounded-card bg-surface p-3">
              <h3 className="mb-3 flex items-center justify-between px-1 text-[13px] font-semibold text-ink-soft">
                {col.title}
                <span className="num rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{items.length}</span>
              </h3>
              <div className="space-y-3">
                {items.map((l) => <LeadCard key={l.id} lead={l} />)}
                {items.length === 0 && <p className="px-1 py-6 text-center text-[13px] text-muted">Vacío</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
