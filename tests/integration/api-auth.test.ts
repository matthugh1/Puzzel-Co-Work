/**
 * Integration tests for auth API routes.
 * Verifies unauthenticated requests receive 401.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/auth/me/route";

describe("GET /api/auth/me", () => {
  it("returns 401 when no session cookie", async () => {
    const request = new Request("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {},
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error", "Unauthorized");
  });

  it("returns 401 when invalid cookie", async () => {
    const request = new Request("http://localhost:3000/api/auth/me", {
      method: "GET",
      headers: {
        Cookie: "session=invalid-token",
      },
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});
