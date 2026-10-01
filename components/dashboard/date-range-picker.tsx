"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DATE_PRESETS, parseDateRange, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: IsoDate) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function formatShort(date: IsoDate) {
  return fromIso(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** `today` is computed server-side in the workspace timezone. */
export function DateRangePicker({ today }: { today: IsoDate }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = parseDateRange(Object.fromEntries(searchParams.entries()), today);
  const [draft, setDraft] = useState<DayPickerRange | undefined>(undefined);

  const label =
    current.preset === "custom"
      ? `${formatShort(current.from)} – ${formatShort(current.to)}`
      : DATE_PRESETS.find((p) => p.id === current.preset)?.label;

  function apply(params: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const key of ["range", "from", "to"]) next.delete(key);
    for (const [k, v] of Object.entries(params)) next.set(k, v);
    setOpen(false);
    setDraft(undefined);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", pending && "opacity-70")}>
          <CalendarDays className="size-4" />
          <span className="tabular">{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-col gap-0.5 border-b p-2 sm:border-r sm:border-b-0">
            {DATE_PRESETS.map((p) => (
              <Button
                key={p.id}
                variant={current.preset === p.id ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => apply({ range: p.id })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="p-2">
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={fromIso(current.from)}
              selected={draft ?? { from: fromIso(current.from), to: fromIso(current.to) }}
              onSelect={setDraft}
              disabled={{ after: fromIso(today) }}
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-1">
              <span className="text-xs text-muted-foreground">Custom range</span>
              <Button
                size="sm"
                disabled={!draft?.from}
                onClick={() =>
                  draft?.from &&
                  apply({ range: "custom", from: toIso(draft.from), to: toIso(draft.to ?? draft.from) })
                }
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
