import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const ctx = await getWorkspaceContext();
  if (ctx?.workspace.onboardingCompletedAt) redirect("/dashboard");

  return (
    <div className="flex min-h-svh flex-col items-center bg-muted/40 px-4 py-10">
      <Logo className="mb-10 text-lg" />
      <OnboardingWizard defaultName={ctx?.workspace.name ?? ""} />
    </div>
  );
}
