const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();

async function upsertUser({ email, password, role, name, username, firstName, lastName }) {
  const hashed = await bcrypt.hash(password, 12);
  return db.user.upsert({
    where: { email },
    update: {
      role,
      name,
      username: username ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      password: hashed,
    },
    create: {
      email,
      role,
      name,
      username: username ?? null,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      password: hashed,
    },
  });
}

function normalizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function asName(firstName, lastName, fallback) {
  const fn = (firstName || "").trim();
  const ln = (lastName || "").trim();
  const full = `${fn} ${ln}`.trim();
  return full || fallback || null;
}

function parseSeedUsersFromEnv() {
  const raw = process.env.SEED_USERS_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function main() {
  const fromEnv = parseSeedUsersFromEnv();

  const defaultUsers = [
    {
      email: process.env.SEED_ADMIN_EMAIL || "admin@example.com",
      username: process.env.SEED_ADMIN_USERNAME || "admin",
      firstName: process.env.SEED_ADMIN_FIRST_NAME || "Admin",
      lastName: process.env.SEED_ADMIN_LAST_NAME || "User",
      password: process.env.SEED_ADMIN_PASSWORD || "admin123",
      role: "ADMIN",
    },
  ];

  const users = fromEnv || defaultUsers;
  for (const u of users) {
    const email = normalizeEmail(u.email);
    if (!email) continue;
    await upsertUser({
      email,
      password: String(u.password || ""),
      role: u.role || "AGENT",
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      name: asName(u.firstName, u.lastName, u.name),
    });
  }

  console.log(
    "Seed complete. Default admin: admin@example.com / admin123 (override with SEED_ADMIN_* env vars).",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
