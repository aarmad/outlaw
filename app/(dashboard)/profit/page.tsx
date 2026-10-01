import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata: Metadata = { title: "Profit" };

export default function Page() {
  return (
    <ComingSoon
      title="Profit"
      icon={BarChart3}
      heading="Profit analytics"
      description="Sortable profit tables per product and offer: orders, revenue, AOV, COGS, ad spend, CPA, ROAS, POAS, margin and break-even CPA."
      availability="With profit analytics"
    />
  );
}
