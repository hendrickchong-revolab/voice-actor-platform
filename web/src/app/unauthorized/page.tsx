import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>403 — Unauthorized</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
          <div>
            <Link className={buttonVariants({ variant: "secondary" })} href="/">
              Go home
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
