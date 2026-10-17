"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabDef {
  value: string;
  label: string;
  count?: number;
  content: ReactNode;
}

/** Pestañas con barra inferior violeta. El contenido se monta solo cuando la pestaña está activa. */
export function Tabs({ tabs, defaultValue, className }: { tabs: TabDef[]; defaultValue?: string; className?: string }) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <TabsPrimitive.List className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="Secciones">
        {tabs.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className={cn(
              "relative -mb-px flex items-center gap-2 border-b-2 border-transparent px-3.5 py-2.5 text-sm font-medium whitespace-nowrap text-muted transition hover:text-ink",
              "data-[state=active]:border-brand-500 data-[state=active]:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="num rounded-full bg-surface px-1.5 py-px text-xs text-ink-soft">{t.count}</span>}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {tabs.map((t) => (
        <TabsPrimitive.Content key={t.value} value={t.value} className="outline-none">
          {t.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
