'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [selectedLang, setSelectedLang] = useState<string>('en')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const menuItems = [
    { icon: '🏠', label: 'Main', href: '/dashboard/home' },
    { icon: '💬', label: 'Community', href: '/dashboard/community' },
    { icon: '🛠', label: 'Services', href: '/dashboard/services' },
    { icon: '❓', label: 'Help', href: '/dashboard/help' },
    { icon: '👤', label: 'My page', href: '/dashboard/my-page' },
  ]

  const languages = [
    { code: 'en', label: '🇬🇧 English' },
    { code: 'ko', label: '🇰🇷 한국어' },
    { code: 'zh', label: '🇨🇳 中文' },
    { code: 'vi', label: '🇻🇳 Tiếng Việt' },
    { code: 'ja', label: '🇯🇵 日本語' },
  ]

  return (
    <div className="min-h-screen bg-[#F7FAF8] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <Link
            href="/dashboard/home"
            className="flex items-center gap-2 text-xl font-bold text-[#9DB8A0]"
          >
            <Image
              src="/logo.png"
              alt="ANNYEONG logo"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
            ANNYEONG
          </Link>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-6 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-[#9DB8A0] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Language Selector */}
        <div className="p-6 border-t border-gray-100">
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:border-[#9DB8A0]"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden w-full fixed top-0 z-40 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <Link
            href="/dashboard/home"
            className="flex items-center gap-2 text-lg font-bold text-[#9DB8A0]"
          >
            <Image
              src="/logo.png"
              alt="ANNYEONG logo"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
            ANNYEONG
          </Link>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="border-t border-gray-200 p-4 space-y-2 bg-white">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm mt-4 focus:outline-none focus:border-[#9DB8A0]"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </nav>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 md:mt-0 mt-24 overflow-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  )
}