import "dotenv/config";
import type { APIRoute } from "astro";
import { AwsClient } from "aws4fetch";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const POST: APIRoute = async ({ request }) => {
  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const startedAt = Date.now();
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
    console.error(`[upload ${requestId}] missing R2 configuration`);
    return jsonResponse({ message: "File uploads are not configured" }, 500);
  }

  console.info(`[upload ${requestId}] request received`, {
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
    r2Host: new URL(baseURL).host,
    bucket: bucketName,
  });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    console.error(`[upload ${requestId}] multipart parsing failed`);
    return jsonResponse({ message: "A valid file upload is required" }, 400);
  }

  const file = formData.get("file");
  const requestedName = formData.get("name");
  if (!(file instanceof File) || file.size <= 0) {
    console.error(`[upload ${requestId}] missing or empty file`);
    return jsonResponse({ message: "A valid file is required" }, 400);
  }

  console.info(`[upload ${requestId}] file received`, {
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
  });

  if (file.size > MAX_FILE_SIZE) {
    console.warn(`[upload ${requestId}] file exceeds size limit`);
    return jsonResponse(
      { message: "Unauthenticated uploads are limited to 15 MB" },
      413,
    );
  }

  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : "bin";
  if (!extension || !/^[a-z0-9]+$/.test(extension)) {
    console.warn(`[upload ${requestId}] invalid extension`, { extension });
    return jsonResponse({ message: "Invalid file extension" }, 400);
  }

  const uploadName =
    typeof requestedName === "string"
      ? requestedName.trim().replace(/[^a-z0-9_-]+/gi, "-").slice(0, 80)
      : "";
  const filename = `${uploadName ? `source-${uploadName}` : "user-upload"}-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 8)}.${extension}`;

  try {
    const r2 = new AwsClient({ accessKeyId, secretAccessKey });
    const url = new URL(
      `${baseURL.replace(/\/$/, "")}/${encodeURIComponent(bucketName)}/${filename}`,
    );
    url.searchParams.set("X-Amz-Expires", "3600");
    const uploadRequest = new Request(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: await file.arrayBuffer(),
    });
    const signed = await r2.sign(uploadRequest, {
      aws: { signQuery: true },
    });
    console.info(`[upload ${requestId}] request signed`, { filename });
    const uploadResponse = await fetch(signed);
    const responseText = await uploadResponse.text();

    if (!uploadResponse.ok) {
      console.error(`[upload ${requestId}] R2 upload failed`, {
        status: uploadResponse.status,
        response: responseText.slice(0, 1000),
        elapsedMs: Date.now() - startedAt,
      });
      return jsonResponse({ message: "File upload failed" }, 502);
    }

    console.info(`[upload ${requestId}] R2 upload completed`, {
      status: uploadResponse.status,
      elapsedMs: Date.now() - startedAt,
    });

    return jsonResponse(
      { postUploadURL: `${publicBaseURL.replace(/\/$/, "")}/${filename}` },
      201,
    );
  } catch (error) {
    console.error(`[upload ${requestId}] upload exception`, error);
    return jsonResponse({ message: "File upload failed" }, 500);
  }
};
