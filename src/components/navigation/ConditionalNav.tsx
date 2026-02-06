"use client";

import { usePathname } from "next/navigation";
import { MainNavigation } from "@/components/navigation/MainNavigation";

/**
 * Conditionally renders MainNavigation.
 * Hidden on /cowork routes which have their own full-page layout.
 */
export function ConditionalNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/cowork")) {
    return null;
  }

  return <MainNavigation />;
}
