import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Remy · agentic remodel",
    template: "%s · Remy",
  },
  description: "Remy helps a designer turn a room photo into remodel schemes a client can compare and commit to.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hans" translate="no">
      <body className="min-h-screen bg-sand text-ink antialiased">{children}</body>
    </html>
  );
}
