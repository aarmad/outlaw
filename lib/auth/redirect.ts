/**
 * Validates a post-auth redirect target. Only same-origin relative paths are allowed,
 * which prevents open redirects through `?next=https://evil.example`.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(next)) return fallback;
  return next;
}
