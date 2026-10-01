import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireWorkspace } from "@/lib/auth/workspace";
import { EmptyState, PageHeader } from "./states";

/** Honest placeholder for a section that is not built yet. Never shows fake figures. */
export async function ComingSoon({
  title,
  icon,
  heading,
  description,
  availability,
}: {
  title: string;
  icon: LucideIcon;
  heading: string;
  description: string;
  availability: string;
}) {
  await requireWorkspace();
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={icon}
        title={heading}
        description={
          <>
            <Badge variant="secondary" className="mb-3">
              {availability}
            </Badge>
            <span className="block">{description}</span>
          </>
        }
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    </>
  );
}
