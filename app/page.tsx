'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F7FAF8] text-gray-900 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-4xl space-y-8">

        {/* Logo & Tagline */}
        <div className="mb-8 flex flex-col items-center">
          
          {/* Logo + Title */}
          <div className="flex items-center gap-1 mb-3">
            <Image
              src="/logo.png"
              alt="ANNYEONG logo"
              width={70}   // 🔥 1.5배 확대
              height={70}
              priority
            />
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900">
              ANNYEONG
            </h1>
          </div>


        </div>
        {/* Main CTA Button */}
        <Link
          href="/dashboard/home"
          className="inline-flex items-center gap-2 rounded-2xl bg-[#9DB8A0] text-white px-8 md:px-12 py-5 md:py-6 text-lg md:text-xl font-semibold hover:opacity-90 transition shadow-lg"
        >
          🇰🇷 Start Your Life in Korea
        </Link>

        {/* Sub text */}
        <div className="mt-12 text-sm text-gray-500 max-w-4xl mx-auto">
          {/* 데스크탑에서는 한 줄, 모바일에서는 자동 줄바꿈 */}
          <p className="md:whitespace-nowrap">
            Moving all the way to Korea is already hard enough.
          </p>

          <p className="md:whitespace-nowrap">
            Just bring yourself !!! we’ll take care of the rest ☺️
          </p>
        </div>

      </div>
    </div>
  )
}