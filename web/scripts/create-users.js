/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function asName(firstName, lastName) {
  const fn = String(firstName || "").trim();
  const ln = String(lastName || "").trim();
  const full = `${fn} ${ln}`.trim();
  return full || null;
}

async function upsertUser({ email, password, role, username, firstName, lastName }) {
  const hashed = await bcrypt.hash(password, 12);
  return db.user.upsert({
    where: { email },
    update: {
      role,
      username: username ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      name: asName(firstName, lastName),
      password: hashed,
    },
    create: {
      email,
      role,
      username: username ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      name: asName(firstName, lastName),
      password: hashed,
    },
    select: { id: true, email: true, role: true, username: true },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let users = null;
  if (args.file) {
    const p = path.resolve(process.cwd(), args.file);
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("--file must be a JSON array");
    users = parsed;
  } else if (args.email) {
    users = [
      {
        email: args.email,
        password: args.password,
        role: args.role || "AGENT",
        username: args.username,
        firstName: args.firstName,
        lastName: args.lastName,
      },
    ];
  } else {
    throw new Error(
      "Usage: node scripts/create-users.js --email <email> --password <pw> --username <u> --firstName <fn> --lastName <ln> [--role ADMIN|MANAGER|AGENT] OR --file users.json",
    );
  }

  const results = [];
  for (const u of users) {
    const email = normalizeEmail(u.email);
    if (!email) throw new Error("Missing email");
    if (!u.password) throw new Error(`Missing password for ${email}`);
    if (!u.username) throw new Error(`Missing username for ${email}`);
    if (!u.firstName) throw new Error(`Missing firstName for ${email}`);
    if (!u.lastName) throw new Error(`Missing lastName for ${email}`);

    const role = u.role === "ADMIN" || u.role === "MANAGER" ? u.role : "AGENT";

    const saved = await upsertUser({
      email,
      password: String(u.password),
      role,
      username: String(u.username),
      firstName: String(u.firstName),
      lastName: String(u.lastName),
    });
    results.push(saved);
  }

  for (const r of results) {
    console.log(`Upserted ${r.email} (${r.role}) username=${r.username}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
