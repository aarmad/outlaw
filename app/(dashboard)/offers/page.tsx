import { Tags } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata: Metadata = { title: "Offers" };

export default function Page() {
  return (
    <ComingSoon
      title="Offers"
      icon={Tags}
      heading="Offer builder"
      description="Build bundle tiers (1, 2, 3 units…), get Conservative / Balanced / Aggressive price suggestions and see break-even CPA and ROAS update instantly."
      availability="Next phase"
    />
  );
}
