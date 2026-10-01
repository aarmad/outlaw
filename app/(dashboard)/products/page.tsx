import { Package } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/dashboard/coming-soon";

export const metadata: Metadata = { title: "Products" };

export default function Page() {
  return (
    <ComingSoon
      title="Products"
      icon={Package}
      heading="Products & landed costs"
      description="Add products manually, enter product, shipping and other costs (with full cost history), and see orders, revenue, ad spend and profit per product. AliExpress import comes later."
      availability="Next phase"
    />
  );
}
