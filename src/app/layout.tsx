import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "EDF SABER Engineering Repository",
  description: "Database-native engineering workbook repository with traceability.",
  applicationName: "EDF SABER",
  authors: [{ name: "EDF SABER" }]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
