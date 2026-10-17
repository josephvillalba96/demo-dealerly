"use client";

import { ArrowRight, CarProfile, Handshake, Wrench, Wallet, UserCircleGear, ChartLineUp } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { ROLE_BLURBS, ROLE_LABELS } from "@/domain/rbac";
import type { Role } from "@/domain/types";
import { cn } from "@/lib/cn";
import { DEFAULT_USER, useDemo } from "@/store";

const ROLE_ICONS: Record<Role, typeof Wrench> = {
  admin: UserCircleGear,
  asesor: Handshake,
  tesoreria: Wallet,
  cartera: ChartLineUp,
  taller: Wrench,
};

export function LoginView() {
  const router = useRouter();
  const signIn = useDemo((s) => s.signIn);
  const members = useDemo((s) => s.data.members);
  const [role, setRole] = useState<Role>("admin");
  const user = members.find((m) => m.id === DEFAULT_USER[role]);

  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative m-3 hidden overflow-hidden rounded-[28px] bg-brand-500 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_20%_0%,rgb(255_255_255/0.28),transparent_55%),linear-gradient(160deg,var(--color-brand-500),var(--color-brand-700)_60%,var(--color-brand-900))]" aria-hidden />
        <CarProfile aria-hidden size={560} weight="thin" className="absolute -right-24 bottom-20 text-white/10" />
        <div className="relative p-12 pt-14">
          <h2 className="max-w-md text-[56px] leading-[1.05] font-semibold tracking-tight">Un solo lugar para tu patio, tu caja y tu cartera</h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-white/80">Inventario por unidad, ventas, créditos y taller con el dinero siempre conciliado.</p>
        </div>
        <div className="relative flex items-center justify-between gap-4 bg-brand-900/70 px-12 py-6 backdrop-blur">
          <p className="text-[15px] font-medium">Esto es una demostración con datos ficticios.</p>
          <span className="rounded-control bg-white/15 px-4 py-2 text-sm font-medium">Barranquilla, Colombia</span>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          <div className="flex justify-center">
            <Logo />
          </div>
          <h1 className="mt-8 text-center text-[32px] font-bold tracking-tight text-ink">Entra al demo</h1>
          <p className="mt-1.5 text-center text-sm text-muted">Elige con qué rol quieres recorrer la plataforma.</p>

          <div role="radiogroup" aria-label="Rol del demo" className="mt-8 space-y-2.5">
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => {
              const Icon = ROLE_ICONS[r];
              const selected = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRole(r)}
                  className={cn(
                    "flex w-full items-start gap-3.5 rounded-card border p-4 text-left transition",
                    selected ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/15" : "border-line hover:border-line-strong hover:bg-surface/60",
                  )}
                >
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", selected ? "bg-brand-500 text-white" : "bg-surface text-ink-soft")}>
                    <Icon size={22} weight={selected ? "fill" : "regular"} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold text-ink">{ROLE_LABELS[r]}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">{ROLE_BLURBS[r]}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <Button
            className="mt-6 h-12 w-full text-[15px]"
            icon={undefined}
            onClick={() => {
              signIn(role);
              router.push("/panel");
            }}
          >
            Entrar como {user?.name.split(" ")[0]}
            <ArrowRight size={18} weight="bold" />
          </Button>
          <p className="mt-4 text-center text-[13px] text-muted">Sin contraseña: es un demo. Podrás cambiar de rol en cualquier momento desde tu avatar.</p>
        </div>
      </section>
    </div>
  );
}
