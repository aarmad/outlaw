import { redirect } from "next/navigation";

// Signed-in users are redirected to /dashboard by proxy.ts before reaching this page.
export default function Home() {
  redirect("/login");
}
