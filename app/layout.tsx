import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitOps Deployment Dashboard",
  description: "Monitor GitOps health, synchronization, releases, workloads, and delivery metrics.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
