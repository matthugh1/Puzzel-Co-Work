"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
  name: string | null;
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
    role: { id: string; name: string } | null;
  }>;
  organizationRole?: { id: string; name: string } | null;
  globalRoles: Array<{ id: string; name: string; isSystem: boolean }>;
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadUsers();
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const user = data.user;
        setCanCreate(
          user.permissions.includes("users:admin") ||
          user.roles.includes("admin"),
        );
      }
    } catch (err) {
      console.error("Error checking permissions:", err);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const url = search
        ? `/api/users?search=${encodeURIComponent(search)}`
        : "/api/users";

      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load users";
      setError(errorMessage);
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
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
            Users
          </h1>
          {canCreate && (
            <Link
              href="/admin/users/new"
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
              Create User
            </Link>
          )}
        </div>
      </header>

      <main className="page-content">
        <div
          style={{
            padding: "var(--spacing-lg)",
          }}
        >
          {/* Search */}
          <form
            onSubmit={handleSearch}
            style={{
              marginBottom: "var(--spacing-lg)",
              display: "flex",
              gap: "var(--spacing-md)",
            }}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              style={{
                flex: 1,
                padding: "var(--spacing-sm) var(--spacing-md)",
                fontSize: "1rem",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                background: "var(--color-background)",
                color: "var(--color-text)",
                fontFamily: "var(--font-body)",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "var(--spacing-sm) var(--spacing-lg)",
                fontSize: "1rem",
                fontWeight: 500,
                background: "var(--color-primary)",
                color: "var(--color-on-primary)",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  loadUsers();
                }}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-lg)",
                  fontSize: "1rem",
                  fontWeight: 500,
                  background: "transparent",
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Clear
              </button>
            )}
          </form>

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
              Loading users...
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
              {users.length === 0 ? (
                <div
                  style={{
                    padding: "var(--spacing-2xl)",
                    textAlign: "center",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <p>No users found.</p>
                  {canCreate && (
                    <Link
                      href="/admin/users/new"
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
                      Create your first user
                    </Link>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--color-surface)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                    border: "1px solid var(--color-border)",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
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
                          Email
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
                          Organization
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
                          Role
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
                          Global Roles
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
                      {users.map((user) => (
                        <tr
                          key={user.id}
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
                            {user.name || "—"}
                          </td>
                          <td
                            style={{
                              padding: "var(--spacing-md)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {user.email}
                          </td>
                          <td
                            style={{
                              padding: "var(--spacing-md)",
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            {user.organizations
                              ? user.organizations.map((org) => org.name).join(", ")
                              : user.organizationRole
                                ? "Current Org"
                                : "—"}
                          </td>
                          <td
                            style={{
                              padding: "var(--spacing-md)",
                            }}
                          >
                            {user.organizationRole ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "var(--spacing-xs) var(--spacing-sm)",
                                  borderRadius: "var(--radius-sm)",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                  background: "var(--color-surface-secondary)",
                                  color: "var(--color-text)",
                                }}
                              >
                                {user.organizationRole.name}
                              </span>
                            ) : (
                              <span
                                style={{
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "var(--spacing-md)",
                            }}
                          >
                            {user.globalRoles.length > 0 ? (
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
                            ) : (
                              <span
                                style={{
                                  color: "var(--color-text-secondary)",
                                }}
                              >
                                —
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "var(--spacing-md)",
                              textAlign: "right",
                            }}
                          >
                            <Link
                              href={`/admin/users/${user.id}`}
                              style={{
                                padding: "var(--spacing-xs) var(--spacing-md)",
                                fontSize: "0.875rem",
                                color: "var(--color-primary)",
                                textDecoration: "none",
                              }}
                            >
                              Edit
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
        </div>
      </main>
    </div>
  );
}
