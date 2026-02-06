"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/users", label: "Users" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: "240px",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
        padding: "var(--spacing-lg)",
        height: "100%",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          marginBottom: "var(--spacing-xl)",
          fontFamily: "var(--font-display)",
          color: "var(--color-text)",
        }}
      >
        Admin Panel
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
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  style={{
                    display: "block",
                    padding: "var(--spacing-sm) var(--spacing-md)",
                    borderRadius: "var(--radius-sm)",
                    color: isActive
                      ? "var(--color-primary)"
                      : "var(--color-text-secondary)",
                    background: isActive
                      ? "var(--color-primary-bg)"
                      : "transparent",
                    textDecoration: "none",
                    fontWeight: isActive ? 600 : 400,
                    transition: "all 0.2s",
                  }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
