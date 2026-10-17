import type { DemoData } from "@/domain/types";
import { fail, type Command, type Ctx, type Outcome } from "./engine";

/**
 * Ejecuta un comando sobre una copia de los datos. Si falla (o lanza, por ejemplo un asiento
 * desbalanceado) la copia se descarta y los datos originales quedan intactos.
 */
export function execute<A, T>(data: DemoData, ctx: Ctx, command: Command<A, T>, args: A): { data: DemoData; outcome: Outcome<T> } {
  const draft = structuredClone(data);
  try {
    const outcome = command(draft, ctx, args);
    return outcome.ok ? { data: draft, outcome } : { data, outcome };
  } catch (e) {
    return { data, outcome: fail(e instanceof Error ? e.message : "Error inesperado") };
  }
}
