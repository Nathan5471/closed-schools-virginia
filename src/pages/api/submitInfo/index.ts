import type { APIRoute } from "astro";
import { db } from "../../../db";
import { submissionsTable } from "../../../db/schema";

const schoolTypes = ["white", "colored", "mixed"] as const;
const statuses = ["standing", "repurposed", "not standing"] as const;

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const optionalText = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();
  return text.length > 0 ? text : null;
};

export const POST: APIRoute = async ({ request }) => {
  let data: Record<string, unknown>;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ message: "A valid JSON object is required" }, 400);
    }
    data = body as Record<string, unknown>;
  } catch {
    return jsonResponse({ message: "A valid JSON body is required" }, 400);
  }

  const requiredFields = [
    ["schoolName", "School name"],
    ["countyName", "County name"],
    ["submittedBy", "Name"],
    ["submitterEmail", "Email"],
  ] as const;

  for (const [field, label] of requiredFields) {
    if (typeof data[field] !== "string" || data[field].trim().length === 0) {
      return jsonResponse({ message: `${label} is required` }, 400);
    }
  }

  const schoolType = optionalText(data.schoolType);
  const schoolStatus = optionalText(data.schoolStatus);
  const address = optionalText(data.address);
  const additionalInfo = optionalText(data.additionalInfo);

  if (
    schoolType !== null &&
    (schoolType === undefined ||
      !schoolTypes.includes(schoolType as (typeof schoolTypes)[number]))
  ) {
    return jsonResponse({ message: "Invalid school type" }, 400);
  }

  if (
    schoolStatus !== null &&
    (schoolStatus === undefined ||
      !statuses.includes(schoolStatus as (typeof statuses)[number]))
  ) {
    return jsonResponse({ message: "Invalid school status" }, 400);
  }

  const closedYear = data.closedYear;
  if (
    closedYear !== null &&
    closedYear !== undefined &&
    (typeof closedYear !== "number" ||
      !Number.isInteger(closedYear) ||
      closedYear < 0)
  ) {
    return jsonResponse({ message: "Closed year must be a valid year" }, 400);
  }

  const attachmentedURLs = data.attachmentedURLs;
  if (
    attachmentedURLs !== null &&
    attachmentedURLs !== undefined &&
    (!Array.isArray(attachmentedURLs) ||
      attachmentedURLs.some((url) => typeof url !== "string"))
  ) {
    return jsonResponse(
      { message: "Attachments must be an array of URLs" },
      400,
    );
  }

  try {
    const [submission] = await db
      .insert(submissionsTable)
      .values({
        schoolName: (data.schoolName as string).trim(),
        countyName: (data.countyName as string).trim(),
        schoolType: schoolType as (typeof schoolTypes)[number] | null,
        schoolStatus: schoolStatus as (typeof statuses)[number] | null,
        closedYear: (closedYear as number | null | undefined) ?? null,
        address,
        additionalInfo,
        attachmentedURLs:
          (attachmentedURLs as string[] | null | undefined) ?? null,
        submittedBy: (data.submittedBy as string).trim(),
        submitterEmail: (data.submitterEmail as string).trim(),
        submittedAt: Date.now(),
      })
      .returning({ id: submissionsTable.id });

    return jsonResponse(
      { message: "Submission received", id: submission.id },
      201,
    );
  } catch (error) {
    console.error("Error creating submission:", error);
    return jsonResponse({ message: "Unable to save submission" }, 500);
  }
};
