"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get CSRF token first
      const csrfResponse = await fetch("/api/csrf-token", {
        credentials: "include",
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.token;

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include", // Important for cookies
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Login failed";
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Token is stored in httpOnly cookie automatically
      // No need to store in localStorage

      // Redirect to home or admin dashboard
      const returnTo = sessionStorage.getItem("returnTo") || "/";
      sessionStorage.removeItem("returnTo");
      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <main className="page-content">
        <div
          style={{
            maxWidth: "420px",
            margin: "0 auto",
            paddingTop: "var(--spacing-2xl)",
          }}
        >
          <div
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--spacing-xl)",
              background: "var(--color-surface)",
            }}
          >
            <h1
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                marginBottom: "var(--spacing-md)",
                fontFamily: "var(--font-display)",
                color: "var(--color-text)",
                textAlign: "center",
              }}
            >
              Sign In
            </h1>

            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                textAlign: "center",
                marginBottom: "var(--spacing-xl)",
                fontFamily: "var(--font-body)",
              }}
            >
              Sign in to access Puzzel Co-Work
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-text)",
                    marginBottom: "var(--spacing-xs)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    fontSize: "1rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-background)",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-body)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-text)",
                    marginBottom: "var(--spacing-xs)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    fontSize: "1rem",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--color-background)",
                    color: "var(--color-text)",
                    fontFamily: "var(--font-body)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {error && (
                <div
                  style={{
                    padding: "var(--spacing-md)",
                    background: "var(--color-danger-bg)",
                    color: "var(--color-danger-text)",
                    borderRadius: "var(--radius-md)",
                    marginBottom: "var(--spacing-lg)",
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "var(--spacing-md)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  background: loading
                    ? "var(--color-text-secondary)"
                    : "var(--color-primary)",
                  color: "var(--color-on-primary)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all 0.15s ease",
                }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
