"use client";

import { useSearchParams } from "next/navigation";
import { Card, Notice, PageIntro } from "@/components/ui/surface";
import { Tabs } from "@/components/ui/tabs";
import { hasModule } from "@/domain/entitlements";
import { useDemo } from "@/store";
import { CatalogTab } from "./catalog-tab";
import { CounterTab } from "./counter-tab";
import { KardexTab } from "./kardex-tab";
import { PurchasesTab } from "./purchases-tab";

export function PartsView() {
  const params = useSearchParams();
  const enabled = useDemo((s) => hasModule(s.data.subscription, "parts_counter"));
  return (
    <>
      <PageIntro>El kardex es la verdad de las existencias: el saldo sale de sumar movimientos y el costo es el promedio ponderado, no el último precio de compra.</PageIntro>
      {!enabled && <div className="mb-6"><Notice tone="warn" title="Repuestos y mostrador no incluido en tu plan">Puedes consultar lo existente. Actívalo como complemento en Plan y módulos para comprar, vender y ajustar.</Notice></div>}
      <Card className="p-5">
        <Tabs
          defaultValue={params.get("tab") ?? "catalogo"}
          tabs={[
            { value: "catalogo", label: "Catálogo y existencias", content: <CatalogTab enabled={enabled} /> },
            { value: "kardex", label: "Kardex", content: <KardexTab /> },
            { value: "compras", label: "Compras", content: <PurchasesTab enabled={enabled} /> },
            { value: "mostrador", label: "Mostrador", content: <CounterTab enabled={enabled} /> },
          ]}
        />
      </Card>
    </>
  );
}
