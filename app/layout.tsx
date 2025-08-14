import type React from "react"
import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
})

export const metadata: Metadata = {
  title: "SEAP - Sistema de Evaluación Automática de Préstamos",
  description:
    "Sistema profesional para la evaluación automática de préstamos con integración BCRA y validaciones avanzadas",
  keywords: "préstamos, evaluación, BCRA, sistema financiero, comercializadores",
  authors: [{ name: "SEAP Team" }],
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="relative min-h-screen">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-40">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(148,163,184,0.3)_1px,_transparent_0)] bg-[length:20px_20px]" />
            </div>

            {/* Main Content */}
            <div className="relative z-10">{children}</div>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
