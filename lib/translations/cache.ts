type CacheEntry = {
  translatedText: string
  timestamp: number
}

interface TranslationCache {
  [key: string]: CacheEntry
}

const translationCache: TranslationCache = {}

const TTL = 1000 * 60 * 60 * 24 // 24 hours

export function getCachedTranslation(
  text: string,
  targetLanguage: string
): string | null {
  const key = `${text}:${targetLanguage}`
  const cached = translationCache[key]

  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.translatedText
  }

  // Remove expired entry
  if (cached) {
    delete translationCache[key]
  }

  return null
}

export function setCachedTranslation(
  text: string,
  targetLanguage: string,
  translatedText: string
): void {
  const key = `${text}:${targetLanguage}`
  translationCache[key] = {
    translatedText,
    timestamp: Date.now(),
  }
}

export function clearTranslationCache(): void {
  Object.keys(translationCache).forEach((key) => {
    delete translationCache[key]
  })
}

export function getCacheSize(): number {
  return Object.keys(translationCache).length
}
