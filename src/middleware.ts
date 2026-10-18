import "dotenv/config";
import type { MiddlewareHandler } from "astro";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { usersTable } from "./db/schema";
import { eq } from "drizzle-orm";

const isPublicAdminRoute = (path: string) =>
  path === "/admin/login" ||
  path === "/admin/signup" ||
  path.startsWith("/admin/signup/");

export const onRequest: MiddlewareHandler = async (
  { cookies, url, locals, redirect },
  next,
) => {
  const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
  const isAdminRoute =
    normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");

  if (!isAdminRoute || isPublicAdminRoute(normalizedPath)) {
    return next();
  }

  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return redirect("/admin/login");
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
      return redirect("/admin/login");
    }
    locals.user = { id: user[0].id, username: user[0].username };
  } catch {
    cookies.delete("token", { path: "/" });
    return redirect("/admin/login");
  }

  return next();
};
