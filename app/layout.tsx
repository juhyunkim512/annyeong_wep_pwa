import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
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
  title: 'ANNYEONG · Korea Community',
  description:
    '한국에 오는 외국인을 위한 정착 커뮤니티 플랫폼. 비자, 휴대폰, 계좌, 주택, 아르바이트 등 한국 생활에 필요한 모든 정보와 네트워크를 연결해드립니다.',
  manifest: '/site.webmanifest',
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
    title: 'ANNYEONG',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-PEKSMFT9GZ"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-PEKSMFT9GZ');
          `}
        </Script>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
