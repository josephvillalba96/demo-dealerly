"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}

const WIDTHS = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

export function Dialog({ open, onOpenChange, title, description, children, footer, width = "md" }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand-900/35 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className={cn("fixed top-1/2 left-1/2 z-50 flex max-h-[88dvh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-line bg-canvas shadow-pop", WIDTHS[width])}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div>
              <DialogPrimitive.Title className="text-base font-semibold text-ink">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className={cn("mt-0.5 text-[13px] text-muted", !description && "sr-only")}>{description ?? title}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close aria-label="Cerrar" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink">
              <X size={18} />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Panel lateral deslizante, usado para la guía del demo y la navegación en móvil. */
export function Drawer({ open, onOpenChange, title, side = "right", children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; side?: "left" | "right"; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-brand-900/30" />
        <DialogPrimitive.Content
          className={cn("fixed top-0 z-50 flex h-dvh w-[min(24rem,92vw)] flex-col bg-canvas shadow-pop", side === "right" ? "right-0 border-l border-line" : "left-0 border-r border-line")}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({ children, className, align = "end" }: { children: ReactNode; className?: string; align?: "start" | "end" }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content align={align} sideOffset={8} className={cn("z-50 min-w-56 rounded-card border border-line bg-canvas p-1.5 shadow-pop", className)}>
        {children}
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({ children, onSelect, icon, tone, disabled }: { children: ReactNode; onSelect?: () => void; icon?: ReactNode; tone?: "danger"; disabled?: boolean }) {
  return (
    <MenuPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-ink outline-none data-[disabled]:opacity-45 data-[highlighted]:bg-surface",
        tone === "danger" && "text-bad",
      )}
    >
      {icon && <span className="text-muted">{icon}</span>}
      {children}
    </MenuPrimitive.Item>
  );
}

export const MenuLabel = ({ children }: { children: ReactNode }) => <MenuPrimitive.Label className="px-3 pt-2 pb-1 text-xs font-medium text-muted">{children}</MenuPrimitive.Label>;
export const MenuSeparator = () => <MenuPrimitive.Separator className="my-1.5 h-px bg-line" />;
