'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'

const SNS_OPTIONS = ['KakaoTalk', 'LINE', 'WeChat', 'WhatsApp']

const PURPOSE_OPTIONS = [
  { value: 'short_study', labelKey: 'consult.purpose.shortStudy' },
  { value: 'long_study',  labelKey: 'consult.purpose.longStudy' },
  { value: 'housing',     labelKey: 'consult.purpose.housing' },
  { value: 'phone',       labelKey: 'consult.purpose.phone' },
  { value: 'bank',        labelKey: 'consult.purpose.bank' },
  { value: 'job',         labelKey: 'consult.purpose.job' },
]

interface ConsultModalProps {
  isOpen: boolean
  onClose: () => void
  defaultPurpose?: string   // 클릭한 서비스에 따라 기본 목적 선택
}

export default function ConsultModal({ isOpen, onClose, defaultPurpose }: ConsultModalProps) {
  const { t } = useTranslation('common')

  const [name, setName]       = useState('')
  const [age, setAge]         = useState('')
  const [gender, setGender]   = useState('')
  const [email, setEmail]     = useState('')
  const [sns, setSns]         = useState('')
  const [snsId, setSnsId]     = useState('')
  const [purposes, setPurposes] = useState<string[]>(defaultPurpose ? [defaultPurpose] : [])
  const [memo, setMemo]       = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const togglePurpose = (v: string) => {
    setPurposes((prev) =>
      prev.includes(v) ? prev.filter((p) => p !== v) : [...prev, v]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || purposes.length === 0) return
    setLoading(true)
    // TODO: Supabase insert 또는 이메일 전송 연동
    await new Promise((res) => setTimeout(res, 800)) // 임시 딜레이
    setLoading(false)
    setSubmitted(true)
  }

  const handleClose = () => {
    setName(''); setAge(''); setGender(''); setEmail('')
    setSns(''); setSnsId(''); setPurposes(defaultPurpose ? [defaultPurpose] : [])
    setMemo(''); setSubmitted(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">
            {t('consult.modalTitle')}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          /* 제출 완료 화면 */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('consult.successTitle')}</h3>
            <p className="text-gray-500 text-sm mb-6">{t('consult.successDesc')}</p>
            <button
              onClick={handleClose}
              className="bg-[#9DB8A0] text-white px-8 py-2.5 rounded-xl font-semibold hover:opacity-90 transition"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* 이름 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('consult.name')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('consult.namePlaceholder')}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                required
              />
            </div>

            {/* 나이 + 성별 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('consult.age')}
                </label>
                <input
                  type="number"
                  value={age}
                  min={1} max={99}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {t('consult.gender')}
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] bg-white"
                >
                  <option value="">{t('consult.genderSelect')}</option>
                  <option value="male">{t('consult.male')}</option>
                  <option value="female">{t('consult.female')}</option>
                  <option value="other">{t('consult.genderOther')}</option>
                </select>
              </div>
            </div>

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('consult.email')} <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                required
              />
            </div>

            {/* SNS */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('consult.sns')}
              </label>
              <div className="flex gap-2 flex-wrap mb-2">
                {SNS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSns(sns === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      sns === s
                        ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                        : 'border-gray-300 text-gray-600 hover:border-[#9DB8A0]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {sns && (
                <input
                  type="text"
                  value={snsId}
                  onChange={(e) => setSnsId(e.target.value)}
                  placeholder={t('consult.snsIdPlaceholder', { sns })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                />
              )}
            </div>

            {/* 목적 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('consult.purpose.label')} <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                {PURPOSE_OPTIONS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePurpose(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      purposes.includes(p.value)
                        ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                        : 'border-gray-300 text-gray-600 hover:border-[#9DB8A0]'
                    }`}
                  >
                    {t(p.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {t('consult.memo')}
              </label>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={t('consult.memoPlaceholder')}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
              />
            </div>

            {/* 제출 */}
            <button
              type="submit"
              disabled={loading || !name || !email || purposes.length === 0}
              className="w-full bg-[#9DB8A0] text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('consult.submit')}
            </button>

            <p className="text-xs text-gray-400 text-center pb-2">
              {t('consult.privacyNote')}
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
