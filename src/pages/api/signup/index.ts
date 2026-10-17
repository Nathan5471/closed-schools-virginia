import type { APIRoute } from "astro";
import { db } from "../../../db";
import { usersTable } from "../../../db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import generateToken from "../../../utils/generateToken";

export const POST: APIRoute = async ({ request, cookies }) => {
  const data = await request.json();

  if (!data.username || !data.password) {
    return new Response(
      JSON.stringify({ message: "Username and password are required" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
  const existingUser = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, data.username))
    .execute();
  if (existingUser.length > 0) {
    return new Response(
      JSON.stringify({ message: "Username already exists" }),
      {
        status: 409,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
  // I need to add some sort of invite system to only admins can sign up

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const newUser = await db
    .insert(usersTable)
    .values({
      username: data.username,
      password: hashedPassword,
    })
    .returning();
  const token = generateToken(newUser[0].id.toString());

  cookies.set("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
    path: "/",
  });

  return new Response(JSON.stringify({ message: "Signup successful" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
