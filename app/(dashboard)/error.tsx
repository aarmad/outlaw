"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

/** Error boundary for every app page. Shows no technical detail, only a reference id. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page could not be loaded"
      description={
        <>
          Something went wrong on our side. Try again — if it keeps happening, contact support
          {error.digest ? (
            <>
              {" "}
              with reference <code className="rounded bg-muted px-1 text-xs">{error.digest}</code>
            </>
          ) : null}
          .
        </>
      }
      action={
        <Button onClick={reset} variant="outline">
          <RotateCcw /> Try again
        </Button>
      }
    />
  );
}
