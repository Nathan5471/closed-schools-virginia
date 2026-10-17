import type { APIRoute } from "astro";
import { db } from "../../../db";
import { usersTable, countiesTable } from "../../../db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.json();
  if (!data.name) {
    return new Response(
      JSON.stringify({ message: "County name is required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
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
    const existingCounty = await db
      .select()
      .from(countiesTable)
      .where(eq(countiesTable.name, data.name))
      .execute();
    if (existingCounty.length > 0) {
      return new Response(
        JSON.stringify({ message: "County already exists" }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
    await db.insert(countiesTable).values({ name: data.name }).execute();
    return new Response(
      JSON.stringify({ message: "County added successfully" }),
      {
        status: 201,
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
