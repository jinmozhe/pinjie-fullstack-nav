import type { NavCategoryRead } from "@pinjie/api-client";
import {
  Blocks, BookOpen, ChartColumn, Cloud, Code, Database, Folder, Gamepad2, Globe,
  GraduationCap, Image, MessageCircle, Music, Newspaper, Palette, Plug, Shield,
  ShoppingBag, Sparkles, Video, Wrench, type LucideIcon,
} from "lucide-react";

const categoryIcons: Record<NonNullable<NavCategoryRead["icon_key"]>, LucideIcon> = {
  code: Code,
  book: BookOpen,
  tool: Wrench,
  app: Blocks,
  globe: Globe,
  cloud: Cloud,
  database: Database,
  api: Plug,
  design: Palette,
  image: Image,
  video: Video,
  music: Music,
  ai: Sparkles,
  chart: ChartColumn,
  education: GraduationCap,
  news: Newspaper,
  community: MessageCircle,
  shopping: ShoppingBag,
  game: Gamepad2,
  security: Shield,
};

export function CategoryIcon({ value }: { value: NavCategoryRead["icon_key"] }) {
  const Icon = value == null ? Folder : categoryIcons[value];
  return <Icon size={18} aria-hidden="true" />;
}
