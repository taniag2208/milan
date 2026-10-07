import type { Metadata, Viewport } from 'next'
import { Bodoni_Moda, Jost } from 'next/font/google'
import './globals.css'

const bodoni = Bodoni_Moda({ subsets: ['latin'], variable: '--font-bodoni', display: 'swap' })
const jost = Jost({ subsets: ['latin'], variable: '--font-jost', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'MILAN', template: '%s · MILAN' },
  description: 'Administración de MILAN, spa de uñas y pestañas.',
  applicationName: 'MILAN',
  appleWebApp: { capable: true, title: 'MILAN', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#fbf8f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${bodoni.variable} ${jost.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  )
}
