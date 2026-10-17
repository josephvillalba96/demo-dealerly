"use client";

import { ArrowsClockwise, Bell, BookOpenText, Check, List, MagnifyingGlass, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { DEMO_TODAY } from "@/domain/dates";
import { ROLE_LABELS } from "@/domain/rbac";
import type { Role } from "@/domain/types";
import { noticesFor } from "@/features/panel/notices";
import { cn } from "@/lib/cn";
import { SECTION_TITLES, sectionOf } from "@/lib/nav";
import { useDemo } from "@/store";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";

const ROLES = Object.keys(ROLE_LABELS) as Role[];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}

export function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { role, userId } = useDemo((s) => s.session);
  const data = useDemo((s) => s.data);
  const { signIn, reset, toggleGuide, notify } = useDemo.getState();
  const section = sectionOf(pathname);
  const me = data.members.find((m) => m.id === userId);
  const notices = useMemo(() => noticesFor(role, data, DEMO_TODAY), [role, data]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/inventario?q=${encodeURIComponent(q)}` : "/inventario");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur sm:px-8">
      <button type="button" onClick={onOpenNav} aria-label="Abrir menú" className="rounded-lg p-2 text-ink-soft hover:bg-surface lg:hidden">
        <List size={22} />
      </button>
      <h1 className="truncate text-[26px] font-bold tracking-tight text-ink">{section ? SECTION_TITLES[section] : "Dealerly"}</h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <form onSubmit={submit} role="search" className="relative hidden md:block">
          <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar en el inventario"
            placeholder="Buscar placa, VIN o modelo"
            className="h-10 w-64 rounded-control border border-transparent bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted focus:border-brand-500 focus:bg-canvas focus:outline-none"
          />
        </form>

        <Menu>
          <MenuTrigger aria-label={`Pendientes: ${notices.length}`} className="relative rounded-full p-2 text-ink-soft hover:bg-surface">
            <Bell size={22} />
            {notices.length > 0 && <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-bad ring-2 ring-canvas" />}
          </MenuTrigger>
          <MenuContent className="w-[22rem] max-w-[92vw]">
            <MenuLabel>Pendientes para tu rol</MenuLabel>
            {notices.length === 0 && <p className="px-3 py-4 text-sm text-muted">No tienes pendientes. Buen trabajo.</p>}
            {notices.slice(0, 6).map((n) => (
              <Link key={n.id} href={n.href} className="block rounded-lg px-3 py-2.5 outline-none hover:bg-surface focus-visible:bg-surface">
                <p className="text-[13.5px] font-medium text-ink">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted">{n.detail}</p>
              </Link>
            ))}
            <MenuSeparator />
            <Link href="/panel" className="block rounded-lg px-3 py-2 text-[13px] font-medium text-brand-700 hover:bg-surface">
              Ver todo en el panel
            </Link>
          </MenuContent>
        </Menu>

        <Menu>
          <MenuTrigger aria-label="Menú de usuario" className="flex items-center gap-3 rounded-full outline-offset-4">
            <span className="hidden text-right lg:block">
              <span className="block text-[13px] leading-tight font-semibold text-ink">{me?.name}</span>
              <span className="block text-xs text-muted">{ROLE_LABELS[role]}</span>
            </span>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 ring-2 ring-brand-500 ring-offset-2">{me ? initials(me.name) : "?"}</span>
          </MenuTrigger>
          <MenuContent>
            <MenuLabel>Ver la plataforma como</MenuLabel>
            {ROLES.map((r) => (
              <MenuItem
                key={r}
                icon={role === r ? <Check size={16} weight="bold" className="text-brand-500" /> : <span className="inline-block w-4" />}
                onSelect={() => {
                  signIn(r);
                  notify(`Ahora ves la plataforma como ${ROLE_LABELS[r]}. Los permisos cambian.`);
                }}
              >
                <span className={cn(role === r && "text-brand-700")}>{ROLE_LABELS[r]}</span>
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuItem icon={<BookOpenText size={18} />} onSelect={() => toggleGuide(true)}>
              Guía del demo
            </MenuItem>
            <MenuItem icon={<ArrowsClockwise size={18} />} onSelect={reset}>
              Reiniciar demo
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<SignOut size={18} />} onSelect={() => router.push("/ingresar")}>
              Salir
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
