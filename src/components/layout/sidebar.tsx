"use client";

import { Lock, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canSee, can } from "@/domain/rbac";
import { cn } from "@/lib/cn";
import { NAV_GROUPS } from "@/lib/nav";
import { useDemo } from "@/store";
import { Logo } from "./logo";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const role = useDemo((s) => s.session.role);
  return (
    <div className="flex h-full flex-col px-4 pt-6 pb-4">
      <Link href="/panel" onClick={onNavigate} className="mb-7 px-2" aria-label="Ir al panel">
        <Logo />
      </Link>
      <nav aria-label="Principal" className="flex-1 space-y-5 overflow-y-auto pr-1">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label ?? i}>
            {group.label && <p className="mb-1.5 px-3 text-xs font-medium text-muted">{group.label}</p>}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const allowed = canSee(role, item.section);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-control px-3 text-sm font-medium transition",
                        active ? "bg-surface text-ink" : allowed ? "text-ink-soft hover:bg-surface/70" : "text-muted hover:bg-surface/70",
                      )}
                    >
                      <Icon size={20} weight={active ? "fill" : "regular"} className={active ? "text-brand-500" : "text-muted"} />
                      <span className="flex-1">{item.label}</span>
                      {!allowed && <Lock size={14} aria-label="Sin acceso con tu rol" className="text-muted" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {can(role, "inventory.write") && (
        <div className="mt-4 rounded-card bg-surface p-3 text-center">
          <p className="px-2 pt-1 text-[13px] leading-snug text-muted">Publica tu próximo vehículo con fotos guiadas y documentos en regla.</p>
          <Link
            href="/inventario/nuevo"
            onClick={onNavigate}
            className="mt-3 flex h-10 items-center justify-center gap-2 rounded-control bg-canvas text-sm font-semibold text-ink shadow-card transition hover:bg-brand-50"
          >
            <Plus size={16} weight="bold" className="text-brand-500" />
            Registrar vehículo
          </Link>
        </div>
      )}
    </div>
  );
}
