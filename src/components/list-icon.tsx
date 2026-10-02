import type { ComponentType } from "react";
import {
  IconBell,
  IconBook,
  IconBookmark,
  IconBriefcase,
  IconBug,
  IconBulb,
  IconCalendar,
  IconChartBar,
  IconChecklist,
  IconCode,
  IconFlag,
  IconFlask,
  IconHeart,
  IconHome,
  IconInbox,
  IconList,
  IconLock,
  IconPalette,
  IconRocket,
  IconShoppingCart,
  IconSpeakerphone,
  IconStar,
  IconTarget,
  IconUsers,
} from "@tabler/icons-react";
import { isListIconKey, type ListIconKey } from "@/lib/list-icons";

export const LIST_ICON_COMPONENTS: Record<
  ListIconKey,
  ComponentType<{ className?: string }>
> = {
  list: IconList,
  inbox: IconInbox,
  checklist: IconChecklist,
  target: IconTarget,
  flag: IconFlag,
  star: IconStar,
  bookmark: IconBookmark,
  bug: IconBug,
  bulb: IconBulb,
  rocket: IconRocket,
  calendar: IconCalendar,
  chart: IconChartBar,
  code: IconCode,
  palette: IconPalette,
  megaphone: IconSpeakerphone,
  heart: IconHeart,
  home: IconHome,
  briefcase: IconBriefcase,
  users: IconUsers,
  shopping: IconShoppingCart,
  book: IconBook,
  flask: IconFlask,
  bell: IconBell,
  lock: IconLock,
};

/** The Tabler icon for a List.icon key; null / unknown renders the default list icon. */
export function ListIcon({
  icon,
  className,
}: {
  icon: string | null;
  className?: string;
}) {
  const key = isListIconKey(icon) ? icon : "list";
  const Glyph = LIST_ICON_COMPONENTS[key];
  return <Glyph className={className} />;
}
