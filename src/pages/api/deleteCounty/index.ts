import type { APIRoute } from "astro";
import { db } from "../../../db";
import { usersTable, countiesTable } from "../../../db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

export const DELETE: APIRoute = async ({ url, cookies }) => {
  const countyId = url.searchParams.get("id");
  if (!countyId) {
    return new Response(JSON.stringify({ message: "County id is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const userId = parseInt((decoded as { id: string }).id);
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    if (user.length === 0) {
      cookies.delete("token", { path: "/" });
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    const county = await db
      .select()
      .from(countiesTable)
      .where(eq(countiesTable.id, parseInt(countyId)))
      .execute();
    if (county.length === 0) {
      return new Response(JSON.stringify({ message: "County not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    await db
      .delete(countiesTable)
      .where(eq(countiesTable.id, parseInt(countyId)))
      .execute();
    return new Response(
      JSON.stringify({ message: "County deleted successfully" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    cookies.delete("token", { path: "/" });
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
