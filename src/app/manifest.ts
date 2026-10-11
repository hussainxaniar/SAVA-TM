import type { MetadataRoute } from "next";

// Web app manifest (blueprint Section 17): lets Sava TM be added to the home screen, which iOS
// requires before it delivers web push. Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sava TM",
    short_name: "Sava TM",
    description: "Sava Task Manager — task management for teams",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
