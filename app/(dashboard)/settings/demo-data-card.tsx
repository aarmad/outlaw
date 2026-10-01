"use client";

import { Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { clearDemoDataAction, loadDemoDataAction } from "./actions";

export function DemoDataCard({
  canEdit,
  demoMode,
  seededAt,
}: {
  canEdit: boolean;
  demoMode: boolean;
  seededAt: string | null;
}) {
  const [pending, start] = useTransition();

  const run = (fn: typeof loadDemoDataAction) =>
    start(async () => {
      const res = await fn();
      if (res.error) toast.error(res.error);
      else if (res.message) toast.success(res.message);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Demo data {demoMode ? <Badge variant="secondary">On</Badge> : <Badge variant="outline">Off</Badge>}
        </CardTitle>
        <CardDescription>
          Realistic sample data (3 products, 5 campaigns, 20 ads, ~300 orders over 30 days) so you can explore
          everything before connecting Shopify and Meta.
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-4 text-sm text-muted-foreground">
        {demoMode && seededAt
          ? `Generated on ${new Date(seededAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}. Regenerate to move the 30-day window to today.`
          : "Demo rows are kept separate and removing them never touches your own products or orders."}
      </CardContent>
      <CardFooter className="mt-6 flex flex-wrap justify-end gap-2">
        {demoMode ? (
          <>
            <Button variant="outline" disabled={!canEdit || pending} onClick={() => run(clearDemoDataAction)}>
              <Trash2 /> Remove demo data
            </Button>
            <Button disabled={!canEdit || pending} onClick={() => run(loadDemoDataAction)}>
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Regenerate
            </Button>
          </>
        ) : (
          <Button disabled={!canEdit || pending} onClick={() => run(loadDemoDataAction)}>
            {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} Load demo data
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
