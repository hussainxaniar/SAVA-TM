import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sava TM",
  description: "Sava Task Manager — task management for teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(inter.variable, jetbrainsMono.variable, "font-sans")} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
        {/* Section 4: toasts for errors only; success is silent. */}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
