import type { APIRoute } from "astro";
import { AwsClient } from "aws4fetch";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../../db";
import { usersTable } from "../../../db/schema";

const MAX_ANONYMOUS_FILE_SIZE = 15 * 1024 * 1024;

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

export const POST: APIRoute = async ({ request, cookies }) => {
  let data: { fileExtension?: unknown; fileSize?: unknown };

  try {
    data = await request.json();
  } catch {
    return jsonResponse({ message: "A valid JSON body is required" }, 400);
  }

  if (typeof data.fileExtension !== "string") {
    return jsonResponse({ message: "File extension is required" }, 400);
  }

  const fileExtension = data.fileExtension
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  const fileSize = typeof data.fileSize === "number" ? data.fileSize : NaN;

  if (!/^[a-z0-9]+$/.test(fileExtension)) {
    return jsonResponse({ message: "Invalid file extension" }, 400);
  }

  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return jsonResponse({ message: "A valid file size is required" }, 400);
  }

  let isAdmin = false;
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (token && jwtSecret) {
    try {
      const decoded = jwt.verify(token, jwtSecret) as { id?: string };
      const userId = Number(decoded.id);
      const user = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();
      isAdmin = user.length > 0;
    } catch {
      isAdmin = false;
    }
  }

  if (!isAdmin && fileSize > MAX_ANONYMOUS_FILE_SIZE) {
    return jsonResponse(
      { message: "Unauthenticated uploads are limited to 15 MB" },
      413,
    );
  }

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const baseURL = process.env.R2_BASE_URL;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicBaseURL = process.env.R2_PUBLIC_BASE_URL;

  if (
    !accessKeyId ||
    !secretAccessKey ||
    !baseURL ||
    !bucketName ||
    !publicBaseURL
  ) {
    console.error("R2 credentials are not set in environment variables");
    return jsonResponse({ message: "Failed to generate upload link" }, 500);
  }

  const filename = `user-upload-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}.${fileExtension}`;

  try {
    const r2 = new AwsClient({
      accessKeyId,
      secretAccessKey,
    });
    const url = new URL(
      `${baseURL.replace(/\/$/, "")}/${encodeURIComponent(bucketName)}/${filename}`,
    );
    url.searchParams.set("X-Amz-Expires", "3600");
    const signed = await r2.sign(new Request(url, { method: "PUT" }), {
      aws: { signQuery: true },
    });

    return jsonResponse(
      {
        uploadURL: signed.url,
        postUploadURL: `${publicBaseURL.replace(/\/$/, "")}/${filename}`,
      },
      200,
    );
  } catch (error) {
    console.error("Error generating upload link:", error);
    return jsonResponse({ message: "Failed to generate upload link" }, 500);
  }
};
