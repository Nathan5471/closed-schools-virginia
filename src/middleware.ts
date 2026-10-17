import "dotenv/config";
import type { MiddlewareHandler } from "astro";
import jwt from "jsonwebtoken";

const publicAdminRoutes = new Set(["/admin/login", "/admin/signup"]);

export const onRequest: MiddlewareHandler = async (
  { cookies, url, redirect },
  next,
) => {
  const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
  const isAdminRoute =
    normalizedPath === "/admin" || normalizedPath.startsWith("/admin/");

  if (!isAdminRoute || publicAdminRoutes.has(normalizedPath)) {
    return next();
  }

  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return redirect("/admin/login");
  }

  try {
    jwt.verify(token, jwtSecret);
  } catch {
    return redirect("/admin/login");
  }

  return next();
};
