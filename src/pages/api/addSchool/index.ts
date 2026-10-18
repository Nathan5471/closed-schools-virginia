import type { APIRoute } from "astro";
import { db } from "../../../db";
import { usersTable, countiesTable, schoolsTable } from "../../../db/schema";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.json();
  if (!data.name || !data.countyId) {
    return new Response(
      JSON.stringify({ message: "School name and county are required" }),
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
    const county = await db
      .select()
      .from(countiesTable)
      .where(eq(countiesTable.id, data.countyId))
      .execute();
    if (county.length === 0) {
      return new Response(JSON.stringify({ message: "County not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    const newSchool = await db
      .insert(schoolsTable)
      .values({
        schoolName: data.name,
        countyId: data.countyId,
        schoolType: data.type || null,
        status: data.status || null,
        closedYear: data.closedYear || null,
        address: data.address || null,
      })
      .returning();
    return new Response(
      JSON.stringify({
        message: "School added successfully",
        id: newSchool[0].id,
      }),
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
