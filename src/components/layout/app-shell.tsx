"use client";

import { BookOpenText } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Drawer } from "@/components/ui/overlay";
import { Toaster } from "@/components/ui/toaster";
import { canSee } from "@/domain/rbac";
import { sectionOf } from "@/lib/nav";
import { useDemo } from "@/store";
import { AccessDenied } from "./access-denied";
import { DemoGuide } from "./demo-guide";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const role = useDemo((s) => s.session.role);
  const toggleGuide = useDemo((s) => s.toggleGuide);
  const [navOpen, setNavOpen] = useState(false);
  const section = sectionOf(pathname);
  const allowed = section ? canSee(role, section) : true;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 border-r border-line lg:block">
        <SidebarContent />
      </aside>
      <Drawer open={navOpen} onOpenChange={setNavOpen} title="Navegación" side="left">
        <SidebarContent onNavigate={() => setNavOpen(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <div className="flex items-center justify-between gap-3 bg-brand-50 px-4 py-2 text-[13px] text-brand-900 sm:px-8">
          <p>Demo con datos ficticios. Nada de lo que hagas aquí es real y puedes reiniciarlo cuando quieras.</p>
          <button type="button" onClick={() => toggleGuide(true)} className="flex shrink-0 items-center gap-1.5 font-semibold text-brand-700 hover:underline">
            <BookOpenText size={16} />
            Guía del demo
          </button>
        </div>
        <main className="flex-1 px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-[1280px]">{allowed || !section ? children : <AccessDenied section={section} />}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-muted sm:px-8">
          <p>
            <span className="mr-4 font-semibold text-ink">Política de privacidad</span>
            <span className="mr-4 font-semibold text-ink">Términos de uso</span>© 2026 Dealerly. Marca de trabajo.
          </p>
          <p className="flex items-center gap-4 font-semibold text-ink">
            <span>Español</span>
            <span>COP</span>
          </p>
        </footer>
      </div>
      <DemoGuide />
      <Toaster />
    </div>
  );
}
