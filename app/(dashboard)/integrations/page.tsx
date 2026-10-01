import { CircleSlash, Megaphone, PackageSearch, ShoppingBag, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { requireWorkspace } from "@/lib/auth/workspace";
import { listIntegrationStatuses } from "@/lib/db/queries/integrations";

export const metadata: Metadata = { title: "Integrations" };

type Provider = "SHOPIFY" | "META" | "ALIEXPRESS";

const PROVIDERS: { id: Provider; name: string; icon: LucideIcon; description: string; availability: string }[] = [
  {
    id: "SHOPIFY",
    name: "Shopify",
    icon: ShoppingBag,
    description: "Orders, line items, discounts, shipping, taxes and refunds via the GraphQL Admin API.",
    availability: "Coming in the next release",
  },
  {
    id: "META",
    name: "Meta Ads",
    icon: Megaphone,
    description: "Daily spend and performance for campaigns, ad sets and ads.",
    availability: "Coming after Shopify",
  },
  {
    id: "ALIEXPRESS",
    name: "AliExpress",
    icon: PackageSearch,
    description: "Import supplier products, prices and shipping from an AliExpress URL.",
    availability: "Planned",
  },
];

const STATUS: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  CONNECTED: { label: "Connected", variant: "secondary" },
  SYNCING: { label: "Syncing", variant: "secondary" },
  ERROR: { label: "Error", variant: "destructive" },
  DISCONNECTED: { label: "Disconnected", variant: "outline" },
};

export default async function IntegrationsPage() {
  const ctx = await requireWorkspace();
  const rows = await listIntegrationStatuses(ctx.workspace.id);

  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: ctx.workspace.timezone }) : "Never";

  return (
    <>
      <PageHeader title="Integrations" description="Connect your store, ad accounts and suppliers." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((p) => {
          const row = rows.find((r) => r.provider === p.id);
          const status = STATUS[row?.status ?? "DISCONNECTED"];
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <span className="flex size-9 items-center justify-center rounded-md border bg-muted">
                    <p.icon className="size-4" />
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <CardTitle className="mt-3">{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-4 grid gap-1 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Account</span>
                  <span className="truncate">{row?.accountName ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Last sync</span>
                  <span>{fmt(row?.lastSyncAt ?? null)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Last successful</span>
                  <span>{fmt(row?.lastSuccessfulSyncAt ?? null)}</span>
                </div>
                {row?.lastError ? <p className="mt-2 text-xs text-destructive">{row.lastError}</p> : null}
              </CardContent>
              <CardFooter className="mt-6 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CircleSlash className="size-3.5" /> {p.availability}
                </span>
                <Button size="sm" disabled>
                  Connect
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </>
  );
}
