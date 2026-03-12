'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import LoginModal from '@/components/common/LoginModal'

// ──────────────────────────────────────────
// Share Your Idea 모달
// ──────────────────────────────────────────
function ShareIdeaModal({ onClose }: { onClose: () => void }) {
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
      setError('Please fill in all required fields.')
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
      setError('Failed to submit. Please try again.')
      return
    }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">💡 Share Your Idea</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-semibold text-gray-800">Thanks for your idea!</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">We'll review it soon.</p>
            <button onClick={onClose} className="bg-[#9DB8A0] text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-400">*</span></label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                placeholder="Your idea in one line"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feature Area <span className="text-red-400">*</span></label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                value={featureArea}
                onChange={(e) => setFeatureArea(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="community">Community</option>
                <option value="service">Service</option>
                <option value="other">기타</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-400">*</span></label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
                rows={4}
                placeholder="Describe your idea in detail..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                  📷 Upload Image {images.length > 0 && `(${images.length}/3)`}
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
              {loading ? 'Submitting...' : 'Submit Idea'}
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
const HELP_TYPES = ['Visa / Residence', 'Housing', 'Job / Work', 'School / Education', 'Health / Hospital', 'Other']

function NeedHelpModal({ onClose }: { onClose: () => void }) {
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
      setError('Please fill in all required fields.')
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
      setError('Failed to send. Please try again.')
      return
    }
    setSuccess(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">🤝 Need More Help?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold text-gray-800">Your request has been sent!</p>
            <p className="text-sm text-gray-500 mt-1 mb-6">Our team will get back to you soon.</p>
            <button onClick={onClose} className="bg-[#9DB8A0] text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90">Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic <span className="text-red-400">*</span></label>
              <div className="flex flex-wrap gap-2">
                {HELP_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setHelpType(t)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      helpType === t ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-400">*</span></label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                placeholder="Brief summary of your issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Details <span className="text-red-400">*</span></label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
                rows={4}
                placeholder="Please describe what you need help with..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email / Contact (optional)</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                placeholder="Where should we reach you?"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Photo (optional)</label>
              <label className="flex items-center gap-2 cursor-pointer w-fit">
                <span className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                  📷 Upload Image {images.length > 0 && `(${images.length}/3)`}
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
              {loading ? 'Sending...' : 'Send Request'}
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
    { question: 'Is ANNYEONG really free?', answer: 'Community access and basic info are completely free. Some premium services may have costs, but initial consultation is always free.' },
    { question: 'How long does it take to get help?', answer: 'We respond within 1-2 hours for most inquiries. For urgent matters, we prioritize faster responses.' },
    { question: 'What documents do I need for a visa?', answer: 'It depends on your visa type. We offer personalized guidance - join the community or contact us for specific requirements.' },
    { question: 'Can I use ANNYEONG before arriving in Korea?', answer: 'Absolutely! Our platform helps people prepare before they arrive, so you can get a head start on settling in.' },
    { question: 'What languages are supported?', answer: 'We support Korean, English, Chinese, Japanese, Vietnamese. More languages coming soon!' },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl font-bold">Help & Support</h1>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Frequently Asked Questions</h2>
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
        <h2 className="text-2xl font-bold mb-2">Share Your Ideas</h2>
        <p className="text-gray-600 mb-4">Have a feature or service idea? Tell us! Good ideas are implemented and adopted suggestions earn rewards.</p>
        <button className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          onClick={() => requireAuth(() => setIsShareIdeaOpen(true))}>
          Share Your Idea
        </button>
      </section>

      {/* Need More Help */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-2xl font-bold mb-4">Need More Help?</h2>
        <p className="text-gray-600 mb-4">Can't find what you're looking for? Contact our team anytime.</p>
        <button className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
          onClick={() => requireAuth(() => setIsNeedHelpOpen(true))}>
          Contact Our Team
        </button>
      </section>

      {isShareIdeaOpen && <ShareIdeaModal onClose={() => setIsShareIdeaOpen(false)} />}
      {isNeedHelpOpen && <NeedHelpModal onClose={() => setIsNeedHelpOpen(false)} />}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  )
}
