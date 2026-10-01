import { Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata: Metadata = { title: "Insights" };

export default function Page() {
  return (
    <ComingSoon
      title="Insights"
      icon={Lightbulb}
      heading="Insights & today's actions"
      description="A deterministic rule engine turns your numbers into transparent observations — always showing the figures, formula, period and attribution confidence."
      availability="With the rule engine"
    />
  );
}
