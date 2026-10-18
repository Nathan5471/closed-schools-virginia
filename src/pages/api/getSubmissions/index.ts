import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { usersTable, submissionsTable } from "../../../db/schema";
import { db } from "../../../db";

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ cookies }) => {
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return jsonResponse({ message: "Authentication required" }, 401);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const userId = Number((decoded as { id?: string }).id);

    if (!Number.isInteger(userId)) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    const submissions = await db.select().from(submissionsTable).execute();

    return jsonResponse(
      {
        message: "Submissions retrieved successfully",
        submissions,
      },
      200,
    );
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    console.error("Error retrieving submissions:", error);
    return jsonResponse({ message: "Internal server error" }, 500);
  }
};
