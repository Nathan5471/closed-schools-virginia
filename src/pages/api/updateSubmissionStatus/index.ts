import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { submissionsTable, usersTable } from "../../../db/schema";

const statuses = ["approved", "rejected"] as const;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return redirect("/admin/login", 302);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id?: string };
    const userId = Number(decoded.id);

    if (!Number.isInteger(userId)) {
      return redirect("/admin/login", 302);
    }

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (!user) {
      return redirect("/admin/login", 302);
    }

    const formData = await request.formData();
    const submissionId = Number(formData.get("submissionId"));
    const status = formData.get("status");

    if (
      !Number.isInteger(submissionId) ||
      typeof status !== "string" ||
      !statuses.includes(status as (typeof statuses)[number])
    ) {
      return new Response("Invalid submission update", { status: 400 });
    }

    await db
      .update(submissionsTable)
      .set({ submissionStatus: status as (typeof statuses)[number] })
      .where(eq(submissionsTable.id, submissionId))
      .execute();

    return redirect("/admin/submissions", 303);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return redirect("/admin/login", 302);
    }

    console.error("Error updating submission status:", error);
    return new Response("Unable to update submission", { status: 500 });
  }
};
