import type { APIRoute } from "astro";
import bcrypt from "bcrypt";
import { and, eq, gt, isNull } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { db } from "../../../db";
import { invitationsTable, usersTable } from "../../../db/schema";
import generateToken from "../../../utils/generateToken";

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  let data: { username?: unknown; password?: unknown; inviteToken?: unknown };
  try {
    data = (await request.json()) as typeof data;
  } catch {
    return jsonResponse({ message: "A valid JSON body is required" }, 400);
  }

  if (
    typeof data.username !== "string" ||
    data.username.trim().length === 0 ||
    typeof data.password !== "string" ||
    data.password.length === 0 ||
    typeof data.inviteToken !== "string" ||
    data.inviteToken.length === 0
  ) {
    return jsonResponse(
      { message: "An invitation, username, and password are required" },
      400,
    );
  }

  const now = Date.now();
  try {
    const newUser = await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select({ id: invitationsTable.id })
        .from(invitationsTable)
        .where(
          and(
            eq(invitationsTable.token, data.inviteToken as string),
            isNull(invitationsTable.usedAt),
            gt(invitationsTable.expiresAt, now),
          ),
        )
        .execute();
      if (!invitation) throw new Error("INVITATION_INVALID");

      const [existingUser] = await tx
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.username, (data.username as string).trim()))
        .execute();
      if (existingUser) throw new Error("USERNAME_EXISTS");

      const hashedPassword = await bcrypt.hash(data.password as string, 10);
      const [createdUser] = await tx
        .insert(usersTable)
        .values({
          username: (data.username as string).trim(),
          password: hashedPassword,
        })
        .returning({ id: usersTable.id });

      const [claimedInvitation] = await tx
        .update(invitationsTable)
        .set({ usedAt: now, usedBy: createdUser.id })
        .where(
          and(
            eq(invitationsTable.id, invitation.id),
            isNull(invitationsTable.usedAt),
            gt(invitationsTable.expiresAt, now),
          ),
        )
        .returning({ id: invitationsTable.id });
      if (!claimedInvitation) throw new Error("INVITATION_INVALID");

      return createdUser;
    });

    const token = generateToken(newUser.id.toString());
    cookies.set("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 365 * 2,
      path: "/",
    });
    return jsonResponse({ message: "Account created" }, 201);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return jsonResponse({ message: "Unable to create account" }, 500);
    }
    if (error instanceof Error && error.message === "USERNAME_EXISTS") {
      return jsonResponse({ message: "Username already exists" }, 409);
    }
    if (error instanceof Error && error.message === "INVITATION_INVALID") {
      return jsonResponse(
        { message: "This invitation is invalid or expired" },
        410,
      );
    }
    console.error("Error creating invited account:", error);
    return jsonResponse({ message: "Unable to create account" }, 500);
  }
};
