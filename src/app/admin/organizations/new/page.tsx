"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewOrganizationPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSlugChange = (value: string) => {
    // Auto-generate slug from name
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Get CSRF token
      const csrfResponse = await fetch("/api/csrf-token", {
        credentials: "include",
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.token;

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify({ name, slug }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to create organization";
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Redirect to organization detail page
      router.push(`/admin/organizations/${data.organization.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create organization",
      );
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            margin: 0,
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          Create Organization
        </h1>
      </header>

      <main className="page-content">
        <div
          style={{
            maxWidth: "600px",
            padding: "var(--spacing-lg)",
          }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "var(--spacing-lg)" }}>
              <label
                htmlFor="name"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--color-text)",
                  marginBottom: "var(--spacing-xs)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Organization Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  handleSlugChange(e.target.value);
                }}
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
                htmlFor="slug"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--color-text)",
                  marginBottom: "var(--spacing-xs)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Slug (URL-friendly identifier)
              </label>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                disabled={loading}
                pattern="[a-z0-9-]+"
                style={{
                  width: "100%",
                  padding: "var(--spacing-sm) var(--spacing-md)",
                  fontSize: "1rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--color-background)",
                  color: "var(--color-text)",
                  fontFamily: "monospace",
                  boxSizing: "border-box",
                }}
              />
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                Only lowercase letters, numbers, and hyphens allowed
              </p>
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

            <div
              style={{
                display: "flex",
                gap: "var(--spacing-md)",
              }}
            >
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-lg)",
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
                }}
              >
                {loading ? "Creating..." : "Create Organization"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={loading}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-lg)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
