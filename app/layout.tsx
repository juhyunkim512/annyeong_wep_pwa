import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

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
  keywords: [
    '유학생',
    '어학연수',
    '외국인',
    '한국',
    '정착',
    '커뮤니티',
    '생활정보',
  ],
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
