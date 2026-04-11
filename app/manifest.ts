import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ANNYEONG - 안녕',
    short_name: 'annyeong',
    description: '외국인을 위한 한국 정착 커뮤니티',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#6B9E8A',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
