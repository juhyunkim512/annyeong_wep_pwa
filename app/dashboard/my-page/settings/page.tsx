'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import DeleteAccountModal from '@/components/common/DeleteAccountModal';

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const SETTINGS_ITEMS = [
    { icon: '👤', label: t('settings.editProfile'), desc: t('settings.editProfileDesc'), href: '/dashboard/my-page/settings/profile' },
    { icon: '🔒', label: t('settings.resetPassword'), desc: t('settings.resetPasswordDesc'), href: '/dashboard/my-page/settings/password' },
    { icon: '🌐', label: t('settings.chooseLanguage'), desc: t('settings.chooseLanguageHint'), href: '/dashboard/my-page/settings/language' },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {SETTINGS_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer">
              <div className="flex items-center gap-4">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">›</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
        <button
          onClick={() => setIsDeleteOpen(true)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-red-50 active:bg-red-100 transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl">🗑️</span>
            <div className="text-left">
              <p className="font-semibold text-red-600">{t('settings.deleteAccount')}</p>
              <p className="text-xs text-gray-500 mt-0.5">{t('settings.deleteAccountDesc')}</p>
            </div>
          </div>
          <span className="text-red-400 text-lg">›</span>
        </button>
      </div>

      <DeleteAccountModal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} />
    </div>
  );
}
