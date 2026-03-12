'use client'

import { useState, useCallback, useEffect } from 'react'
import { LanguageCode } from '../translations/config'

// This is a client-side hook wrapper
// For actual translation, call your API endpoint

export function useTranslation() {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('ko')
  const [isLoading, setIsLoading] = useState(false)

  // Get language from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('preferredLanguage') as LanguageCode
    if (saved) {
      setCurrentLanguage(saved)
    }
  }, [])

  const translate = useCallback(
    async (text: string, targetLanguage?: LanguageCode) => {
      const target = targetLanguage || currentLanguage
      if (target === 'ko') return text // No translation needed for Korean

      setIsLoading(true)
      try {
        const response = await fetch('/api/translations/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, targetLanguage: target }),
        })

        if (!response.ok) throw new Error('Translation failed')
        const { translation } = await response.json()
        return translation
      } catch (error) {
        console.error('useTranslation error:', error)
        return text
      } finally {
        setIsLoading(false)
      }
    },
    [currentLanguage]
  )

  const setLanguage = useCallback((lang: LanguageCode) => {
    setCurrentLanguage(lang)
    localStorage.setItem('preferredLanguage', lang)
  }, [])

  return {
    currentLanguage,
    setLanguage,
    translate,
    isLoading,
  }
}
