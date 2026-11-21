// Íconos de línea (lucide-react) para hábitos/subhábitos y bloques del
// Plan — reemplazan los emoji de antes. Se guardan por NOMBRE
// (activities.icon, text) y se resuelven acá; nunca se guarda el
// componente ni el emoji. Módulo plano (sin "use client"): son
// componentes presentacionales puros, se importan igual desde server o
// client components.
import {
  Sun,
  Moon,
  BedDouble,
  Droplet,
  Smile,
  ShowerHead,
  BookOpen,
  HandHeart,
  Shirt,
  Broom,
  ChefHat,
  Dumbbell,
  Footprints,
  Sparkles,
  Trash2,
  WashingMachine,
  Sprout,
  Flower2,
  Coffee,
  Salad,
  Soup,
  Flame,
  Baby,
  Dog,
  Cat,
  Phone,
  Pencil,
  NotebookPen,
  Music,
  Paintbrush,
  Bike,
  Home,
  Wallet,
  PiggyBank,
  Glasses,
  Leaf,
  Stethoscope,
  Brain,
  Clock,
  Star,
  Circle,
  Repeat,
  Heart,
  Utensils,
  Handshake,
  SkipForward,
  type LucideIcon,
} from "lucide-react";

// ~40 íconos relevantes para el selector "Ícono" del menú de cada hábito.
export const HABIT_ICONS: Record<string, LucideIcon> = {
  Sun,
  Moon,
  BedDouble,
  Droplet,
  Smile,
  ShowerHead,
  BookOpen,
  HandHeart,
  Shirt,
  Broom,
  ChefHat,
  Dumbbell,
  Footprints,
  Sparkles,
  Trash2,
  WashingMachine,
  Sprout,
  Flower2,
  Coffee,
  Salad,
  Soup,
  Flame,
  Baby,
  Dog,
  Cat,
  Phone,
  Pencil,
  NotebookPen,
  Music,
  Paintbrush,
  Bike,
  Home,
  Wallet,
  PiggyBank,
  Glasses,
  Leaf,
  Stethoscope,
  Brain,
  Clock,
  Star,
};

export const HABIT_ICON_NAMES = Object.keys(HABIT_ICONS);

// Default por plan_blocks.kind — mismo vocabulario que PLAN_KINDS (lib/
// plan/kinds.ts) pero en ícono de línea en vez de emoji.
export const BLOCK_KIND_ICONS: Record<string, LucideIcon> = {
  ingresos: Wallet,
  juntos: Handshake,
  cuidado: Heart,
  comida: Utensils,
  casa: Home,
  rutina: Repeat,
  descanso: Moon,
  cita: Phone,
  secundarios: SkipForward,
};

// Genérico para cualquier hábito/subhábito sin activities.icon propio.
export const GENERIC_HABIT_ICON: LucideIcon = Circle;

export function BlockIcon({ kind, className }: { kind: string | null; className?: string }) {
  const Icon = (kind && BLOCK_KIND_ICONS[kind]) || Circle;
  return <Icon className={className} aria-hidden />;
}

export function HabitIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Icon = (icon && HABIT_ICONS[icon]) || GENERIC_HABIT_ICON;
  return <Icon className={className} aria-hidden />;
}
