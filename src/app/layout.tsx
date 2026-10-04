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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..700&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

