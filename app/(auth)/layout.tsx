import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <Link href="/login" className="mb-8">
        <Logo className="text-lg" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 max-w-sm text-center text-xs text-muted-foreground">
        Know what you really earn, the maximum CPA you can afford, and which products, offers and
        campaigns actually make you money.
      </p>
    </div>
  );
}
