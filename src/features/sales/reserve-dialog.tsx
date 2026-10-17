"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, MoneyInput, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Notice } from "@/components/ui/surface";
import type { Quote } from "@/domain/types";
import { unitName } from "@/lib/format";
import { useDemo } from "@/store";
import { reserveUnit } from "@/store/commands/sales";
import { unitById } from "@/store/queries";

export function ReserveDialog({ quote, onClose }: { quote: Quote | null; onClose: () => void }) {
  const run = useDemo((s) => s.run);
  const unit = useDemo((s) => (quote ? unitById(s.data, quote.unitId) : undefined));
  const [deposit, setDeposit] = useState(0);
  const [days, setDays] = useState(3);

  return (
    <Dialog
      open={Boolean(quote)}
      onOpenChange={(o) => !o && onClose()}
      title="Reservar la unidad"
      description="Una sola reserva activa por unidad. Si dos asesores lo intentan a la vez, solo uno gana."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!quote) return;
              const r = run(reserveUnit, { unitId: quote.unitId, quoteId: quote.id, buyer: quote.buyer, deposit, days });
              if (r.ok) onClose();
            }}
          >
            Reservar unidad
          </Button>
        </>
      }
    >
      {quote && unit && (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            <strong className="text-ink">{unitName(unit)}</strong> para {quote.buyer.name}.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Plazo de la reserva">
              {(id) => (
                <Select id={id} value={days} onChange={(e) => setDays(Number(e.target.value))}>
                  {[1, 3, 5, 7].map((d) => (
                    <option key={d} value={d}>
                      {d} {d === 1 ? "día" : "días"}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Anticipo (opcional)">{(id) => <MoneyInput id={id} value={deposit} onChange={setDeposit} />}</Field>
          </div>
          <Notice tone="brand">Vencer la reserva libera la unidad, pero no devuelve el anticipo. Un anticipo queda pendiente hasta que Tesorería lo confirme.</Notice>
        </div>
      )}
    </Dialog>
  );
}
