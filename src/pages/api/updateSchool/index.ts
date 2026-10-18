import type { APIRoute } from "astro";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db";
import {
  countiesTable,
  imagesTable,
  schoolsTable,
  usersTable,
} from "../../../db/schema";

const jsonResponse = (body: object, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const schoolTypes = ["white", "colored", "mixed"] as const;
const statuses = ["standing", "repurposed", "not standing"] as const;

export const PUT: APIRoute = async ({ request, cookies }) => {
  const token = cookies.get("token")?.value;
  const jwtSecret = process.env.JWT_SECRET;

  if (!token || !jwtSecret) {
    return jsonResponse({ message: "Authentication required" }, 401);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { id?: string };
    const userId = Number(decoded.id);
    if (!Number.isInteger(userId)) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    if (!user) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ message: "A valid JSON object is required" }, 400);
    }

    const data = body as Record<string, unknown>;
    const schoolId = data.schoolId;
    const schoolName = data.schoolName;
    const countyId = data.countyId;
    const schoolType = data.schoolType;
    const status = data.status;
    const closedYear = data.closedYear;
    const address = data.address;
    const description = data.description;
    const sourceLinks = data.sourceLinks;
    const images = data.images;

    if (
      typeof schoolId !== "number" ||
      !Number.isInteger(schoolId) ||
      typeof schoolName !== "string" ||
      schoolName.trim().length === 0 ||
      typeof countyId !== "number" ||
      !Number.isInteger(countyId)
    ) {
      return jsonResponse(
        { message: "School name, county, and school ID are required" },
        400,
      );
    }

    if (
      schoolType !== null &&
      (typeof schoolType !== "string" ||
        !schoolTypes.includes(schoolType as (typeof schoolTypes)[number]))
    ) {
      return jsonResponse({ message: "Invalid school type" }, 400);
    }

    if (
      status !== null &&
      (typeof status !== "string" ||
        !statuses.includes(status as (typeof statuses)[number]))
    ) {
      return jsonResponse({ message: "Invalid school status" }, 400);
    }

    if (
      closedYear !== null &&
      (typeof closedYear !== "number" ||
        !Number.isInteger(closedYear) ||
        closedYear < 0)
    ) {
      return jsonResponse({ message: "Closed year must be a valid year" }, 400);
    }

    if (address !== null && typeof address !== "string") {
      return jsonResponse({ message: "Address must be text" }, 400);
    }

    if (description !== null && typeof description !== "string") {
      return jsonResponse({ message: "Description must be text" }, 400);
    }

    if (
      !Array.isArray(sourceLinks) ||
      sourceLinks.some((link) => typeof link !== "string")
    ) {
      return jsonResponse(
        { message: "Source links must be an array of text" },
        400,
      );
    }

    if (
      !Array.isArray(images) ||
      images.some((image) => {
        if (!image || typeof image !== "object") return true;
        const item = image as Record<string, unknown>;
        return (
          typeof item.id !== "number" ||
          !Number.isInteger(item.id) ||
          typeof item.name !== "string" ||
          item.name.trim().length === 0 ||
          typeof item.description !== "string" ||
          item.description.trim().length === 0
        );
      })
    ) {
      return jsonResponse(
        { message: "Every image needs a name and description before saving" },
        400,
      );
    }

    const [county] = await db
      .select({ id: countiesTable.id })
      .from(countiesTable)
      .where(eq(countiesTable.id, countyId))
      .execute();
    if (!county) {
      return jsonResponse({ message: "County not found" }, 404);
    }

    const existingImages = await db
      .select({ id: imagesTable.id })
      .from(imagesTable)
      .where(eq(imagesTable.schoolId, schoolId))
      .execute();
    const existingImageIds = new Set(existingImages.map((image) => image.id));
    if (
      (images as Array<{ id: number }>).some(
        (image) => !existingImageIds.has(image.id),
      )
    ) {
      return jsonResponse(
        { message: "An image does not belong to this school" },
        400,
      );
    }

    const [updatedSchool] = await db
      .update(schoolsTable)
      .set({
        schoolName: schoolName.trim(),
        countyId,
        schoolType: schoolType as (typeof schoolTypes)[number] | null,
        status: status as (typeof statuses)[number] | null,
        closedYear: closedYear as number | null,
        address: typeof address === "string" ? address.trim() || null : null,
        description:
          typeof description === "string" ? description.trim() || null : null,
        sourceLinks: sourceLinks
          .map((link) => link.trim())
          .filter((link) => link.length > 0),
        updatedAt: Date.now(),
      })
      .where(eq(schoolsTable.id, schoolId))
      .returning({ id: schoolsTable.id });

    if (!updatedSchool) {
      return jsonResponse({ message: "School not found" }, 404);
    }

    await Promise.all(
      (images as Array<{ id: number; name: string; description: string }>).map(
        (image) =>
          db
            .update(imagesTable)
            .set({
              name: image.name.trim(),
              description: image.description.trim(),
            })
            .where(
              and(
                eq(imagesTable.id, image.id),
                eq(imagesTable.schoolId, schoolId),
              ),
            )
            .execute(),
      ),
    );

    return jsonResponse(
      { message: "School updated successfully", id: updatedSchool.id },
      200,
    );
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return jsonResponse({ message: "Authentication required" }, 401);
    }

    console.error("Error updating school:", error);
    return jsonResponse({ message: "Unable to update school" }, 500);
  }
};
