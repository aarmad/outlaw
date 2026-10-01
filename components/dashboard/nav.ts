import {
  BarChart3,
  Lightbulb,
  LayoutDashboard,
  Megaphone,
  Package,
  Plug,
  Receipt,
  Settings,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package },
  { href: "/offers", label: "Offers", icon: Tags },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/orders", label: "Orders", icon: Receipt },
  { href: "/profit", label: "Profit", icon: BarChart3 },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Query params that persist across navigation (the selected date range). */
export const PERSISTED_PARAMS = ["range", "from", "to"] as const;
