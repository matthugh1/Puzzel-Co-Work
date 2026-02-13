"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  memberCount: number;
  createdAt: string;
}

interface Member {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  role: {
    id: string;
    name: string;
  } | null;
  joinedAt: string;
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orgId) {
      loadOrganization();
      loadMembers();
    }
  }, [orgId]);

  const loadOrganization = async () => {
    try {
      const response = await fetch(`/api/organizations/${orgId}`, {
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to load organization");
      }

      const data = await response.json();
      setOrganization(data.organization);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load organization";
      setError(errorMessage);
      console.error("Error loading organization:", err);
    }
  };

  const loadMembers = async () => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load members");
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (err) {
      console.error("Error loading members:", err);
    } finally {
      setLoading(false);
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

  if (error || !organization) {
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
            <strong>Error:</strong> {error || "Organization not found"}
          </div>
        </main>
      </div>
    );
  }

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
          <div>
            <h1
              style={{
                fontSize: "2.25rem",
                fontWeight: 700,
                margin: 0,
                fontFamily: "var(--font-display)",
                color: "var(--color-text)",
              }}
            >
              {organization.name}
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--color-text-secondary)",
                marginTop: "var(--spacing-xs)",
                fontFamily: "monospace",
              }}
            >
              {organization.slug}
            </p>
          </div>
          <Link
            href="/admin/organizations"
            style={{
              padding: "var(--spacing-sm) var(--spacing-lg)",
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
              textDecoration: "none",
            }}
          >
            ← Back to Organizations
          </Link>
        </div>
      </header>

      <main className="page-content">
        <div
          style={{
            padding: "var(--spacing-lg)",
            display: "grid",
            gap: "var(--spacing-xl)",
          }}
        >
          {/* Organization Info */}
          <div
            style={{
              padding: "var(--spacing-lg)",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}
          >
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                marginBottom: "var(--spacing-md)",
                color: "var(--color-text)",
              }}
            >
              Organization Details
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "var(--spacing-md)",
              }}
            >
              <dt
                style={{
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                }}
              >
                Status:
              </dt>
              <dd>
                <span
                  style={{
                    display: "inline-block",
                    padding: "var(--spacing-xs) var(--spacing-sm)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    background: organization.isActive
                      ? "var(--color-success-bg)"
                      : "var(--color-danger-bg)",
                    color: organization.isActive
                      ? "var(--color-success-text)"
                      : "var(--color-danger-text)",
                  }}
                >
                  {organization.isActive ? "Active" : "Inactive"}
                </span>
              </dd>
              <dt
                style={{
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                }}
              >
                Members:
              </dt>
              <dd>{organization.memberCount}</dd>
              <dt
                style={{
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                }}
              >
                Created:
              </dt>
              <dd>{new Date(organization.createdAt).toLocaleDateString()}</dd>
            </dl>
          </div>

          {/* Members List */}
          <div
            style={{
              padding: "var(--spacing-lg)",
              background: "var(--color-surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--spacing-md)",
              }}
            >
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                Members ({members.length})
              </h2>
            </div>

            {members.length === 0 ? (
              <p
                style={{
                  color: "var(--color-text-secondary)",
                  textAlign: "center",
                  padding: "var(--spacing-xl)",
                }}
              >
                No members yet.
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
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
                      }}
                    >
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr
                      key={member.userId}
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
                        {member.user.name || "—"}
                      </td>
                      <td
                        style={{
                          padding: "var(--spacing-md)",
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {member.user.email}
                      </td>
                      <td
                        style={{
                          padding: "var(--spacing-md)",
                        }}
                      >
                        {member.role ? (
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
                            {member.role.name}
                          </span>
                        ) : (
                          <span
                            style={{
                              color: "var(--color-text-secondary)",
                            }}
                          >
                            No role
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "var(--spacing-md)",
                          color: "var(--color-text-secondary)",
                          fontSize: "0.875rem",
                        }}
                      >
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
