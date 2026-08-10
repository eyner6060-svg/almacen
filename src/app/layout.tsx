import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { db } from "@/lib/db";
import { Providers } from "@/components/providers";
import "@/lib/jobs-init";
import type { SystemConfig } from "@/types";

// Garantizar que la configuración del sistema se lea de la base de datos
// en cada petición (no en build), para que los cambios de color/logo/nombre
// se apliquen al recargar o abrir desde otro navegador sin visitar CONFIGURACIÓN.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e40af" },
    { media: "(prefers-color-scheme: dark)", color: "#1e40af" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "Sistema de Gestión de Almacén",
    template: "%s | Sistema de Almacén",
  },
  description: "Sistema integral de gestión de almacén y activos patrimoniales. Gestión de inventario, pedidos, trazabilidad y más.",
  keywords: ["almacén", "inventario", "gestión", "patrimonial", "activos", "logística"],
  authors: [{ name: "Sistema de Almacén" }],
  manifest: "/manifest.json",
  icons: {
    apple: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Almacén",
  },
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    type: "website",
    siteName: "Sistema de Gestión de Almacén",
    title: "Sistema de Gestión de Almacén",
    description: "Sistema integral de gestión de almacén y activos patrimoniales",
    locale: "es_ES",
  },
  twitter: {
    card: "summary",
    title: "Sistema de Gestión de Almacén",
    description: "Sistema integral de gestión de almacén y activos patrimoniales",
  },
  applicationName: "Sistema de Almacén",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialConfig: SystemConfig | null = null
  try {
    const raw = await db.systemConfig.findFirst({ where: { id: 1 } })
    if (raw) {
      let exemptedRoles: string[] = []
      try { exemptedRoles = raw.exemptedRoles ? JSON.parse(raw.exemptedRoles) : [] } catch { exemptedRoles = [] }
      initialConfig = {
        ...raw,
        exemptedRoles,
        updatedAt: raw.updatedAt.toISOString(),
      } as unknown as SystemConfig
    }
  } catch {
    // Servidor puede no estar listo aun — el cliente reintentará via fetch
  }

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        {/* Meta etiquetas para PWA */}
        <meta name="application-name" content="Sistema de Almacén" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Almacén" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=yes" />
        <meta name="msapplication-TileColor" content="#1e40af" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        
        {/* Favicon inicial inline (se actualiza dinámicamente en cliente) */}
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'%3E%3Crect width='64' height='64' rx='12' fill='%231e40af'/%3E%3Crect x='12' y='22' width='40' height='30' rx='4' stroke='white' stroke-width='2.5' fill='none'/%3E%3Crect x='20' y='22' width='24' height='12' rx='2' fill='white' opacity='0.3'/%3E%3Cpath d='M24 34L24 50' stroke='white' stroke-width='2'/%3E%3Cpath d='M40 34L40 50' stroke='white' stroke-width='2'/%3E%3Crect x='16' y='38' width='32' height='12' rx='2' stroke='white' stroke-width='2' fill='none'/%3E%3Ccircle cx='32' cy='44' r='3' fill='white'/%3E%3Cpath d='M32 42L32 46M30 44L34 44' stroke='%231e40af' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E" />
      </head>
      <body
        className="antialiased bg-background text-foreground"
      >
        <Providers initialConfig={initialConfig}>
          {children}
        </Providers>
        {/* Registro de Service Worker tras load (no bloquea el primer paint) */}
        <Script src="/js/sw-register.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
