import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@react-pdf/layout",
    "@react-pdf/pdfkit",
    "@react-pdf/font",
    "@react-pdf/image",
    "@react-pdf/png-js",
    "yoga-layout",
    "tesseract.js",
    "tesseract.js-core",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
    staleTimes: {
      dynamic: 30,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
