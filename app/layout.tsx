import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import I18nProvider from '@/components/common/I18nProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'ANNYEONG - 안녕 | 외국인을 위한 한국 정착 커뮤니티',
  description:
    '한국에 오는 외국인을 위한 정착 커뮤니티 플랫폼. 비자, 휴대폰, 계좌, 주택, 아르바이트 등 한국 생활에 필요한 모든 정보와 네트워크를 연결해드립니다.',
  manifest: '/manifest.json',
  keywords: [
    '유학생',
    '어학연수',
    '외국인',
    '한국',
    '정착',
    '커뮤니티',
    '생활정보',
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'annyeong',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6B9E8A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
