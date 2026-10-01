"use client";

import { ArrowLeft, ArrowRight, Check, Database, Megaphone, ShoppingBag, Sparkles } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { FormField, FormMessage, SubmitButton } from "@/components/forms/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_CURRENCIES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { initialActionState } from "@/lib/validation/action-state";
import { completeOnboardingAction } from "./actions";

const STEPS = ["Workspace", "Currency", "Shopify", "Meta Ads", "Data"] as const;

const CURRENCY_LABELS: Record<string, string> = {
  EUR: "Euro (€)",
  USD: "US Dollar ($)",
  GBP: "British Pound (£)",
  CAD: "Canadian Dollar (CA$)",
  AUD: "Australian Dollar (A$)",
  CHF: "Swiss Franc (CHF)",
};

const TIMEZONES = [
  "Europe/Paris",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Brussels",
  "Europe/Zurich",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "UTC",
];

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState(completeOnboardingAction, initialActionState);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName);
  const [currency, setCurrency] = useState<string>("EUR");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [dataMode, setDataMode] = useState<"demo" | "empty">("demo");

  useEffect(() => {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Sync once with the browser timezone, which is unknown during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (browserTz) setTimezone(browserTz);
  }, []);

  // Field errors returned by the server send the user back to the relevant step.
  useEffect(() => {
    if (state.fieldErrors?.name) setStep(0); // eslint-disable-line react-hooks/set-state-in-effect
    else if (state.fieldErrors?.currency || state.fieldErrors?.timezone) setStep(1);
  }, [state]);

  const canContinue = step !== 0 || name.trim().length >= 2;
  const timezoneOptions = TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES];

  return (
    <div className="w-full max-w-lg">
      <ol className="mb-6 flex items-center justify-between gap-2" aria-label="Onboarding progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular",
                i < step && "border-foreground bg-foreground text-background",
                i === step && "border-foreground",
                i > step && "text-muted-foreground",
              )}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("text-xs", i === step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        ))}
      </ol>

      <Card>
        <form action={action}>
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="timezone" value={timezone} />
          <input type="hidden" name="dataMode" value={dataMode} />

          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Name your workspace</CardTitle>
                <CardDescription>Usually your brand or company name. You can change it later.</CardDescription>
              </CardHeader>
              <CardContent className="mt-6">
                <FormField
                  name="name-input"
                  label="Workspace name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Brands"
                  autoFocus
                  state={state.fieldErrors?.name ? { fieldErrors: { "name-input": state.fieldErrors.name } } : undefined}
                />
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle>Main currency</CardTitle>
                <CardDescription>
                  All profit figures are reported in this currency. Days are cut in your timezone.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-6 grid gap-4">
                <div className="grid gap-1.5">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CURRENCY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <IntegrationStep
              icon={<ShoppingBag className="size-5" />}
              title="Connect Shopify"
              description="Import orders, refunds, discounts and products automatically."
            />
          )}

          {step === 3 && (
            <IntegrationStep
              icon={<Megaphone className="size-5" />}
              title="Connect Meta Ads"
              description="Import daily spend and performance for campaigns, ad sets and ads."
            />
          )}

          {step === 4 && (
            <>
              <CardHeader>
                <CardTitle>How do you want to start?</CardTitle>
                <CardDescription>You can switch demo data on or off later in Settings.</CardDescription>
              </CardHeader>
              <CardContent className="mt-6 grid gap-3">
                <ChoiceCard
                  selected={dataMode === "demo"}
                  onSelect={() => setDataMode("demo")}
                  icon={<Sparkles className="size-5" />}
                  title="Use demo data"
                  description="3 products, 5 campaigns, ~300 orders over 30 days. Explore every screen right away."
                  badge="Recommended"
                />
                <ChoiceCard
                  selected={dataMode === "empty"}
                  onSelect={() => setDataMode("empty")}
                  icon={<Database className="size-5" />}
                  title="Start empty"
                  description="Add your own products and costs manually."
                />
                <FormMessage state={state} />
              </CardContent>
            </>
          )}

          <CardFooter className="mt-6 flex justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || pending}
            >
              <ArrowLeft /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
                {step === 2 || step === 3 ? "Skip for now" : "Continue"} <ArrowRight />
              </Button>
            ) : (
              <SubmitButton pending={pending}>{pending ? "Setting up…" : "Open my dashboard"}</SubmitButton>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

function IntegrationStep({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-6">
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">Not available yet</Badge>
          </div>
          This integration is being built. Skip this step for now — you can connect it later from{" "}
          <span className="font-medium text-foreground">Integrations</span>, and demo data lets you try everything
          in the meantime.
        </div>
      </CardContent>
    </>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50",
        selected && "border-foreground ring-1 ring-foreground",
      )}
    >
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="grid gap-1">
        <span className="flex items-center gap-2 font-medium">
          {title}
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
        </span>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
