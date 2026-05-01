'use client'

import { useState, useRef, useEffect } from 'react'
import i18n from '@/lib/i18n'
import { LANG_STORAGE_KEY } from '@/components/common/I18nProvider'

const LANGUAGES = [
  { code: 'ko', flag: '🇰🇷', label: 'Korean' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'ja', flag: '🇯🇵', label: 'Japanese' },
  { code: 'zh', flag: '🇨🇳', label: 'Chinese' },
  { code: 'es', flag: '🇪🇸', label: 'Spanish' },
  { code: 'vi', flag: '🇻🇳', label: 'Vietnamese' },
]

export default function LanguageSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentCode, setCurrentCode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LANG_STORAGE_KEY) ?? i18n.language ?? 'ko'
    }
    return 'ko'
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code)
    localStorage.setItem(LANG_STORAGE_KEY, code)
    setCurrentCode(code)
    setIsOpen(false)
  }

  const current = LANGUAGES.find(l => l.code === currentCode) ?? LANGUAGES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F7FAF8] border border-[#9DB8A0]/50 text-sm text-gray-700 hover:border-[#9DB8A0] hover:bg-white transition-colors"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="font-medium text-[13px]">{current.label}</span>
        <svg
          className={`w-3 h-3 text-[#9DB8A0] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                ${lang.code === currentCode
                  ? 'bg-[#9DB8A0]/10 text-[#4a7c5e] font-semibold'
                  : 'text-gray-600 hover:bg-[#F7FAF8]'
                }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
