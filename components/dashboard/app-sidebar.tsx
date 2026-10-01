"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NAV_ITEMS, PERSISTED_PARAMS } from "./nav";

export function AppSidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const persisted = new URLSearchParams();
  for (const key of PERSISTED_PARAMS) {
    const v = searchParams.get(key);
    if (v) persisted.set(key, v);
  }
  const suffix = persisted.size > 0 ? `?${persisted.toString()}` : "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href={`/dashboard${suffix}`}>
                <LogoMark />
                <span className="grid leading-tight">
                  <span className="font-semibold tracking-tight">Outlaw</span>
                  <span className="truncate text-xs text-muted-foreground">{workspaceName}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={`${item.href}${suffix}`}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 pb-4 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        MVP · Phase 1
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
