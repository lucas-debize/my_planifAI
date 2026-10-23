import type { Metadata, Viewport } from "next"
import { Fraunces, Source_Sans_3 } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces-face",
  display: "swap",
  weight: ["500", "600", "700"],
})

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-face",
  display: "swap",
})

export const metadata: Metadata = {
  title: "MyPlanifAI",
  description: "Déjeuner et dîner, semaine après semaine.",
  appleWebApp: {
    capable: true,
    title: "MyPlanifAI",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#2C4A3E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${fraunces.variable} ${sourceSans.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink font-source">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
