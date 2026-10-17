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
  const user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, data.username))
    .execute();
  if (user.length === 0) {
    return new Response(
      JSON.stringify({ message: "Invalid username or password" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
  const passwordMatch = await bcrypt.compare(data.password, user[0].password);
  if (!passwordMatch) {
    return new Response(
      JSON.stringify({ message: "Invalid username or password" }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const token = generateToken(user[0].id.toString());
  cookies.set("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365 * 2, // 2 years
  });

  return new Response(JSON.stringify({ message: "Login successful", data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
