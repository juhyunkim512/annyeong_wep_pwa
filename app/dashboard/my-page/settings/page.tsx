'use client'

import { useRouter } from 'next/navigation';
import Link from 'next/link';

const SETTINGS_ITEMS = [
  { icon: '👤', label: 'edit profile', desc: 'Nickname, flag, and profile photo', href: '/dashboard/my-page/settings/profile' },
  { icon: '🔒', label: 'reset password', desc: 'Update your password', href: '/dashboard/my-page/settings/password' },
  { icon: '🌐', label: 'choose language', desc: 'Choose your preferred language', href: '/dashboard/my-page/settings/language' },
];

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-3xl font-bold">Settings</h1>
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
    </div>
  );
}
