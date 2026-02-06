"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface DashboardStats {
  organizationCount: number;
  userCount: number;
  activeOrganizations: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch organizations and users to calculate stats
      const [orgsRes, usersRes] = await Promise.all([
        fetch("/api/organizations"),
        fetch("/api/users"),
      ]);

      if (!orgsRes.ok || !usersRes.ok) {
        throw new Error("Failed to load stats");
      }

      const orgsData = await orgsRes.json();
      const usersData = await usersRes.json();

      setStats({
        organizationCount: orgsData.organizations?.length || 0,
        userCount: usersData.users?.length || 0,
        activeOrganizations:
          orgsData.organizations?.filter((o: any) => o.isActive).length || 0,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load stats";
      setError(errorMessage);
      console.error("Error loading stats:", err);
    } finally {
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
          Admin Dashboard
        </h1>
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
            Loading dashboard...
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

        {!loading && !error && stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "var(--spacing-lg)",
              padding: "var(--spacing-lg)",
            }}
          >
            <div
              style={{
                padding: "var(--spacing-lg)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  margin: "0 0 var(--spacing-sm) 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Organizations
              </h3>
              <p
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  margin: 0,
                }}
              >
                {stats.organizationCount}
              </p>
            </div>

            <div
              style={{
                padding: "var(--spacing-lg)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  margin: "0 0 var(--spacing-sm) 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Users
              </h3>
              <p
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  margin: 0,
                }}
              >
                {stats.userCount}
              </p>
            </div>

            <div
              style={{
                padding: "var(--spacing-lg)",
                background: "var(--color-surface)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
              }}
            >
              <h3
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  margin: "0 0 var(--spacing-sm) 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Active Organizations
              </h3>
              <p
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--color-text)",
                  margin: 0,
                }}
              >
                {stats.activeOrganizations}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
