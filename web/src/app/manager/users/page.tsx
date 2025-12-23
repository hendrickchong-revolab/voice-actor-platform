import { createUserAsAdmin, listUsers, updateUserRole } from "@/actions/users";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { DeleteUserButton } from "@/components/DeleteUserButton";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function roleUpdateMessage(code: string) {
  if (code === "CANNOT_CHANGE_OWN_ROLE") return "You can’t change your own role.";
  if (code === "USER_NOT_FOUND") return "User not found.";
  return "Could not update role.";
}

function userCreateMessage(code: string) {
  if (code === "EMAIL_IN_USE") return "Email is already registered.";
  if (code === "USERNAME_IN_USE") return "Username is already taken.";
  return "Could not create user.";
}

export default async function ManagerUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string; created?: string; createError?: string }>;
}) {
  const session = await requireSession();
  const sp = (await searchParams) ?? {};
  const users = await listUsers();
  const canEdit = session.user.role === "ADMIN";

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? "Admins can update roles."
              : "Managers can view agents and managers."}
          </p>
        </div>
        <Link className="text-sm underline" href="/manager">
          Back to Manager
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All accounts</CardTitle>
          <CardDescription>
            {canEdit
              ? "Admins can change any user role (except their own)."
              : "Role editing is restricted to Admins."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sp.updated ? (
            <p className="mb-3 text-sm text-muted-foreground">Role updated.</p>
          ) : null}
          {sp.error ? (
            <p className="mb-3 text-sm text-destructive">{roleUpdateMessage(sp.error)}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                {canEdit ? <TableHead>Update</TableHead> : null}
                {canEdit ? <TableHead>Delete</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="font-medium">{u.username ?? ""}</TableCell>
                  <TableCell>
                    {u.firstName || u.lastName
                      ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                      : u.name ?? ""}
                  </TableCell>
                  <TableCell className="font-medium">{u.role}</TableCell>
                  {canEdit ? (
                    <TableCell>
                      <form
                        className="flex items-center gap-2"
                        action={async (formData) => {
                          "use server";
                          try {
                            await updateUserRole({
                              userId: u.id,
                              role: formData.get("role"),
                            });
                          } catch (e) {
                            const code = e instanceof Error ? e.message : "UNKNOWN";
                            redirect(`/manager/users?error=${encodeURIComponent(code)}`);
                          }

                          // Note: redirect() throws; keep it outside try/catch so it
                          // doesn't get incorrectly treated as an error (NEXT_REDIRECT).
                          redirect("/manager/users?updated=1");
                        }}
                      >
                        <select
                          name="role"
                          defaultValue={u.role}
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="AGENT">AGENT</option>
                          <option value="MANAGER">MANAGER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                        <Button type="submit" variant="outline">
                          Update
                        </Button>
                      </form>
                    </TableCell>
                  ) : null}
                  {canEdit ? (
                    <TableCell>
                      <DeleteUserButton userId={u.id} label={u.email} />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>Add user</CardTitle>
            <CardDescription>Admins can create new users (same fields as registration).</CardDescription>
          </CardHeader>
          <CardContent>
            {sp.created ? <p className="mb-3 text-sm text-muted-foreground">User created.</p> : null}
            {sp.createError ? (
              <p className="mb-3 text-sm text-destructive">{userCreateMessage(sp.createError)}</p>
            ) : null}

            <form
              className="grid gap-3"
              action={async (fd) => {
                "use server";
                try {
                  await createUserAsAdmin({
                    email: fd.get("email"),
                    firstName: fd.get("firstName"),
                    lastName: fd.get("lastName"),
                    username: fd.get("username"),
                    password: fd.get("password"),
                    role: fd.get("role"),
                  });
                } catch (e) {
                  const code = e instanceof Error ? e.message : "UNKNOWN";
                  redirect(`/manager/users?createError=${encodeURIComponent(code)}`);
                }

                // Note: redirect() throws; keep it outside try/catch so it
                // doesn't get incorrectly treated as an error (NEXT_REDIRECT).
                redirect("/manager/users?created=1");
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="new_email">
                    Email
                  </label>
                  <input
                    id="new_email"
                    name="email"
                    type="email"
                    required
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="new_username">
                    Username
                  </label>
                  <input
                    id="new_username"
                    name="username"
                    required
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="new_firstName">
                    First name
                  </label>
                  <input
                    id="new_firstName"
                    name="firstName"
                    required
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="new_lastName">
                    Last name
                  </label>
                  <input
                    id="new_lastName"
                    name="lastName"
                    required
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="new_password">
                    Password
                  </label>
                  <input
                    id="new_password"
                    name="password"
                    type="password"
                    required
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-sm font-medium" htmlFor="new_role">
                    Role
                  </label>
                  <select
                    id="new_role"
                    name="role"
                    defaultValue="AGENT"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="AGENT">AGENT</option>
                    <option value="MANAGER">MANAGER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <Button type="submit" variant="secondary">
                  Create user
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
