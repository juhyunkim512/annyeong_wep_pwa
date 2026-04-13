'use client'

import Image from 'next/image'
import Link from 'next/link'

const steps = [
  { src: '/download1.png', alt: '1단계' },
  { src: '/download2.png', alt: '2단계' },
  { src: '/download3.png', alt: '3단계' },
  { src: '/download4.png', alt: '4단계' },
]

export default function IosInstallPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/guide" className="text-gray-500 hover:text-gray-700 transition text-xl">
            ←
          </Link>
          <h1 className="text-base font-bold text-gray-900">앱 설치 방법</h1>
        </div>
      </header>

      {/* Steps */}
      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {steps.map((step, idx) => (
          <div key={idx} className="rounded-2xl overflow-hidden shadow-sm">
            <Image
              src={step.src}
              alt={step.alt}
              width={600}
              height={900}
              className="w-full h-auto"
              priority={idx === 0}
            />
          </div>
        ))}

        {/* 완료 후 홈으로 버튼 */}
        <div className="pb-8 pt-2">
          <Link
            href="/dashboard/home"
            className="block w-full text-center bg-[#9DB8A0] text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-[#8AAD91] transition shadow-sm"
          >
            홈으로 가기
          </Link>
        </div>
      </main>
    </div>
  )
}
