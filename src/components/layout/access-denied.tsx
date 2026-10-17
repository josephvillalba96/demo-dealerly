"use client";

import { LockKey } from "@phosphor-icons/react";
import Link from "next/link";
import { ROLE_LABELS, rolesFor, type Section } from "@/domain/rbac";
import { SECTION_TITLES } from "@/lib/nav";
import { useDemo } from "@/store";

export function AccessDenied({ section }: { section: Section }) {
  const role = useDemo((s) => s.session.role);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
        <LockKey size={28} weight="fill" />
      </span>
      <h2 className="mt-5 text-xl font-semibold text-ink">Acceso no disponible para este rol</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Estás viendo la plataforma como <strong className="text-ink-soft">{ROLE_LABELS[role]}</strong>. <em className="not-italic">{SECTION_TITLES[section]}</em> requiere:{" "}
        {rolesFor(section).map((r) => ROLE_LABELS[r]).join(", ")}.
      </p>
      <p className="mt-2 text-[13px] text-muted">En el producto real el servidor rechaza la petición; ocultar el botón no es el control.</p>
      <Link href="/panel" className="mt-6 inline-flex h-10 items-center rounded-control bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600">
        Volver al panel
      </Link>
    </div>
  );
}
