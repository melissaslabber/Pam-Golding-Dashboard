import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RENTALS DASHBOARD",
    short_name: "RENTALS DASHBOARD",
    description: "Tasks, reminders, team accountability and rental calendars in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#124f3d",
    theme_color: "#124f3d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
