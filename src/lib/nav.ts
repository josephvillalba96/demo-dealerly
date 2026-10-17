import {
  Bank,
  CalendarBlank,
  CarProfile,
  ChartBar,
  Gear,
  HandCoins,
  Megaphone,
  Receipt,
  ShieldCheck,
  SquaresFour,
  Users,
  UsersThree,
  Wrench,
  Crown,
  type Icon,
} from "@phosphor-icons/react";
import type { Section } from "@/domain/rbac";

export interface NavItem {
  section: Section;
  href: string;
  label: string;
  icon: Icon;
}

export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ section: "panel", href: "/panel", label: "Panel", icon: SquaresFour }] },
  {
    label: "Operación",
    items: [
      { section: "inventario", href: "/inventario", label: "Inventario", icon: CarProfile },
      { section: "publicaciones", href: "/publicaciones", label: "Publicaciones", icon: Megaphone },
      { section: "oportunidades", href: "/oportunidades", label: "Oportunidades", icon: UsersThree },
      { section: "agenda", href: "/agenda", label: "Agenda", icon: CalendarBlank },
    ],
  },
  { label: "Comercial", items: [{ section: "ventas", href: "/ventas", label: "Ventas", icon: Receipt }] },
  {
    label: "Dinero",
    items: [
      { section: "cartera", href: "/cartera", label: "Cartera", icon: HandCoins },
      { section: "tesoreria", href: "/tesoreria", label: "Tesorería", icon: Bank },
    ],
  },
  {
    label: "Taller",
    items: [
      { section: "taller", href: "/taller", label: "Taller", icon: Wrench },
      { section: "repuestos", href: "/repuestos", label: "Repuestos", icon: Gear },
    ],
  },
  {
    label: "Empresa",
    items: [
      { section: "reportes", href: "/reportes", label: "Reportes", icon: ChartBar },
      { section: "equipo", href: "/equipo", label: "Equipo", icon: Users },
      { section: "plan", href: "/plan", label: "Plan y módulos", icon: Crown },
      { section: "auditoria", href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
    ],
  },
];

export const SECTION_TITLES: Record<Section, string> = {
  panel: "Panel",
  inventario: "Inventario",
  publicaciones: "Publicaciones",
  oportunidades: "Oportunidades",
  agenda: "Agenda de visitas",
  ventas: "Ventas",
  cartera: "Cartera",
  tesoreria: "Tesorería",
  taller: "Taller",
  repuestos: "Repuestos",
  reportes: "Reportes",
  equipo: "Equipo y permisos",
  plan: "Plan y módulos",
  auditoria: "Auditoría",
};

export function sectionOf(pathname: string): Section | null {
  const first = pathname.split("/")[1] as Section | undefined;
  return first && first in SECTION_TITLES ? first : null;
}
