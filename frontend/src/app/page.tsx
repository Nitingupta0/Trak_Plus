import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACCESS_COOKIE } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  redirect(cookieStore.get(ACCESS_COOKIE)?.value ? "/library" : "/login");
}
