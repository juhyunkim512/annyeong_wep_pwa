'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import LoginModal from '@/components/common/LoginModal'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'

const HELP_TYPE_KEYS = ['visa', 'housing', 'job', 'school', 'health', 'other'] as const

// ──────────────────────────────────────────
// Share Your Idea 모달
// ──────────────────────────────────────────
function ShareIdeaModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const [title, setTitle] = useState('')
  const [featureArea, setFeatureArea] = useState('')
  const [body, setBody] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files).slice(0, 3)
    setImages(files)
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    setImages(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !featureArea || !body.trim()) {
      setError(t('help.shareIdea.fillRequired'))
      return
    }
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()

    // 이미지 업로드
    const imageUrls: string[] = []
    for (const file of images) {
      const ext = file.name.split('.').pop()
      const filePath = `${session?.user.id ?? 'anon'}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('help-attachments')
        .upload(filePath, file)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('help-attachments').getPublicUrl(filePath)
        imageUrls.push(urlData.publicUrl)
      }
    }

    const { error: dbErr } = await supabase.from('share_idea').insert({
      author_id: session?.user.id ?? null,
      title: title.trim(),
      feature: featureArea,
      description: body.trim(),
      image_url: imageUrls.length > 0 ? imageUrls : null,
    })

    setLoading(false)
    if (dbErr) {
      setError(t('help.shareIdea.submitFailed'))
      return
    }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('help.shareIdea.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold text-gray-800">{t('help.shareIdea.successTitle')}</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">{t('help.shareIdea.successDesc')}</p>
            <button onClick={onClose} className="bg-[#9DB8A0] text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90">{t('common.close')}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.shareIdea.ideaTitle')} <span className="text-red-400">*</span></label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                placeholder={t('help.shareIdea.ideaTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.shareIdea.featureArea')} <span className="text-red-400">*</span></label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                value={featureArea}
                onChange={(e) => setFeatureArea(e.target.value)}
              >
                <option value="">{t('help.shareIdea.featureAreaPlaceholder')}</option>
                <option value="community">{t('help.shareIdea.featureOptions.community')}</option>
                <option value="service">{t('help.shareIdea.featureOptions.service')}</option>
                <option value="other">{t('help.shareIdea.featureOptions.other')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.shareIdea.description')} <span className="text-red-400">*</span></label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
                rows={4}
                placeholder={t('help.shareIdea.descriptionPlaceholder')}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.shareIdea.photo')}</label>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                  {t('help.shareIdea.uploadImage')} {images.length > 0 && `(${images.length}/3)`}
                </span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              {previews.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img src={src} alt="preview" className="w-16 h-16 object-cover rounded-lg border" />
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-500 transition">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition">
              {loading ? t('help.shareIdea.submitting') : t('help.shareIdea.submitBtn')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Need More Help 모달
// ──────────────────────────────────────────
function NeedHelpModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const [helpType, setHelpType] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [contact, setContact] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files).slice(0, 3)
    setImages(files)
    setPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx)
    setImages(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!helpType || !title.trim() || !body.trim()) {
      setError(t('help.needHelp.fillRequired'))
      return
    }
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()

    // 이미지 업로드
    const imageUrls: string[] = []
    for (const file of images) {
      const ext = file.name.split('.').pop()
      const filePath = `${session?.user.id ?? 'anon'}/${crypto.randomUUID()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('help-attachments')
        .upload(filePath, file)
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('help-attachments').getPublicUrl(filePath)
        imageUrls.push(urlData.publicUrl)
      }
    }

    const { error: dbErr } = await supabase.from('help_request').insert({
      author_id: session?.user.id ?? null,
      topic: helpType,
      title: title.trim(),
      details: body.trim(),
      contact_email: contact.trim() || null,
      image_url: imageUrls.length > 0 ? imageUrls : null,
    })

    setLoading(false)
    if (dbErr) {
      setError(t('help.needHelp.sendFailed'))
      return
    }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{t('help.needHelp.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-800">{t('help.needHelp.successTitle')}</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">{t('help.needHelp.successDesc')}</p>
            <button onClick={onClose} className="bg-[#9DB8A0] text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90">{t('common.close')}</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2">
                {HELP_TYPE_KEYS.map((key) => (
                  <button key={key} type="button" onClick={() => setHelpType(key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      helpType === key ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                    }`}>
                    {t(`help.needHelp.topics.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.needHelp.ideaTitle')} <span className="text-red-400">*</span></label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                placeholder={t('help.needHelp.ideaTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.needHelp.details')} <span className="text-red-400">*</span></label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
                rows={4}
                placeholder={t('help.needHelp.detailsPlaceholder')}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.needHelp.contact')}</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                placeholder={t('help.needHelp.contactPlaceholder')}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('help.needHelp.photo')}</label>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                  {t('help.needHelp.uploadImage')} {images.length > 0 && `(${images.length}/3)`}
                </span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              </label>
              {previews.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {previews.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img src={src} alt="preview" className="w-16 h-16 object-cover rounded-lg border" />
                      <button type="button" onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-500 transition">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition">
              {loading ? t('help.needHelp.sending') : t('help.needHelp.sendBtn')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────
// Help Page
// ──────────────────────────────────────────
export default function HelpPage() {
  const { t } = useTranslation('common')
  const [isShareIdeaOpen, setIsShareIdeaOpen] = useState(false)
  const [isNeedHelpOpen, setIsNeedHelpOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  const requireAuth = async (action: () => void) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setIsLoginOpen(true)
    } else {
      action()
    }
  }

  const faqs = [
    { question: t('help.faqs.q1'), answer: t('help.faqs.a1') },
    { question: t('help.faqs.q2'), answer: t('help.faqs.a2') },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl font-bold">{t('help.title')}</h1>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-4">{t('help.faqTitle')}</h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <details key={idx} className="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-[#9DB8A0]">
              <summary className="font-semibold text-gray-900 hover:text-[#9DB8A0]">{faq.question}</summary>
              <p className="mt-3 text-gray-600 text-sm">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Share Idea */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-2">{t('help.shareIdeasTitle')}</h2>
        <p className="text-gray-600 mb-4">{t('help.shareIdeasDesc')}</p>
        <button className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          onClick={() => requireAuth(() => setIsShareIdeaOpen(true))}>
          {t('help.shareIdeasBtn')}
        </button>
      </section>

      {/* Need More Help */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-4">{t('help.needHelpTitle')}</h2>
        <p className="text-gray-600 mb-4">{t('help.needHelpDesc')}</p>
        <button className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          onClick={() => requireAuth(() => setIsNeedHelpOpen(true))}>
          {t('help.contactBtn')}
        </button>
      </section>

      {isShareIdeaOpen && <ShareIdeaModal onClose={() => setIsShareIdeaOpen(false)} />}
      {isNeedHelpOpen && <NeedHelpModal onClose={() => setIsNeedHelpOpen(false)} />}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  )
}
