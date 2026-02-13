"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  requiresAuth?: boolean;
  requiresRole?: string[];
  requiresPermission?: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

const userNavItems: NavItem[] = [{ href: "/", label: "Home" }];

const systemNavItems: NavItem[] = [
  {
    href: "/admin",
    label: "Admin Dashboard",
    requiresAuth: true,
    requiresRole: ["admin"],
  },
];

export function MainNavigation() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch user info - httpOnly cookie will be sent automatically
    // No need for Authorization header since we use cookies
    fetch("/api/auth/me", {
      credentials: "include", // Ensure cookies are sent
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Silently fail - user not authenticated
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Don't show navigation on admin pages (they have their own sidebar) or login page
  if (pathname.startsWith("/admin") || pathname === "/login") {
    return null;
  }

  // Filter nav items based on user permissions
  const visibleUserNavItems = userNavItems.filter((item) => {
    if (!item.requiresAuth) return true;
    if (!user) return false;
    if (
      item.requiresRole &&
      !item.requiresRole.some((role) => user.roles.includes(role))
    ) {
      return false;
    }
    if (
      item.requiresPermission &&
      !user.permissions.includes(item.requiresPermission)
    ) {
      return false;
    }
    return true;
  });

  const visibleSystemNavItems = systemNavItems.filter((item) => {
    if (!user) return false;
    if (
      item.requiresRole &&
      !item.requiresRole.some((role) => user.roles.includes(role))
    ) {
      return false;
    }
    return true;
  });

  const renderNavItem = (item: NavItem) => {
    const isActive =
      pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          style={{
            display: "block",
            padding: "var(--spacing-sm) var(--spacing-md)",
            borderRadius: "var(--radius-md)",
            textDecoration: "none",
            fontSize: "0.875rem",
            fontWeight: isActive ? 600 : 400,
            color: isActive ? "var(--color-primary)" : "var(--color-text)",
            background: isActive ? "var(--color-primary-10)" : "transparent",
            borderLeft: isActive
              ? "2px solid var(--color-primary)"
              : "2px solid transparent",
            transition: "all 0.15s ease",
            fontFamily: "var(--font-body)",
          }}
          onMouseEnter={(e) => {
            if (!isActive) {
              e.currentTarget.style.background =
                "var(--color-surface-secondary)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isActive) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <aside
      style={{
        width: "240px",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border-muted)",
        padding: "var(--spacing-lg)",
        height: "100%",
        overflowY: "auto",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flexShrink: 0 }}>
        <h2
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: "var(--spacing-xl)",
            fontFamily: "var(--font-display)",
            color: "var(--color-text)",
          }}
        >
          Puzzel Co-Work
        </h2>

        <nav>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-xs)",
            }}
          >
            {visibleUserNavItems.map(renderNavItem)}
          </ul>
        </nav>
      </div>

      {visibleSystemNavItems.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            marginTop: "var(--spacing-xl)",
            marginBottom: "var(--spacing-md)",
            paddingTop: "var(--spacing-xl)",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <h3
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--color-text-secondary)",
              marginBottom: "var(--spacing-md)",
              fontFamily: "var(--font-body)",
            }}
          >
            System
          </h3>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-xs)",
            }}
          >
            {visibleSystemNavItems.map(renderNavItem)}
          </ul>
        </div>
      )}

      <div
        style={{
          marginTop: "auto",
          paddingTop: "var(--spacing-xl)",
          borderTop: "1px solid var(--color-border-muted)",
        }}
      >
        {user ? (
          <div
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-secondary)",
              fontFamily: "var(--font-body)",
            }}
          >
            <div
              style={{
                fontWeight: 500,
                color: "var(--color-text)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              {user.name || user.email}
            </div>
            <div style={{ fontSize: "0.75rem" }}>{user.roles.join(", ")}</div>
            <button
              onClick={async () => {
                try {
                  // Call logout API to clear cookie and revoke token
                  await fetch("/api/auth/logout", {
                    method: "POST",
                    credentials: "include", // Ensure cookies are sent
                  });

                  // Redirect to login page
                  window.location.href = "/login";
                } catch (err) {
                  console.error("Logout error:", err);
                  // Even if API call fails, redirect to login
                  window.location.href = "/login";
                }
              }}
              style={{
                marginTop: "var(--spacing-md)",
                width: "100%",
                padding: "var(--spacing-xs) var(--spacing-md)",
                fontSize: "0.75rem",
                background: "transparent",
                color: "var(--color-text-secondary)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "var(--color-surface-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            style={{
              display: "block",
              padding: "var(--spacing-sm) var(--spacing-md)",
              fontSize: "0.875rem",
              fontWeight: 500,
              background: "var(--color-primary)",
              color: "var(--color-on-primary)",
              border: "none",
              borderRadius: "var(--radius-md)",
              textDecoration: "none",
              textAlign: "center",
              fontFamily: "var(--font-body)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--color-primary-dark)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-primary)";
            }}
          >
            Sign In
          </Link>
        )}
      </div>
    </aside>
  );
}
