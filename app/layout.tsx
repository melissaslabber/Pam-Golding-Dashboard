import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pam Golding Rentals Organiser",
  description: "Tasks, reminders, team accountability and rental calendars in one place.",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
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
