import Link from "next/link";
import { redirect } from "next/navigation";

import { registerUser } from "@/actions/users";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

function errorMessage(code: string) {
  if (code === "EMAIL_IN_USE") return "Email is already registered.";
  if (code === "USERNAME_IN_USE") return "Username is already taken.";
  if (code === "LANGUAGE_REQUIRED") return "Language is required.";
  return "Registration failed.";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  return (
    <main className="mx-auto w-full max-w-md p-6">
      <div className="mb-4">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/login">
          ← Back to login
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>Create a new agent account.</CardDescription>
        </CardHeader>
        <CardContent>
          {sp.error ? <p className="mb-3 text-sm text-destructive">{errorMessage(sp.error)}</p> : null}

          <form
            className="grid gap-4"
            action={async (fd) => {
              "use server";
              let errorCode: string | null = null;
              try {
                await registerUser({
                  email: fd.get("email"),
                  firstName: fd.get("firstName"),
                  lastName: fd.get("lastName"),
                  username: fd.get("username"),
                  password: fd.get("password"),
                  languages: fd.get("languages"),
                });
              } catch (e) {
                errorCode = e instanceof Error ? e.message : "UNKNOWN";
              }
              if (errorCode) {
                redirect(`/register?error=${encodeURIComponent(errorCode)}`);
              } else {
                redirect("/login");
              }
            }}
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="firstName">
                First name
              </label>
              <Input id="firstName" name="firstName" required autoComplete="given-name" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="lastName">
                Last name
              </label>
              <Input id="lastName" name="lastName" required autoComplete="family-name" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="username">
                Username
              </label>
              <Input id="username" name="username" required autoComplete="username" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input id="password" name="password" type="password" required autoComplete="new-password" />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="languages">
                Language(s)
              </label>
              <Input id="languages" name="languages" required placeholder="English" autoComplete="off" />
              <div className="text-xs text-muted-foreground">Required. Comma-separated (e.g. English, Arabic).</div>
            </div>

            <Button type="submit">Create account</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
