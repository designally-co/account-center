import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ToastHost } from "@/components/toast";
import { DialogMotion } from "@/components/dialog-motion";

export const metadata: Metadata = {
  title: "Account Center",
  description: "Accounts and access for the Designally apps",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ToastHost />
        <DialogMotion />
      </body>
    </html>
  );
}
