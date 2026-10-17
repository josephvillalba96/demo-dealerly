"use client";

import { create } from "zustand";
import { createSeed } from "@/data/seed";
import { DEMO_TODAY } from "@/domain/dates";
import { setGrants } from "@/domain/rbac";
import type { DemoData, Role } from "@/domain/types";
import type { Command, Ctx, Outcome } from "./engine";
import { execute } from "./execute";

export interface Toast {
  id: number;
  tone: "ok" | "error";
  text: string;
}

export interface Session {
  role: Role;
  userId: string;
}

/** Usuario ficticio por rol: quien "inicia sesión" en el demo. */
export const DEFAULT_USER: Record<Role, string> = {
  admin: "m-marcela",
  asesor: "m-andres",
  tesoreria: "m-carlos",
  cartera: "m-daniela",
  taller: "m-jorge",
};

interface DemoState {
  data: DemoData;
  session: Session;
  toasts: Toast[];
  guideOpen: boolean;
  /** Ejecuta un comando con la sesión actual y muestra el resultado como aviso. */
  run: <A, T>(command: Command<A, T>, args: A) => Outcome<T>;
  signIn: (role: Role) => void;
  reset: () => void;
  dismissToast: (id: number) => void;
  notify: (text: string, tone?: Toast["tone"]) => void;
  toggleGuide: (open?: boolean) => void;
}

let toastSeq = 0;

function ctxOf(state: DemoState): Ctx {
  const member = state.data.members.find((m) => m.id === state.session.userId);
  return { role: state.session.role, userId: state.session.userId, actor: member?.name ?? "Demo", today: DEMO_TODAY };
}

export const useDemo = create<DemoState>((set, get) => ({
  data: createSeed(),
  session: { role: "admin", userId: DEFAULT_USER.admin },
  toasts: [],
  guideOpen: false,
  run: (command, args) => {
    const state = get();
    setGrants(state.data.grants);
    const { data, outcome } = execute(state.data, ctxOf(state), command, args);
    const text = outcome.ok ? outcome.message : outcome.error;
    setGrants(data.grants);
    set({
      data,
      toasts: text ? [...state.toasts.slice(-3), { id: ++toastSeq, tone: outcome.ok ? "ok" : "error", text }] : state.toasts,
    });
    return outcome;
  },
  signIn: (role) => set({ session: { role, userId: DEFAULT_USER[role] } }),
  reset: () => {
    const data = createSeed();
    setGrants(data.grants);
    set({ data, toasts: [{ id: ++toastSeq, tone: "ok", text: "Demo reiniciado con los datos originales." }] });
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  notify: (text, tone = "ok") => set((s) => ({ toasts: [...s.toasts.slice(-3), { id: ++toastSeq, tone, text }] })),
  toggleGuide: (open) => set((s) => ({ guideOpen: open ?? !s.guideOpen })),
}));
