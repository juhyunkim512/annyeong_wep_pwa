'use client'

import { useTranslation } from 'react-i18next'
import '@/lib/i18n'

export default function ServicesPage() {
  const { t } = useTranslation('common')

  const services = [
    { icon: '🎯', title: t('services.vipPackage.title'), description: t('services.vipPackage.desc') },
    { icon: '📋', title: t('services.visa.title'), description: t('services.visa.desc') },
    { icon: '🏠', title: t('services.housing.title'), description: t('services.housing.desc') },
    { icon: '📱', title: t('services.phone.title'), description: t('services.phone.desc') },
    { icon: '🏦', title: t('services.bank.title'), description: t('services.bank.desc') },
    { icon: '📚', title: t('services.academy.title'), description: t('services.academy.desc') },
    { icon: '💼', title: t('services.job.title'), description: t('services.job.desc') },
  ]

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-2">{t('services.title')}</h1>
        <p className="text-gray-600">{t('services.subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition cursor-pointer"
          >
            <div className="text-4xl mb-3">{service.icon}</div>
            <h3 className="text-lg font-semibold mb-2">{service.title}</h3>
            <p className="text-gray-600 text-sm">{service.description}</p>
            <button className="mt-4 text-sm font-semibold text-[#9DB8A0] hover:underline">
              {t('services.learnMore')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
