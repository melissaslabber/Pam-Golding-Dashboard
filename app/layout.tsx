import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pam Golding Rentals Organiser",
  description: "Tasks, reminders, team accountability and rental calendars in one place.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
