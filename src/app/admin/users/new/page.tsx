"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationRole {
  id: string;
  name: string;
}

export default function NewUserPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string>("");

  useEffect(() => {
    checkPermissions();
    loadOrganizations();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadOrganizationRoles(organizationId);
    } else if (currentOrgId) {
      loadOrganizationRoles(currentOrgId);
    }
  }, [organizationId, currentOrgId]);

  const checkPermissions = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        setIsGlobalAdmin(user.roles.includes("admin"));
        setCurrentOrgId(user.organizationId || "");
        if (!user.roles.includes("admin") && user.organizationId) {
          setOrganizationId(user.organizationId);
        }
      }
    } catch (err) {
      console.error("Error checking permissions:", err);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch("/api/organizations", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error("Error loading organizations:", err);
    }
  };

  const loadOrganizationRoles = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        credentials: "include",
      });
      if (response.ok) {
        // We'll need to fetch roles separately or include them in the org response
        // For now, we'll use a default member role
        setRoles([
          { id: "", name: "member" },
          { id: "", name: "admin" },
          { id: "", name: "viewer" },
        ]);
      }
    } catch (err) {
      console.error("Error loading roles:", err);
    }
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

      const payload: any = {
        email,
        name: name || undefined,
        password: password || undefined,
      };

      // Only include organizationId if global admin
      if (isGlobalAdmin && organizationId) {
        payload.organizationId = organizationId;
      }

      if (roleId) {
        payload.roleId = roleId;
      }

      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to create user";
        setError(errorMessage);
        setLoading(false);
        return;
      }

      // Redirect to user list
      router.push("/admin/users");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create user",
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
          Create User
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
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-text-secondary)",
                  marginTop: "var(--spacing-xs)",
                }}
              >
                Leave blank to create user without password (for SSO users)
              </p>
            </div>

            {isGlobalAdmin && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <label
                  htmlFor="organizationId"
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--color-text)",
                    marginBottom: "var(--spacing-xs)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Organization
                </label>
                <select
                  id="organizationId"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
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
                >
                  <option value="">Select organization...</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(organizationId || currentOrgId) && (
              <div style={{ marginBottom: "var(--spacing-lg)" }}>
                <label
                  htmlFor="roleId"
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
                <select
                  id="roleId"
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
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
                >
                  <option value="">Default (member)</option>
                  {roles.map((role) => (
                    <option key={role.id || role.name} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
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
                {loading ? "Creating..." : "Create User"}
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
