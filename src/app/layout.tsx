import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CourseForge — Turn YouTube into Structured Learning Artifacts",
  description:
    "CourseForge pulls video structure and transcripts, synthesizes concepts into coherent curricula, and exports courses, articles, blogs, JSON, HTML, or PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
