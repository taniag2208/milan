import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MILAN · Spa de uñas y pestañas',
    short_name: 'MILAN',
    description: 'Agenda, clientas, ventas e inventario de MILAN.',
    lang: 'es-CO',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf8f1',
    theme_color: '#fbf8f1',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nueva cita', url: '/agenda/nueva', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Agenda de hoy', url: '/agenda', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
