import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono, Cormorant_Garamond, Manrope } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist"
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono"
})
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant",
})
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
})

export const metadata: Metadata = {
  title: "DreamPlay Pianos | Blog",
  description: "Discover the world of luxury pianos through tutorials, artist stories, and product news from DreamPlay Pianos.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} ${manrope.variable} font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
