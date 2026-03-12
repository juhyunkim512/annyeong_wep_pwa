import { v2 } from '@google-cloud/translate'
const { Translate } = v2
import { getCachedTranslation, setCachedTranslation } from './cache'
import { LanguageCode } from './config'

let translateClient: v2.Translate | null = null

function getTranslateClient(): v2.Translate {
  if (!translateClient) {
    translateClient = new Translate({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      key: process.env.GOOGLE_CLOUD_API_KEY,
    })
  }
  return translateClient
}

export async function translateText(
  text: string,
  targetLanguage: LanguageCode
): Promise<string> {
  // Check cache first
  const cached = getCachedTranslation(text, targetLanguage)
  if (cached) {
    return cached
  }

  try {
    const client = getTranslateClient()
    const [translation] = await client.translate(text, targetLanguage)
    
    // Cache the result
    setCachedTranslation(text, targetLanguage, translation)
    
    return translation
  } catch (error) {
    console.error('Translation error:', error)
    return text // Fallback to original text on error
  }
}

export async function translateBatch(
  texts: string[],
  targetLanguage: LanguageCode
): Promise<string[]> {
  try {
    const client = getTranslateClient()
    const [translations] = await client.translate(texts, targetLanguage)
    
    // Cache each result
    if (Array.isArray(texts) && Array.isArray(translations)) {
      texts.forEach((text, index) => {
        setCachedTranslation(text, targetLanguage, translations[index])
      })
    }
    
    return Array.isArray(translations) ? translations : [translations]
  } catch (error) {
    console.error('Batch translation error:', error)
    return texts // Fallback to original texts on error
  }
}

export async function detectLanguage(text: string): Promise<LanguageCode> {
  try {
    const client = getTranslateClient()
    const [detection] = await client.detect(text)
    
    const detectedLanguage = Array.isArray(detection)
      ? detection[0].language
      : detection.language
    
    return detectedLanguage as LanguageCode
  } catch (error) {
    console.error('Language detection error:', error)
    return 'en' // Default fallback
  }
}
