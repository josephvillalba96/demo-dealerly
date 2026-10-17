import { CarProfile } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/cn";

/** Marca de trabajo (el nombre definitivo sigue abierto, DEC-02). */
export function Logo({ withName = true, className }: { withName?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-600 text-white shadow-[0_4px_12px_-4px_rgb(91_73_224/0.6)]">
        <CarProfile size={20} weight="fill" />
      </span>
      {withName && <span className="text-[17px] font-semibold tracking-tight text-ink">Dealerly</span>}
    </div>
  );
}
