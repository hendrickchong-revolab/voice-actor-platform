import Link from "next/link";
import { redirect } from "next/navigation";

import { changeMyPassword, updateMyProfile } from "@/actions/users";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function message(code: string) {
  if (code === "USERNAME_IN_USE") return "Username is already taken.";
  if (code === "INVALID_CURRENT_PASSWORD") return "Current password is incorrect.";
  if (code === "NO_PASSWORD_SET") return "This account has no password set.";
  return "Update failed.";
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; error?: string }>;
}) {
  const session = await requireSession();
  const sp = (await searchParams) ?? {};

  const me = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, username: true, firstName: true, lastName: true },
  });

  if (!me) return <main className="p-6">Not found</main>;

  return (
    <main className="mx-auto w-full max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Link className="text-sm underline" href={session.user.role === "AGENT" ? "/agent" : "/manager"}>
          Back
        </Link>
      </div>

      {sp.ok ? <p className="text-sm text-muted-foreground">Saved.</p> : null}
      {sp.error ? <p className="text-sm text-destructive">{message(sp.error)}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and username.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            action={async (fd) => {
              "use server";
              try {
                await updateMyProfile({
                  firstName: fd.get("firstName"),
                  lastName: fd.get("lastName"),
                  username: fd.get("username"),
                });
                redirect("/account?ok=1");
              } catch (e) {
                const code = e instanceof Error ? e.message : "UNKNOWN";
                redirect(`/account?error=${encodeURIComponent(code)}`);
              }
            }}
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={me.email} readOnly />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="firstName">
                  First name
                </label>
                <Input id="firstName" name="firstName" defaultValue={me.firstName ?? ""} required />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="lastName">
                  Last name
                </label>
                <Input id="lastName" name="lastName" defaultValue={me.lastName ?? ""} required />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="username">
                Username
              </label>
              <Input id="username" name="username" defaultValue={me.username ?? ""} required autoComplete="username" />
            </div>

            <div>
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change your password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            action={async (fd) => {
              "use server";
              try {
                await changeMyPassword({
                  currentPassword: fd.get("currentPassword"),
                  newPassword: fd.get("newPassword"),
                });
                redirect("/account?ok=1");
              } catch (e) {
                const code = e instanceof Error ? e.message : "UNKNOWN";
                redirect(`/account?error=${encodeURIComponent(code)}`);
              }
            }}
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="currentPassword">
                Current password
              </label>
              <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="newPassword">
                New password
              </label>
              <Input id="newPassword" name="newPassword" type="password" required autoComplete="new-password" />
            </div>

            <div>
              <Button type="submit" variant="secondary">
                Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <Link className={buttonVariants({ variant: "outline" })} href="/api/auth/signout">
          Sign out
        </Link>
      </div>
    </main>
  );
}
