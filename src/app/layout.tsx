import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Smart ICT Learning & AI Teacher Copilot",
    template: "%s | AI Teacher Copilot",
  },
  description:
    "AI-assisted teacher workspace for SSC/HSC ICT: lesson plans, quizzes, question banks, worksheets, rubrics and explanations — every AI draft reviewed and approved by the teacher.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
