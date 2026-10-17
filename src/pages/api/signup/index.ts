import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();

  return new Response(JSON.stringify({ message: "Signup successful", data }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
};
