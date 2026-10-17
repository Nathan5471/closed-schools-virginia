import type { APIRoute } from "astro";
import { db } from "../../../db";

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const counties = await db.query.countiesTable.findMany({
      columns: {
        id: true,
        name: true,
      },
      with: {
        schools: {
          columns: {
            id: true,
            schoolName: true,
            schoolType: true,
            status: true,
            closedYear: true,
            address: true,
          },
        },
      },
    });
    const cleanedCounties = counties.map((county) => ({
      ...county,
      schoolCount: county.schools.length,
    }));
    return new Response(
      JSON.stringify({
        message: "Counties retrieved successfully",
        cleanedCounties,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ message: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};
