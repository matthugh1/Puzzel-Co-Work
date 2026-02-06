"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount?: number;
  createdAt: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    loadOrganizations();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        // Check if user has organizations:create permission or is global admin
        setCanCreate(
          user.permissions.includes("organizations:create") ||
          user.roles.includes("admin"),
        );
      }
    } catch (err) {
      console.error("Error checking permissions:", err);
    }
  };

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/organizations", {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load organizations");
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load organizations";
      setError(errorMessage);
      console.error("Error loading organizations:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
          }}
        >
          <h1
            style={{
              fontSize: "2.25rem",
              fontWeight: 700,
              margin: 0,
              fontFamily: "var(--font-display)",
              color: "var(--color-text)",
            }}
          >
            Organizations
          </h1>
          {canCreate && (
            <Link
              href="/admin/organizations/new"
              style={{
                padding: "var(--spacing-sm) var(--spacing-lg)",
                background: "var(--color-primary)",
                color: "var(--color-on-primary)",
                borderRadius: "var(--radius-md)",
                textDecoration: "none",
                fontSize: "0.875rem",
                fontWeight: 600,
                fontFamily: "var(--font-body)",
              }}
            >
              Create Organization
            </Link>
          )}
        </div>
      </header>

      <main className="page-content">
        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "var(--spacing-2xl)",
              color: "var(--color-text-secondary)",
            }}
          >
            Loading organizations...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "var(--spacing-lg)",
              background: "var(--color-danger-bg)",
              color: "var(--color-danger-text)",
              borderRadius: "var(--radius-md)",
              marginBottom: "var(--spacing-lg)",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {organizations.length === 0 ? (
              <div
                style={{
                  padding: "var(--spacing-2xl)",
                  textAlign: "center",
                  color: "var(--color-text-secondary)",
                }}
              >
                <p>No organizations found.</p>
                {canCreate && (
                  <Link
                    href="/admin/organizations/new"
                    style={{
                      display: "inline-block",
                      marginTop: "var(--spacing-md)",
                      padding: "var(--spacing-sm) var(--spacing-lg)",
                      background: "var(--color-primary)",
                      color: "var(--color-on-primary)",
                      borderRadius: "var(--radius-md)",
                      textDecoration: "none",
                    }}
                  >
                    Create your first organization
                  </Link>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: "var(--spacing-lg)",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "var(--color-surface-secondary)",
                        borderBottom: "1px solid var(--color-border)",
                      }}
                    >
                      <th
                        style={{
                          padding: "var(--spacing-md)",
                          textAlign: "left",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Name
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-md)",
                          textAlign: "left",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Slug
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-md)",
                          textAlign: "left",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Members
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-md)",
                          textAlign: "left",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          padding: "var(--spacing-md)",
                          textAlign: "right",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {organizations.map((org) => (
                      <tr
                        key={org.id}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <td
                          style={{
                            padding: "var(--spacing-md)",
                            color: "var(--color-text)",
                          }}
                        >
                          {org.name}
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-md)",
                            color: "var(--color-text-secondary)",
                            fontFamily: "monospace",
                            fontSize: "0.875rem",
                          }}
                        >
                          {org.slug}
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-md)",
                            color: "var(--color-text-secondary)",
                          }}
                        >
                          {org.memberCount || 0}
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-md)",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              padding: "var(--spacing-xs) var(--spacing-sm)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: org.isActive
                                ? "var(--color-success-bg)"
                                : "var(--color-danger-bg)",
                              color: org.isActive
                                ? "var(--color-success-text)"
                                : "var(--color-danger-text)",
                            }}
                          >
                            {org.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "var(--spacing-md)",
                            textAlign: "right",
                          }}
                        >
                          <Link
                            href={`/admin/organizations/${org.id}`}
                            style={{
                              padding: "var(--spacing-xs) var(--spacing-md)",
                              fontSize: "0.875rem",
                              color: "var(--color-primary)",
                              textDecoration: "none",
                            }}
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
