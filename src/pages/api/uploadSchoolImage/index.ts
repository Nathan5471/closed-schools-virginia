import "dotenv/config";
import type { APIRoute } from "astro";
import { AwsClient } from "aws4fetch";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { imagesTable, schoolsTable, usersTable } from "../../../db/schema";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;
  if (!token || !jwtSecret) {
    return jsonResponse({ message: "Authentication required" }, 401);
  }

  let userId: number;
  try {
    const decoded = jwt.verify(token, jwtSecret) as { id?: string };
    userId = Number(decoded.id);
    if (!Number.isInteger(userId)) throw new Error("Invalid user");
  } catch {
    return jsonResponse({ message: "Authentication required" }, 401);
  }

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .execute();
  if (!user) return jsonResponse({ message: "Authentication required" }, 401);

  const formData = await request.formData();
  const schoolId = Number(formData.get("schoolId"));
  const file = formData.get("file");
  if (
    !Number.isInteger(schoolId) ||
    !(file instanceof File) ||
    file.size <= 0
  ) {
    return jsonResponse({ message: "A school and image are required" }, 400);
  }
  if (!file.type.startsWith("image/")) {
    return jsonResponse(
      { message: "Only image files can be uploaded here" },
      400,
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return jsonResponse({ message: "Images must be 15 MB or smaller" }, 413);
  }

  const [school] = await db
    .select({ id: schoolsTable.id })
    .from(schoolsTable)
    .where(eq(schoolsTable.id, schoolId))
    .execute();
  if (!school) return jsonResponse({ message: "School not found" }, 404);

  const baseURL = process.env.R2_BASE_URL;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicBaseURL = process.env.R2_PUBLIC_BASE_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (
    !baseURL ||
    !bucketName ||
    !publicBaseURL ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    return jsonResponse({ message: "File uploads are not configured" }, 500);
  }

  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : "bin";
  if (!extension || !/^[a-z0-9]+$/.test(extension)) {
    return jsonResponse({ message: "Invalid image extension" }, 400);
  }

  const filename = `school-image-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${extension}`;

  try {
    const r2 = new AwsClient({ accessKeyId, secretAccessKey });
    const url = new URL(
      `${baseURL.replace(/\/$/, "")}/${encodeURIComponent(bucketName)}/${filename}`,
    );
    url.searchParams.set("X-Amz-Expires", "3600");
    const signed = await r2.sign(
      new Request(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: await file.arrayBuffer(),
      }),
      { aws: { signQuery: true } },
    );
    const uploadResponse = await fetch(signed);
    if (!uploadResponse.ok) {
      return jsonResponse({ message: "Image upload failed" }, 502);
    }

    const publicURL = `${publicBaseURL.replace(/\/$/, "")}/${filename}`;
    const [image] = await db
      .insert(imagesTable)
      .values({
        schoolId,
        url: publicURL,
        name: file.name,
        uploadedBy: userId,
        uploadedAt: Date.now(),
      })
      .returning({
        id: imagesTable.id,
        url: imagesTable.url,
        name: imagesTable.name,
      });

    return jsonResponse({ image }, 201);
  } catch (error) {
    console.error("Error uploading school image:", error);
    return jsonResponse({ message: "Image upload failed" }, 500);
  }
};
