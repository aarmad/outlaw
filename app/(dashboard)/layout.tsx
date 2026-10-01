import { AppHeader } from "@/components/dashboard/app-header";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireWorkspace } from "@/lib/auth/workspace";
import { dateInTz } from "@/lib/dates";
import { getShellData } from "@/lib/db/queries/shell";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const ctx = await requireWorkspace();
  const shell = await getShellData(ctx.workspace.id);
  const today = dateInTz(new Date(), ctx.workspace.timezone);

  return (
    <SidebarProvider>
      {/* No Suspense boundary here: the sidebar must hydrate in the same pass as
          SidebarProvider, otherwise the mobile/desktop switch causes a hydration mismatch. */}
      <AppSidebar workspaceName={ctx.workspace.name} />
      <SidebarInset>
        <AppHeader
            today={today}
            email={ctx.user.email}
            demoMode={ctx.workspace.demoMode}
            activeStoreName={shell.stores[0]?.name ?? null}
            lastSyncAt={shell.lastSyncAt}
            canSync={shell.hasSyncableIntegration}
          />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
