'use client';

import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { GatherMapPicker } from '@/components/gather/GatherMap';

const CONTENT_MAX = 100;

const CATEGORY_OPTIONS = ['language', 'drink', 'sports', 'food', 'talk', 'game', 'pet', 'travel', 'sing', 'movie', 'etc'] as const;

const TITLE_MAX = 40;

const MAX_OPTIONS = [2, 4, 6, 8];

const QUICK_LOCATIONS: { key: string; lat: number; lng: number }[] = [
  { key: 'hongdae', lat: 37.5563, lng: 126.9236 },
  { key: 'hapjeong', lat: 37.5495, lng: 126.9138 },
  { key: 'itaewon', lat: 37.5345, lng: 126.9946 },
  { key: 'gangnam', lat: 37.498, lng: 127.0276 },
  { key: 'kondae', lat: 37.5406, lng: 127.0699 },
  { key: 'seongsu', lat: 37.5447, lng: 127.056 },
];

interface WriteGatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
}

export default function WriteGatherModal({ isOpen, onClose, onRequireLogin }: WriteGatherModalProps) {
  const { t } = useTranslation('common');

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [locationTab, setLocationTab] = useState<'quick' | 'map'>('quick');
  const [selectedQuickLocation, setSelectedQuickLocation] = useState('');
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [timeOption, setTimeOption] = useState<'30' | '60' | '120' | 'custom'>('30');
  const [customTime, setCustomTime] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);

  const handleMapSelect = useCallback((lat: number, lng: number, label: string) => {
    setMapLocation({ lat, lng, label });
  }, []);

  const handleFullscreenMapSelect = useCallback((lat: number, lng: number, label: string) => {
    setMapLocation({ lat, lng, label });
    setShowFullscreenMap(false);
  }, []);

  const getMeetAt = (): string => {
    const now = new Date();
    switch (timeOption) {
      case '30':
        return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
      case '60':
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      case '120':
        return new Date(now.getTime() + 120 * 60 * 1000).toISOString();
      case 'custom':
        if (!customTime) return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
        // customTime은 "HH:mm" 형태
        const [h, m] = customTime.split(':').map(Number);
        const d = new Date();
        d.setHours(h, m, 0, 0);
        if (d < now) d.setDate(d.getDate() + 1); // 이미 지난 시간이면 내일
        return d.toISOString();
      default:
        return new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!category || !title.trim()) { setError(t('gather.write.fillRequired')); return; }

    const hasLocation = locationTab === 'quick'
      ? !!selectedQuickLocation
      : !!mapLocation;
    if (!hasLocation) { setError(t('gather.write.selectLocation')); return; }
    if (timeOption === 'custom' && !customTime) { setError(t('gather.write.fillRequired')); return; }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      onRequireLogin();
      return;
    }

    let uselanguage = 'korean';
    const { data: profile } = await supabase
      .from('profile')
      .select('uselanguage')
      .eq('id', session.user.id)
      .single();
    if (profile?.uselanguage) uselanguage = profile.uselanguage;

    const quickLoc = QUICK_LOCATIONS.find((l) => l.key === selectedQuickLocation);

    const body = {
      title: title.trim(),
      content: content || null,
      category,
      location_type: locationTab,
      location_label: locationTab === 'quick'
        ? t(`gather.locations.${selectedQuickLocation}`)
        : mapLocation!.label,
      lat: locationTab === 'quick' ? quickLoc?.lat : mapLocation?.lat,
      lng: locationTab === 'quick' ? quickLoc?.lng : mapLocation?.lng,
      meet_at: getMeetAt(),
      max_participants: maxParticipants,
      language: uselanguage,
    };

    try {
      const res = await fetch('/api/gather', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || t('gather.write.failed'));
        setLoading(false);
        return;
      }

      // 초기화
      setCategory('');
      setTitle('');
      setContent('');
      setLocationTab('quick');
      setSelectedQuickLocation('');
      setMapLocation(null);
      setTimeOption('30');
      setCustomTime('');
      setMaxParticipants(4);
      setLoading(false);
      onClose();
    } catch {
      setError(t('gather.write.failed'));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
    {/* 전체화면 지도 오버레이 */}
    {showFullscreenMap && (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => setShowFullscreenMap(false)}
            className="text-gray-600 text-xl leading-none"
          >
            ←
          </button>
          <span className="text-base font-semibold">위치 선택</span>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <GatherMapPicker
            onSelect={handleFullscreenMapSelect}
            hint={t('gather.write.tapToSelectLocation')}
            fullscreen
          />
        </div>
      </div>
    )}
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full p-5 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{t('gather.write.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={loading}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 주제 선택 */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('gather.write.category')}</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    category === cat
                      ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                  }`}
                >
                  {t(`gather.categories.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('gather.write.postTitle')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder={t('gather.write.postTitlePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] text-sm"
              disabled={loading}
            />
            <p className={`text-xs mt-1 text-right ${title.length >= TITLE_MAX ? 'text-red-500' : 'text-gray-400'}`}>
              {title.length}/{TITLE_MAX}
            </p>
          </div>

          {/* 내용 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold">{t('gather.write.content')}</label>
              <span className={`text-xs ${content.length >= CONTENT_MAX ? 'text-red-500' : 'text-gray-400'}`}>
                {content.length}/{CONTENT_MAX}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
              placeholder={t('gather.write.contentPlaceholder')}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] min-h-[60px] text-sm ${
                content.length >= CONTENT_MAX ? 'border-red-400' : 'border-gray-300'
              }`}
              disabled={loading}
            />
          </div>

          {/* 위치 선택 */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('gather.write.location')}</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setLocationTab('quick')}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition ${
                  locationTab === 'quick'
                    ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {t('gather.write.quickLocation')}
              </button>
              <button
                type="button"
                onClick={() => { setLocationTab('map'); setShowFullscreenMap(true); }}
                className={`flex-1 py-1.5 text-sm rounded-lg border transition ${
                  locationTab === 'map'
                    ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {t('gather.write.mapLocation')}
              </button>
            </div>

            {locationTab === 'quick' ? (
              <div className="flex flex-wrap gap-2">
                {QUICK_LOCATIONS.map((loc) => (
                  <button
                    key={loc.key}
                    type="button"
                    onClick={() => setSelectedQuickLocation(loc.key)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      selectedQuickLocation === loc.key
                        ? 'bg-[#f0f5f1] text-[#6b8f6e] border-[#9DB8A0] font-medium'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                    }`}
                  >
                    📍 {t(`gather.locations.${loc.key}`)}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                {mapLocation ? (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-sm text-gray-700 flex-1 truncate">📍 {mapLocation.label}</p>
                    <button
                      type="button"
                      onClick={() => setShowFullscreenMap(true)}
                      className="text-xs text-[#9DB8A0] border border-[#9DB8A0] px-2 py-1 rounded-lg shrink-0"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowFullscreenMap(true)}
                    className="w-full py-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-[#9DB8A0] hover:text-[#9DB8A0] transition"
                  >
                    🗺️ {t('gather.write.tapToSelectLocation')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 시간 선택 */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('gather.write.meetTime')}</label>
            <div className="flex flex-wrap gap-2">
              {(['30', '60', '120', 'custom'] as const).map((opt) => {
                const labels: Record<string, string> = {
                  '30': t('gather.write.meetTime30'),
                  '60': t('gather.write.meetTime60'),
                  '120': t('gather.write.meetTime120'),
                  custom: t('gather.write.meetTimeCustom'),
                };
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setTimeOption(opt)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      timeOption === opt
                        ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                    }`}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>
            {timeOption === 'custom' && (
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] text-sm"
              />
            )}
          </div>

          {/* 최대 인원 */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('gather.write.maxParticipants')}</label>
            <div className="flex gap-2">
              {MAX_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxParticipants(n)}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    maxParticipants === n
                      ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                  }`}
                >
                  {n}{t('gather.write.maxParticipantsUnit')}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? t('gather.write.saving') : t('gather.write.submit')}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
