/**
 * Integration tests for cowork sessions API routes.
 * Verifies auth and org checks (401/403) without a valid session.
 */

import { describe, it, expect } from "vitest";
import { GET as GETList, POST as POSTSession } from "@/app/api/cowork/sessions/route";
import { GET as GETOne } from "@/app/api/cowork/sessions/[id]/route";
import { GET as GETMessages } from "@/app/api/cowork/sessions/[id]/messages/route";
import { POST as POSTMessage } from "@/app/api/cowork/sessions/[id]/messages/route";

describe("GET /api/cowork/sessions", () => {
  it("returns 401 when unauthenticated", async () => {
    const request = new Request("http://localhost:3000/api/cowork/sessions", {
      method: "GET",
      headers: {},
    });
    const response = await GETList(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error", "Unauthorized");
  });
});

describe("POST /api/cowork/sessions", () => {
  it("returns 401 when unauthenticated (with CSRF token)", async () => {
    const request = new Request("http://localhost:3000/api/cowork/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "test-token-for-integration-test",
      },
      body: JSON.stringify({ model: "claude-sonnet-4-5" }),
    });
    const response = await POSTSession(request);
    expect([401, 403]).toContain(response.status);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});

describe("GET /api/cowork/sessions/:id", () => {
  it("returns 401 when unauthenticated", async () => {
    const request = new Request("http://localhost:3000/api/cowork/sessions/test-session-id", {
      method: "GET",
      headers: {},
    });
    const context = { params: Promise.resolve({ id: "test-session-id" }) };
    const response = await GETOne(request, context);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error", "Unauthorized");
  });
});

describe("GET /api/cowork/sessions/:id/messages", () => {
  it("returns 401 when unauthenticated", async () => {
    const request = new Request("http://localhost:3000/api/cowork/sessions/test-session-id/messages", {
      method: "GET",
      headers: {},
    });
    const context = { params: Promise.resolve({ id: "test-session-id" }) };
    const response = await GETMessages(request, context);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error", "Unauthorized");
  });
});

describe("POST /api/cowork/sessions/:id/messages", () => {
  it("returns 401 or 403 when unauthenticated", async () => {
    const request = new Request("http://localhost:3000/api/cowork/sessions/test-session-id/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": "test-token",
      },
      body: JSON.stringify({ content: "Hello" }),
    });
    const context = { params: Promise.resolve({ id: "test-session-id" }) };
    const response = await POSTMessage(request, context);
    expect([401, 403]).toContain(response.status);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});
