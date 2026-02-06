import type { Metadata } from "next";
import { CoworkProvider } from "@/lib/cowork/context";

export const metadata: Metadata = {
  title: "Cowork | Puzzel",
  description: "AI-powered task assistant",
};

export default function CoworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CoworkProvider>{children}</CoworkProvider>;
}
