"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string | null;
  organizationRole: { id: string; name: string } | null;
  globalRoles: Array<{ id: string; name: string; isSystem: boolean }>;
  createdAt: string;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      loadUser();
    }
  }, [userId]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load user");
      }

      const data = await response.json();
      setUser(data.user);
      setName(data.user.name || "");
      setEmail(data.user.email || "");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load user";
      setError(errorMessage);
      console.error("Error loading user:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Get CSRF token
      const csrfResponse = await fetch("/api/csrf-token", {
        credentials: "include",
      });
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.token;

      const payload: any = {};
      if (name !== user?.name) payload.name = name;
      if (email !== user?.email) payload.email = email;
      if (password) payload.password = password;

      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to update user";
        setError(errorMessage);
        setSaving(false);
        return;
      }

      // Redirect to user list
      router.push("/admin/users");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update user",
      );
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "var(--spacing-2xl)",
            }}
          >
            Loading...
          </div>
        </main>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="page-container">
        <main className="page-content">
          <div
            style={{
              padding: "var(--spacing-lg)",
              background: "var(--color-danger-bg)",
              color: "var(--color-danger-text)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
          Edit User
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
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={saving}
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
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
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
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
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
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                Leave blank to keep current password
              </p>
            </div>

            {user.organizationRole && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-text)",
                    marginBottom: "var(--spacing-xs)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Organization Role
                </label>
                <div
                  style={{
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    background: "var(--color-surface-secondary)",
                    borderRadius: "var(--radius-md)",
                    display: "inline-block",
                  }}
                >
                  {user.organizationRole.name}
                </div>
              </div>
            )}

            {user.globalRoles.length > 0 && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-text)",
                    marginBottom: "var(--spacing-xs)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Global Roles
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--spacing-xs)",
                    flexWrap: "wrap",
                  }}
                >
                  {user.globalRoles.map((role) => (
                    <span
                      key={role.id}
                      style={{
                        display: "inline-block",
                        padding: "var(--spacing-xs) var(--spacing-sm)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: role.isSystem
                          ? "var(--color-primary-bg)"
                          : "var(--color-surface-secondary)",
                        color: role.isSystem
                          ? "var(--color-primary)"
                          : "var(--color-text)",
                      }}
                    >
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
                disabled={saving}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-lg)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  background: saving
                    ? "var(--color-text-secondary)"
                    : "var(--color-primary)",
                  color: "var(--color-on-primary)",
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-lg)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  cursor: saving ? "not-allowed" : "pointer",
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
