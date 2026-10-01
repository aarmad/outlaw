"use client";

import { RefreshCw, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { IsoDate } from "@/lib/dates";
import { DateRangePicker } from "./date-range-picker";
import { UserMenu } from "./user-menu";

export interface AppHeaderProps {
  today: IsoDate;
  email: string;
  demoMode: boolean;
  activeStoreName: string | null;
  lastSyncAt: string | null;
  canSync: boolean;
}

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function AppHeader({ today, email, demoMode, activeStoreName, lastSyncAt, canSync }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <Store className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{activeStoreName ?? "No store connected"}</span>
        {demoMode ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="shrink-0">
                Demo data
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Figures are generated sample data. Turn it off in Settings.</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground lg:inline">
          {lastSyncAt ? `Last sync ${relativeTime(lastSyncAt)}` : "Never synced"}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span keeps the tooltip working on a disabled button */}
            <span tabIndex={canSync ? undefined : 0}>
              <Button variant="outline" size="sm" disabled={!canSync} className="hidden sm:inline-flex">
                <RefreshCw /> Sync
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {canSync ? "Sync your connected accounts now" : "Connect Shopify or Meta Ads to enable syncing."}
          </TooltipContent>
        </Tooltip>
        <DateRangePicker today={today} />
        <UserMenu email={email} />
      </div>
    </header>
  );
}
