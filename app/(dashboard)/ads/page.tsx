import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata: Metadata = { title: "Ads" };

export default function Page() {
  return (
    <ComingSoon
      title="Ads"
      icon={Megaphone}
      heading="Campaign profitability"
      description="Drill down Campaign → Ad set → Ad with spend, attributed revenue, estimated COGS, profit and break-even CPA — judged against your own economics, not ROAS alone."
      availability="With Meta Ads"
    />
  );
}
