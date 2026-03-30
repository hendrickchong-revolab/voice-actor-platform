import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-md p-6">
      <div className="mb-4">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/login">
          ← Back to login
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration Closed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Self-registration is not available. Please contact your administrator to create an account.
          </p>
          <Link className={buttonVariants({ variant: "secondary" })} href="/login">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
