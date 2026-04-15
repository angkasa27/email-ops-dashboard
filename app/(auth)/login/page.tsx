import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/server/session";

import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        <Card className="space-y-6 p-8">
          <div>
            <h1 className="text-3xl font-semibold">Mail Monitor</h1>
            <p className="mt-2 text-sm text-stone-600">
              Sign in with the internal admin account to access mailbox operations.
            </p>
          </div>
          {params.error ? (
            <div className="rounded-2xl border border-rose-300 bg-rose-100 px-3 py-2 text-sm text-rose-900">
              Invalid credentials.
            </div>
          ) : null}
          <form className="space-y-4" action={loginAction}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Username</span>
              <Input name="username" required autoComplete="username" />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              <span>Password</span>
              <Input name="password" type="password" required autoComplete="current-password" />
            </label>
            <Button className="w-full" type="submit">
              Sign In
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
