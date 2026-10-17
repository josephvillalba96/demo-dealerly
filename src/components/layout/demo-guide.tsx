"use client";

import { ArrowRight, ArrowsClockwise, Play, X } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/overlay";
import type { Command } from "@/store/engine";
import { scenarioBasicPlan, scenarioDoubleReservation, scenarioDuplicateWebhook } from "@/store/commands/scenarios";
import { useDemo } from "@/store";
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface Scenario {
  title: string;
  why: string;
  steps: string;
  href: string;
  linkLabel: string;
  run?: { label: string; command: Command<undefined, unknown> };
}

const SCENARIOS: Scenario[] = [
  {
    title: "Dos asesores reservan el mismo carro",
    why: "Nadie puede vender dos veces la misma unidad.",
    steps: "Ejecuta el escenario: Andrés y Valentina intentan reservar el Kia Picanto a la vez. Gana uno y el otro recibe un error claro.",
    href: "/ventas",
    linkLabel: "Ver reservas",
    run: { label: "Ejecutar", command: scenarioDoubleReservation as Command<undefined, unknown> },
  },
  {
    title: "La pasarela repite el mismo pago",
    why: "Un evento repetido no duplica dinero ni cuotas.",
    steps: "Ejecuta el escenario: el mismo evento llega 3 veces. Se aplica una sola vez en pagos, cartera y libro.",
    href: "/tesoreria",
    linkLabel: "Ver pagos",
    run: { label: "Ejecutar", command: scenarioDuplicateWebhook as Command<undefined, unknown> },
  },
  {
    title: "Margen real de un carro con taller",
    why: "El costo de reparar suma al carro, no se pierde en gastos generales.",
    steps: "Abre la orden OT-0001, consume la línea pendiente de mano de obra y mira cómo cambia el costo y el margen en el expediente del Ford Escape.",
    href: "/taller/wo1",
    linkLabel: "Ir a la orden OT-0001",
  },
  {
    title: "Mora por franjas de atraso",
    why: "Sabes cuánto se debe y hace cuántos días, a cualquier fecha de corte.",
    steps: "Revisa la cartera: hay créditos en 1 a 30, 31 a 60 y más de 90 días. Registra una gestión de cobro y un pago parcial.",
    href: "/cartera",
    linkLabel: "Ir a cartera",
  },
  {
    title: "Cierre de caja con faltante",
    why: "Cada peso en efectivo pertenece a un turno y la diferencia queda registrada.",
    steps: "En Tesorería, abre la pestaña Caja y cierra la Sede Norte contando menos efectivo del esperado.",
    href: "/tesoreria",
    linkLabel: "Ir a tesorería",
  },
  {
    title: "Subir y bajar de plan",
    why: "Bajar de plan nunca borra datos: pausa lo que excede y bloquea módulos.",
    steps: "Ejecuta el escenario: pasa a Dealer Básico. Se pausan anuncios, se bloquea el crédito propio y el taller sigue consultable.",
    href: "/plan",
    linkLabel: "Ver plan",
    run: { label: "Ejecutar", command: scenarioBasicPlan as Command<undefined, unknown> },
  },
];

export function DemoGuide() {
  const open = useDemo((s) => s.guideOpen);
  const toggle = useDemo((s) => s.toggleGuide);
  const run = useDemo((s) => s.run);
  const reset = useDemo((s) => s.reset);

  return (
    <Drawer open={open} onOpenChange={toggle} title="Guía del demo">
      <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">Guía del demo</h2>
          <p className="mt-1 text-[13px] leading-snug text-muted">Seis escenarios para mostrar a un concesionario. Cada uno enseña una regla que protege su dinero.</p>
        </div>
        <DialogPrimitive.Close aria-label="Cerrar guía" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
          <X size={18} />
        </DialogPrimitive.Close>
      </div>
      <ol className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {SCENARIOS.map((s, i) => (
          <li key={s.title} className="flex gap-3.5">
            <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-[13px] font-semibold text-brand-700">{i + 1}</span>
            <div className="min-w-0">
              <h3 className="text-[14.5px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-0.5 text-[13px] font-medium text-brand-700">{s.why}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.steps}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {s.run && (
                  <Button
                    size="sm"
                    icon={<Play size={14} weight="fill" />}
                    onClick={() => {
                      run(s.run!.command, undefined);
                    }}
                  >
                    {s.run.label}
                  </Button>
                )}
                <Link
                  href={s.href}
                  onClick={() => toggle(false)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line-strong px-3 text-[13px] font-medium text-ink hover:bg-surface"
                >
                  {s.linkLabel}
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
        <p className="text-xs leading-snug text-muted">Cambia de rol desde tu avatar para ver permisos distintos.</p>
        <Button variant="secondary" size="sm" icon={<ArrowsClockwise size={14} />} onClick={reset}>
          Reiniciar demo
        </Button>
      </div>
    </Drawer>
  );
}
