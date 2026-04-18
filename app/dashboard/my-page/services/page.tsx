'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import ConsultModal from '@/components/common/ConsultModal'

export default function ServicesPage() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const [consultPurpose, setConsultPurpose] = useState<string | null>(null)

  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0)
  }, [])

  const services = [
    { icon: '🎯', title: t('services.vipPackage.title'), description: t('services.vipPackage.desc'), purpose: null },
    { icon: '📋', title: t('services.visa.title'),        description: t('services.visa.desc'),        purpose: 'short_study' },
    { icon: '🏠', title: t('services.housing.title'),    description: t('services.housing.desc'),    purpose: 'housing' },
    { icon: '📱', title: t('services.phone.title'),      description: t('services.phone.desc'),      purpose: 'phone' },
    { icon: '🏦', title: t('services.bank.title'),       description: t('services.bank.desc'),       purpose: 'bank' },
    { icon: '📚', title: t('services.academy.title'),    description: t('services.academy.desc'),    purpose: 'long_study' },
    { icon: '💼', title: t('services.job.title'),        description: t('services.job.desc'),        purpose: 'job' },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-2xl font-bold">{t('services.title')}</h1>
      </div>
      <p className="text-gray-600">{t('services.subtitle')}</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
            onClick={() => service.purpose && setConsultPurpose(service.purpose)}
          >
            <div className="text-4xl mb-3">{service.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
            <p className="text-gray-600 text-sm">{service.description}</p>
            {service.purpose ? (
              <button
                className="mt-4 text-sm font-semibold text-white bg-[#9DB8A0] hover:opacity-90 transition px-4 py-1.5 rounded-lg"
                onClick={(e) => { e.stopPropagation(); setConsultPurpose(service.purpose!) }}
              >
                {t('consult.applyBtn')}
              </button>
            ) : (
              <button className="mt-4 text-sm font-semibold text-[#9DB8A0] hover:underline">
                {t('services.learnMore')}
              </button>
            )}
          </div>
        ))}
      </div>

      <ConsultModal
        isOpen={consultPurpose !== null}
        onClose={() => setConsultPurpose(null)}
        defaultPurpose={consultPurpose ?? undefined}
      />
    </div>
  )
}

