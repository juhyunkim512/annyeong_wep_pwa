'use client';

import React, { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';
import { useI18nLang } from '@/lib/hooks/useI18nLang';
import { useBodyScrollLock } from '@/lib/hooks/useBodyScrollLock';
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
  const { currentLang } = useI18nLang();
  useBodyScrollLock(isOpen);

  // 언어 → Intl locale 매핑
  const INTL_LOCALE: Record<string, string> = {
    ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP', es: 'es-ES', vi: 'vi-VN',
  };
  const intlLocale = INTL_LOCALE[currentLang] ?? 'en-US';

  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedQuickLocation, setSelectedQuickLocation] = useState('');
  const [mapLocation, setMapLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [showFullscreenMap, setShowFullscreenMap] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 날짜/시간 상태 (한국 시간 기준)
  const getNowKST = () => {
    const now = new Date();
    // UTC ms + 9시간 = KST
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
    return new Date(utcMs + 9 * 60 * 60 * 1000);
  };

  const nowKST = getNowKST();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = getNowKST();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedHour, setSelectedHour] = useState(() => {
    const m = getNowKST().getMinutes();
    const h = getNowKST().getHours();
    return m >= 50 ? (h + 1) % 24 : h;
  });
  const [selectedMinute, setSelectedMinute] = useState(() => {
    const m = getNowKST().getMinutes();
    if (m < 10) return 10;
    if (m < 20) return 20;
    if (m < 30) return 30;
    if (m < 40) return 40;
    if (m < 50) return 50;
    return 0;
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = getNowKST();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const formatDateLabel = (d: Date) => {
    return d.toLocaleDateString(intlLocale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };
  const formatTimeLabel = (h: number, m: number) => {
    const date = new Date();
    date.setHours(h, m, 0, 0);
    return date.toLocaleTimeString(intlLocale, { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  // 달력 계산
  const todayKST = new Date(nowKST);
  todayKST.setHours(0, 0, 0, 0);

  const calendarDays = (() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, month, i));
    return cells;
  })();

  const isPastDate = (d: Date) => d < todayKST;

  // 시간이 과거인지 확인 (선택 날짜가 오늘이면 현재 시각 기준)
  const isPastTime = (h: number, m: number) => {
    const selDate = new Date(selectedDate);
    selDate.setHours(0, 0, 0, 0);
    if (selDate.getTime() > todayKST.getTime()) return false;
    const nowH = nowKST.getHours();
    const nowM = nowKST.getMinutes();
    return h < nowH || (h === nowH && m <= nowM);
  };

  const minuteOptions = [0, 10, 20, 30, 40, 50];

  const handleMapSelect = useCallback((lat: number, lng: number, label: string) => {
    setMapLocation({ lat, lng, label });
  }, []);

  const handleFullscreenMapSelect = useCallback((lat: number, lng: number, label: string) => {
    setMapLocation({ lat, lng, label });
    setShowFullscreenMap(false);
  }, []);

  const getMeetAt = (): string => {
    // selectedDate는 KST 자정 기준 로컬 Date이므로 시/분 세팅 후 ISO 변환
    const d = new Date(selectedDate);
    d.setHours(selectedHour, selectedMinute, 0, 0);
    return d.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!category || !title.trim()) { setError(t('gather.write.fillRequired')); return; }

    const hasLocation = !!selectedQuickLocation || !!mapLocation;
    if (!hasLocation) { setError(t('gather.write.selectLocation')); return; }

    // 과거 시간 유효성 검사
    const meetAt = getMeetAt();
    if (new Date(meetAt).getTime() <= getNowKST().getTime()) {
      setError(t('gather.write.pastTimeError'));
      return;
    }

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
    const locationTab = selectedQuickLocation ? 'quick' : 'map';

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
      meet_at: meetAt,
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
      setSelectedQuickLocation('');
      setMapLocation(null);
      setSelectedDate(new Date(nowKST.getFullYear(), nowKST.getMonth(), nowKST.getDate()));
      setSelectedHour(nowKST.getHours());
      setSelectedMinute(nowKST.getMinutes() >= 50 ? 0 : Math.ceil((nowKST.getMinutes() + 1) / 10) * 10);
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
    {/* 날짜 바텀시트 */}
    {showDatePicker && (
      <div className="fixed inset-0 z-[200] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowDatePicker(false)} />
        <div className="relative bg-white rounded-t-2xl px-5 pt-4 pb-8">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          {/* 달력 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">
              {new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString(intlLocale, { year: 'numeric', month: 'long' })}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCalendarMonth((prev) => { const d = new Date(prev.year, prev.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">‹</button>
              <button type="button" onClick={() => setCalendarMonth((prev) => { const d = new Date(prev.year, prev.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">›</button>
            </div>
          </div>
          {/* 요일 */}
          <div className="grid grid-cols-7 text-center mb-1">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(2023, 0, i + 1); // 2023-01-01은 일요일
              return <span key={i} className="text-xs text-gray-400 py-1">{new Intl.DateTimeFormat(intlLocale, { weekday: 'short' }).format(d)}</span>;
            })}
          </div>
          {/* 날짜 */}
          <div className="grid grid-cols-7 text-center gap-y-1">
            {calendarDays.map((d, idx) => {
              if (!d) return <span key={idx} />;
              const past = isPastDate(d);
              const selected = d.toDateString() === selectedDate.toDateString();
              const isToday = d.toDateString() === todayKST.toDateString();
              return (
                <button key={idx} type="button" disabled={past}
                  onClick={() => { setSelectedDate(d); setShowDatePicker(false); }}
                  className={`mx-auto w-9 h-9 rounded-full text-sm flex items-center justify-center transition
                    ${past ? 'text-gray-300 cursor-not-allowed' : ''}
                    ${selected ? 'bg-[#9DB8A0] text-white font-bold' : ''}
                    ${!selected && isToday ? 'border border-[#9DB8A0] text-[#9DB8A0] font-semibold' : ''}
                    ${!selected && !past && !isToday ? 'hover:bg-gray-100 text-gray-800' : ''}
                  `}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setShowDatePicker(false)}
            className="mt-5 w-full py-3 bg-[#9DB8A0] text-white rounded-xl text-sm font-semibold">
            {t('common.confirm')}
          </button>
        </div>
      </div>
    )}

    {/* 시간 바텀시트 */}
    {showTimePicker && (
      <div className="fixed inset-0 z-[200] flex flex-col justify-end">
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowTimePicker(false)} />
        <div className="relative bg-white rounded-t-2xl px-5 pt-4 pb-8">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {/* 오전/오후 */}
            <div className="flex flex-col flex-1 border-r border-gray-200 max-h-52 overflow-y-auto">
              {[t('gather.write.am'), t('gather.write.pm')].map((ap, i) => {
                const isSelected = (selectedHour < 12) === (i === 0);
                return (
                  <button key={ap} type="button"
                    onClick={() => {
                      let newHour = selectedHour;
                      if (i === 0 && selectedHour >= 12) newHour = selectedHour - 12;
                      if (i === 1 && selectedHour < 12) newHour = selectedHour + 12;
                      // 전환 후 과거 시간이면 현재 KST 시각에 맞게 snap
                      const kst = getNowKST();
                      const selD = new Date(selectedDate);
                      selD.setHours(0, 0, 0, 0);
                      const todayD = new Date(kst);
                      todayD.setHours(0, 0, 0, 0);
                      if (selD.getTime() === todayD.getTime()) {
                        const nowH = kst.getHours();
                        const nowM = kst.getMinutes();
                        if (newHour < nowH || (newHour === nowH && selectedMinute <= nowM)) {
                          // 가장 가까운 미래 분으로 snap
                          const snapM = nowM < 50 ? Math.ceil((nowM + 1) / 10) * 10 : 0;
                          const snapH = nowM < 50 ? nowH : nowH + 1;
                          setSelectedHour(snapH % 24);
                          setSelectedMinute(snapM);
                          return;
                        }
                      }
                      setSelectedHour(newHour);
                    }}
                    className={`py-4 text-sm text-center transition ${isSelected ? 'bg-[#f0f5f1] text-[#6b8f6e] font-bold' : 'text-gray-500'}`}>
                    {ap}
                  </button>
                );
              })}
            </div>
            {/* 시 1~12 */}
            <div className="flex flex-col flex-1 border-r border-gray-200 max-h-52 overflow-y-auto">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h12) => {
                const h24 = selectedHour < 12 ? h12 % 12 : (h12 % 12) + 12;
                const past = isPastTime(h24, selectedMinute);
                const isSelected = selectedHour % 12 === h12 % 12;
                return (
                  <button key={h12} type="button" disabled={past} onClick={() => setSelectedHour(h24)}
                    className={`py-3 text-sm text-center transition cursor-pointer
                      ${past ? 'text-gray-300 cursor-not-allowed' : isSelected ? 'bg-[#f0f5f1] text-[#6b8f6e] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {h12}
                  </button>
                );
              })}
            </div>
            {/* 분 */}
            <div className="flex flex-col flex-1 max-h-52 overflow-y-auto">
              {minuteOptions.map((m) => {
                const past = isPastTime(selectedHour, m);
                const isSelected = selectedMinute === m;
                return (
                  <button key={m} type="button" disabled={past} onClick={() => setSelectedMinute(m)}
                    className={`py-3 text-sm text-center transition
                      ${past ? 'text-gray-300 cursor-not-allowed' : isSelected ? 'bg-[#f0f5f1] text-[#6b8f6e] font-bold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {String(m).padStart(2, '0')}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={() => setShowTimePicker(false)}
            className="mt-5 w-full py-3 bg-[#9DB8A0] text-white rounded-xl text-sm font-semibold">
            {t('common.confirm')}
          </button>
        </div>
      </div>
    )}

    {/* 전체화면 지도 오버레이 */}
    {showFullscreenMap && (
      <div className="fixed inset-0 z-[300] bg-white flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 shrink-0">
          <button
            type="button"
            onClick={() => setShowFullscreenMap(false)}
            className="text-gray-600 text-xl leading-none"
          >
            ←
          </button>
          <span className="text-base font-semibold">{t('gather.write.mapSelectTitle')}</span>
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm overscroll-none flex items-end sm:items-center justify-center z-50">
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

          {/* 날짜 선택 */}
          <div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{t('gather.write.dateLabel')}</span>
              <button
                type="button"
                onClick={() => { setShowDatePicker(true); setShowTimePicker(false); }}
                className="flex items-center gap-1 text-sm text-gray-800 font-medium"
              >
                {formatDateLabel(selectedDate)}
                <span className="text-gray-400 text-base leading-none">⌵</span>
              </button>
            </div>
          </div>

          {/* 시간 선택 */}
          <div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{t('gather.write.timeLabel')}</span>
              <button
                type="button"
                onClick={() => { setShowTimePicker(true); setShowDatePicker(false); }}
                className="flex items-center gap-1 text-sm text-gray-800 font-medium"
              >
                {formatTimeLabel(selectedHour, selectedMinute)}
                <span className="text-gray-400 text-base leading-none">⌵</span>
              </button>
            </div>
          </div>

          {/* 위치 선택 */}
          <div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{t('gather.write.locationLabel')}</span>
              <button
                type="button"
                onClick={() => setShowFullscreenMap(true)}
                className="flex items-center gap-1 text-sm text-gray-500"
              >
                {t('gather.write.customSelect')}
                <span className="text-gray-400">›</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {QUICK_LOCATIONS.map((loc) => (
                <button
                  key={loc.key}
                  type="button"
                  onClick={() => { setSelectedQuickLocation(loc.key); setMapLocation(null); }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    selectedQuickLocation === loc.key
                      ? 'bg-[#f0f5f1] text-[#6b8f6e] border-[#9DB8A0] font-medium'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-[#9DB8A0]'
                  }`}
                >
                  📍 {t(`gather.locations.${loc.key}`)}
                </button>
              ))}
              {mapLocation && (
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-[#f0f5f1] text-[#6b8f6e] border border-[#9DB8A0] font-medium">
                  📍 {mapLocation.label}
                  <button type="button" onClick={() => setMapLocation(null)} className="ml-1 text-gray-400 text-xs">✕</button>
                </div>
              )}
            </div>
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
