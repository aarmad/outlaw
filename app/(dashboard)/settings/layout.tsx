import { PageHeader } from "@/components/dashboard/states";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Workspace preferences and the economic assumptions behind your numbers." />
      <SettingsNav />
      {children}
    </div>
  );
}
