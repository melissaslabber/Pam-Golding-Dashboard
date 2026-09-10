import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pam Golding Rentals Organiser",
  description: "Tasks, reminders, team accountability and rental calendars in one place.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  verification: {
    google: "j6pk5I0aZT7zxKYnSH_hG9lJjCbvNL0wXS8j8ZNq4HE",
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
