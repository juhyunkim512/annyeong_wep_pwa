/**
 * lib/translations/llm.ts
 *
 * OpenAI gpt-4o-mini 기반 번역 유틸.
 * 커뮤니티 UGC(게시글/댓글) 번역 전용.
 *
 * ⚠️ 서버 전용 — 'use client' 컴포넌트에서 직접 import 금지.
 */

import OpenAI from 'openai';

// ─────────────────────────────────────────────
// Client (singleton)
// ─────────────────────────────────────────────

let _openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!_openaiClient) {
    _openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openaiClient;
}

// ─────────────────────────────────────────────
// Language name map (short code → full name for prompt)
// ─────────────────────────────────────────────

const LANG_NAME: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  zh: 'Chinese (Simplified)',
  ja: 'Japanese',
  vi: 'Vietnamese',
  es: 'Spanish',
};

// ─────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────

/**
 * LLM 번역 호출.
 * 실패 시 null 반환 — 호출 측에서 Google fallback 처리.
 *
 * @param text        번역할 원문 텍스트
 * @param sourceLang  원문 언어 short code (e.g. 'ko', 'en')
 * @param targetLang  번역 대상 언어 short code (e.g. 'en', 'ja')
 * @returns           번역된 텍스트, 실패 시 null
 */
export async function llmTranslate(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  const sourceLabel = LANG_NAME[sourceLang] ?? sourceLang;
  const targetLabel = LANG_NAME[targetLang] ?? targetLang;

  const apiKey = process.env.OPENAI_API_KEY;

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content: `You are a translator for a community app used by foreigners living in Korea.

Rules:
- Translate from ${sourceLabel} to ${targetLabel}.
- Translate like a real native internet user.
- Use casual community tone (like comments on SNS).
- Do NOT use formal or written tone.
- If needed, slightly adapt expressions to sound natural.
- Preserve the original tone, humor, slang, and emotional nuance.
- If the source is grammatically incorrect or slangy, infer the most likely intended meaning.
- Preserve laughter expressions (haha, lol, ㅋㅋ) in a natural target-language equivalent.
- Return ONLY the translated text. No explanations, no quotes, no extra formatting.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
    });

    const result = response.choices[0]?.message?.content?.trim();
    if (!result) {
      console.warn('[llmTranslate] empty result from OpenAI');
      return null;
    }

    return result;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[llmTranslate] OpenAI error:', errMsg);
    if (err && typeof err === 'object' && 'status' in err) {
      console.error('[llmTranslate] HTTP status:', (err as { status: number }).status);
    }
    return null;
  }
}
