import { createUserAsAdmin, listUsers, updateUserDetailsAsAdmin } from "@/actions/users";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { EditUserCredentialsButton } from "@/components/EditUserCredentialsButton";
import { SidePanel } from "@/components/SidePanel";
import { UserLanguagesCell } from "@/components/UserLanguagesCell";

import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/SubmitButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function updateMessage(code: string) {
  if (code === "CANNOT_CHANGE_OWN_ROLE") return "You can’t change your own role.";
  if (code === "USER_NOT_FOUND") return "User not found.";
  if (code === "EMAIL_IN_USE") return "Email is already registered.";
  if (code === "USERNAME_IN_USE") return "Username is already taken.";
  if (code === "INVALID_ADMIN_PASSWORD") return "Admin password is incorrect.";
  if (code === "NO_PASSWORD_SET") return "Admin account has no password set.";
  return "Could not update user.";
}

function userCreateMessage(code: string) {
  if (code === "EMAIL_IN_USE") return "Email is already registered.";
  if (code === "USERNAME_IN_USE") return "Username is already taken.";
  if (code === "PASSWORD_MISMATCH") return "Passwords do not match.";
  if (code === "LANGUAGE_REQUIRED") return "Language is required.";
  return "Could not create user.";
}

function isNextRedirectError(e: unknown) {
  const anyErr = e as { digest?: unknown };
  return typeof anyErr?.digest === "string" && anyErr.digest.startsWith("NEXT_REDIRECT");
}

export default async function ManagerUsersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    edit?: string;
    add?: string;
    detailsUpdated?: string;
    credentialsUpdated?: string;
    error?: string;
    created?: string;
    createError?: string;
  }>;
}) {
  const session = await requireSession();
  const sp = (await searchParams) ?? {};
  const users = await listUsers();
  const canEdit = session.user.role === "ADMIN";
  const editingUser = sp.edit ? users.find((u) => u.id === sp.edit) : null;
  const returnTo = sp.edit ? `/manager/users?edit=${encodeURIComponent(sp.edit)}` : "/manager/users";
  const showSuccess = Boolean(sp.detailsUpdated || sp.credentialsUpdated);

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            {canEdit ? "Click a user to edit details." : "Managers can view agents and managers."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canEdit ? (
            <Link href="/manager/users?add=1">
              <Button type="button" variant="secondary">
                Add New
              </Button>
            </Link>
          ) : null}
          <Link className="text-sm underline" href="/manager">
            Back to Manager
          </Link>
        </div>
      </div>

      {sp.detailsUpdated ? <p className="mb-3 text-sm text-muted-foreground">User details updated.</p> : null}
      {sp.credentialsUpdated ? <p className="mb-3 text-sm text-muted-foreground">Login credentials updated.</p> : null}
      {sp.created ? <p className="mb-3 text-sm text-muted-foreground">User created.</p> : null}
      {sp.createError ? <p className="mb-3 text-sm text-destructive">{userCreateMessage(sp.createError)}</p> : null}
      {sp.error && !showSuccess ? <p className="mb-3 text-sm text-destructive">{updateMessage(sp.error)}</p> : null}

      <div className="h-[calc(100vh-180px)] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead>Role</TableHead>
              {canEdit ? <TableHead>Edit</TableHead> : null}
              {canEdit ? <TableHead className="text-right">Delete</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              return (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="font-medium">{u.username ?? ""}</TableCell>
                  <TableCell>
                    {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : u.name ?? ""}
                  </TableCell>
                  <TableCell>
                    <UserLanguagesCell userEmail={u.email} languages={u.languages ?? []} />
                  </TableCell>
                  <TableCell className="font-medium">{u.role}</TableCell>
                  {canEdit ? (
                    <TableCell>
                      <form
                        action={async () => {
                          "use server";
                          redirect(`/manager/users?edit=${encodeURIComponent(u.id)}`);
                        }}
                      >
                        <SubmitButton variant="default" size="sm">Edit</SubmitButton>
                      </form>
                    </TableCell>
                  ) : null}
                  {canEdit ? (
                    <TableCell className="text-right">
                      <DeleteUserButton userId={u.id} label={u.email} />
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canEdit && editingUser ? (
        <SidePanel
          title="Edit user"
          description={editingUser.email}
          closeHref="/manager/users"
        >
          <form
            className="grid gap-3"
            action={async (fd) => {
              "use server";
              try {
                fd.set("returnTo", returnTo);
                await updateUserDetailsAsAdmin(fd);
              } catch (e) {
                if (isNextRedirectError(e)) throw e;
                const code = e instanceof Error ? e.message : "UNKNOWN";
                redirect(`${returnTo}&error=${encodeURIComponent(code)}`);
              }
            }}
          >
            <input type="hidden" name="userId" value={editingUser.id} />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="edit_email">
                  Email
                </label>
                <input
                  id="edit_email"
                  name="email"
                  type="email"
                  required
                  defaultValue={editingUser.email}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="edit_role">
                  Role
                </label>
                <select
                  id="edit_role"
                  name="role"
                  defaultValue={editingUser.role}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="AGENT">AGENT</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="edit_firstName">
                  First name
                </label>
                <input
                  id="edit_firstName"
                  name="firstName"
                  required
                  defaultValue={editingUser.firstName ?? ""}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-1">
                <label className="text-sm font-medium" htmlFor="edit_lastName">
                  Last name
                </label>
                <input
                  id="edit_lastName"
                  name="lastName"
                  required
                  defaultValue={editingUser.lastName ?? ""}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="edit_languages">
                Languages (comma-separated)
              </label>
              <input
                id="edit_languages"
                name="languages"
                defaultValue={(editingUser.languages ?? []).join(", ")}
                placeholder="English, Arabic"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center justify-end">
              <SubmitButton variant="secondary">Save details</SubmitButton>
            </div>
          </form>

          <div className="mt-4 flex items-center justify-end">
            <EditUserCredentialsButton userId={editingUser.id} username={editingUser.username} returnTo={returnTo} />
          </div>
        </SidePanel>
      ) : null}

      {canEdit && sp.add ? (
        <SidePanel
          title="Add user"
          description="Create a new account. Language is required."
          closeHref="/manager/users"
        >
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
                  confirmPassword: fd.get("confirmPassword"),
                  role: fd.get("role"),
                  languages: fd.get("languages"),
                });
              } catch (e) {
                const code = e instanceof Error ? e.message : "UNKNOWN";
                redirect(`/manager/users?add=1&createError=${encodeURIComponent(code)}`);
              }

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
                <label className="text-sm font-medium" htmlFor="new_confirmPassword">
                  Confirm password
                </label>
                <input
                  id="new_confirmPassword"
                  name="confirmPassword"
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

            <div className="grid gap-1">
              <label className="text-sm font-medium" htmlFor="new_languages">
                Languages (comma-separated)
              </label>
              <input
                id="new_languages"
                name="languages"
                required
                placeholder="English, Arabic"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                autoComplete="off"
              />
              <div className="text-xs text-muted-foreground">Required. Used for language-aware project assignment.</div>
            </div>

            <div>
              <SubmitButton variant="secondary">Create user</SubmitButton>
            </div>
          </form>
        </SidePanel>
      ) : null}
    </main>
  );
}
