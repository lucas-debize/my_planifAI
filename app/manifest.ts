import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyPlanifAI — Planning & Recettes",
    short_name: "MyPlanifAI",
    description: "Planifiez vos repas et listes de courses en famille.",
    start_url: "/semaine",
    display: "standalone",
    orientation: "portrait-primary",
    lang: "fr",
    background_color: "#f4efe6",
    theme_color: "#f4efe6",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
