'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useTranslation('common')

  const menuItems = [
    { icon: '🏠', label: t('nav.main'), href: '/dashboard/home' },
    { icon: '💬', label: t('nav.community'), href: '/dashboard/community' },
    { icon: '🛠', label: t('nav.services'), href: '/dashboard/services' },
    { icon: '❓', label: t('nav.help'), href: '/dashboard/help' },
    { icon: '👤', label: t('nav.myPage'), href: '/dashboard/my-page' },
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

          </nav>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 md:mt-0 mt-24 overflow-auto">
        <div className="px-6 pt-0 pb-6 md:px-8 md:pt-2 md:pb-8">{children}</div>
      </main>
    </div>
  )
}