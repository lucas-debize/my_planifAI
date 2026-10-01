import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyPlanifAI",
    short_name: "MyPlanifAI",
    start_url: "/semaine",
    display: "standalone",
    lang: "fr",
    background_color: "#2C4A3E",
    theme_color: "#2C4A3E",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
