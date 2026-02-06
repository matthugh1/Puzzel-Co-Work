import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/csrf-token
 * Returns the CSRF token from the cookie
 * This endpoint exists to ensure the middleware runs and sets the cookie
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("csrf-token")?.value;
  if (token) {
    return NextResponse.json({ token });
  }

  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const csrfToken = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  const response = NextResponse.json({ token: csrfToken });
  response.cookies.set("csrf-token", csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return response;
}
