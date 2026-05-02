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

  // [수정] 언어 선택 항목 제거 — 유저가 변경 못하도록
  const SETTINGS_ITEMS = [
    { icon: '/icons/camera.png', label: t('settings.editProfile'), href: '/dashboard/my-page/settings/profile' },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {SETTINGS_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer">
              <div className="flex items-center gap-4">
                <img src={item.icon} className="w-7 h-7 object-contain" />
                <div>
                  <p className="font-semibold text-gray-900">{item.label}</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">›</span>
            </div>
          </Link>
        ))}
        <button
          onClick={() => setIsDeleteOpen(true)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 active:bg-gray-100 transition cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <img src="/icons/no.png" className="w-7 h-7 object-contain" />
            <div className="text-left">
              <p className="font-semibold text-gray-900">{t('settings.deleteAccount')}</p>
            </div>
          </div>
          <span className="text-gray-400 text-lg">›</span>
        </button>
      </div>

      <DeleteAccountModal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} />
    </div>
  );
}
