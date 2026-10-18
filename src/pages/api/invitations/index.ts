import type { APIRoute } from "astro";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "../../../db";
import { invitationsTable, usersTable } from "../../../db/schema";

const jsonResponse = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const getAdminId = async (token: string | undefined) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id?: string };
    const userId = Number(decoded.id);
    if (!Number.isInteger(userId)) return null;
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    return user?.id ?? null;
  } catch {
    return null;
  }
};

export const GET: APIRoute = async ({ cookies }) => {
  const adminId = await getAdminId(cookies.get("token")?.value);
  if (!adminId)
    return jsonResponse({ message: "Authentication required" }, 401);

  await db
    .delete(invitationsTable)
    .where(lt(invitationsTable.expiresAt, Date.now()))
    .execute();

  const invitations = await db
    .select()
    .from(invitationsTable)
    .orderBy(desc(invitationsTable.createdAt))
    .execute();
  return jsonResponse({ invitations });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const adminId = await getAdminId(cookies.get("token")?.value);
  if (!adminId)
    return jsonResponse({ message: "Authentication required" }, 401);

  let body: { expiresInDays?: unknown } = {};
  try {
    body = (await request.json()) as { expiresInDays?: unknown };
  } catch {
    return jsonResponse({ message: "A valid JSON body is required" }, 400);
  }

  const expiresInDays = Number(body.expiresInDays ?? 7);
  if (
    !Number.isInteger(expiresInDays) ||
    expiresInDays < 1 ||
    expiresInDays > 365
  ) {
    return jsonResponse(
      { message: "Expiration must be between 1 and 365 days" },
      400,
    );
  }

  const createdAt = Date.now();
  const [invitation] = await db
    .insert(invitationsTable)
    .values({
      token: crypto.randomBytes(32).toString("hex"),
      createdBy: adminId,
      createdAt,
      expiresAt: createdAt + expiresInDays * 24 * 60 * 60 * 1000,
    })
    .returning();

  return jsonResponse({ invitation }, 201);
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const adminId = await getAdminId(cookies.get("token")?.value);
  if (!adminId)
    return jsonResponse({ message: "Authentication required" }, 401);

  const body = (await request.json()) as { id?: unknown };
  const id = body.id;
  if (typeof id !== "number" || !Number.isInteger(id)) {
    return jsonResponse({ message: "A valid invitation is required" }, 400);
  }

  const [revoked] = await db
    .delete(invitationsTable)
    .where(and(eq(invitationsTable.id, id), isNull(invitationsTable.usedAt)))
    .returning({ id: invitationsTable.id });

  if (!revoked) return jsonResponse({ message: "Invitation not found" }, 404);
  return jsonResponse({ message: "Invitation revoked" });
};
