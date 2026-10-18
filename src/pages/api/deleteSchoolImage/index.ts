import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { imagesTable, usersTable } from "../../../db/schema";

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) {
    return jsonResponse({ message: "Authentication required" }, 401);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id?: string };
    const userId = Number(decoded.id);
    if (!Number.isInteger(userId)) throw new Error("Invalid user");

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    if (!user) return jsonResponse({ message: "Authentication required" }, 401);

    const body = (await request.json()) as { imageId?: unknown };
    const imageId = body.imageId;
    if (typeof imageId !== "number" || !Number.isInteger(imageId)) {
      return jsonResponse({ message: "A valid image is required" }, 400);
    }

    const deleted = await db
      .delete(imagesTable)
      .where(eq(imagesTable.id, imageId))
      .returning({ id: imagesTable.id });
    if (deleted.length === 0) {
      return jsonResponse({ message: "Image not found" }, 404);
    }

    return jsonResponse({ message: "Image removed" }, 200);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }
    console.error("Error deleting school image:", error);
    return jsonResponse({ message: "Unable to remove image" }, 500);
  }
};
