import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";
import { ConditionalNav } from "@/components/navigation/ConditionalNav";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Puzzel Co-Work",
  description: "Collaborative workspace platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} antialiased`}
        style={{
          fontFamily: "var(--font-body)",
        }}
      >
        <div
          style={{
            display: "flex",
            height: "100vh",
            maxHeight: "100vh",
            overflow: "hidden",
          }}
        >
          <ConditionalNav />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
