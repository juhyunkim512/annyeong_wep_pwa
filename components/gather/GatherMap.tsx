'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useI18nLang } from '@/lib/hooks/useI18nLang';
import '@/lib/i18n';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Google Maps 언어 코드 매핑 (앱 lang → Google Maps language param)
const GOOGLE_MAPS_LANG: Record<string, string> = {
  ko: 'ko',
  en: 'en',
  zh: 'zh-CN',
  ja: 'ja',
  es: 'es',
  vi: 'vi',
};

let mapsLoaded = false;
let mapsLoadedLang = '';
let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(lang: string = 'en'): Promise<void> {
  const googleLang = GOOGLE_MAPS_LANG[lang] ?? 'en';

  // 이미 같은 언어로 로드됨
  if (mapsLoaded && mapsLoadedLang === lang) return Promise.resolve();

  // 다른 언어로 로드된 경우 → 기존 스크립트 제거 후 재로드
  if (mapsLoaded && mapsLoadedLang !== lang) {
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) existing.remove();
    if ((window as any).google?.maps) {
      delete (window as any).google.maps;
    }
    mapsLoaded = false;
    mapsLoadedLang = '';
    mapsLoadPromise = null;
  }

  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('SSR');
    if ((window as any).google?.maps) {
      mapsLoaded = true;
      mapsLoadedLang = lang;
      return resolve();
    }
    if (!GOOGLE_MAPS_API_KEY) return reject('No API key');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&language=${googleLang}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      mapsLoaded = true;
      mapsLoadedLang = lang;
      resolve();
    };
    script.onerror = () => reject('Failed to load Google Maps');
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

// ─── 지도에서 위치 선택 컴포넌트 (중앙 고정 핀 방식) ──────────────────────────
interface GatherMapPickerProps {
  onSelect: (lat: number, lng: number, label: string) => void;
  hint?: string;
  fullscreen?: boolean;
}

export function GatherMapPicker({ onSelect, hint, fullscreen }: GatherMapPickerProps) {
  const { t } = useTranslation('common');
  const { currentLang } = useI18nLang();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [selected, setSelected] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    // 언어가 바뀌면 기존 지도 인스턴스 파괴 후 재초기화
    mapInstance.current = null;
    setReady(false);
    setCurrentAddress('');
    setSelected(false);
    loadGoogleMaps(currentLang)
      .then(() => setReady(true))
      .catch(() => {});
  }, [currentLang]);

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const map = new (window as any).google.maps.Map(mapRef.current, {
      center: { lat: 37.5665, lng: 126.978 },
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy', // 한 손가락 드래그 허용
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstance.current = map;

    // 지도 이동이 멈추면 중심 좌표의 동 이름 역지오코딩
    map.addListener('idle', () => {
      const c = map.getCenter();
      if (!c) return;
      const lat = c.lat();
      const lng = c.lng();
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const comps = results[0].address_components as { long_name: string; types: string[] }[];
          // 동(sublocality_level_2/3) → 구(sublocality_level_1) → 시(locality) 순서로 fallback
          const dong = comps.find((c) =>
            c.types.includes('sublocality_level_2') || c.types.includes('sublocality_level_3')
          )?.long_name;
          const gu = comps.find((c) => c.types.includes('sublocality_level_1'))?.long_name;
          const city = comps.find((c) => c.types.includes('locality'))?.long_name;
          setCurrentAddress(dong || gu || city || results[0].formatted_address);
        } else {
          setCurrentAddress(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
        setSelected(false);
      });
    });
  }, [ready]);

  const handleConfirm = useCallback(() => {
    if (!mapInstance.current || !currentAddress) return;
    setConfirming(true);
    const c = mapInstance.current.getCenter();
    const lat = c.lat();
    const lng = c.lng();
    onSelect(lat, lng, currentAddress);
    setSelected(true);
    setConfirming(false);
  }, [currentAddress, onSelect]);

  const handleCurrentLocation = () => {
    if (!mapInstance.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      mapInstance.current.panTo({ lat: latitude, lng: longitude });
      mapInstance.current.setZoom(16);
    });
  };

  // API 키 없을 때 fallback
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-56 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 text-sm">
        <span className="text-2xl">🗺️</span>
        <span>{t('gather.write.mapUnavailable')}</span>
        <span className="text-xs text-gray-300">{t('gather.write.contactAdmin')}</span>
      </div>
    );
  }

  return (
    <div className={`relative${fullscreen ? ' h-full' : ''}`}>
      {/* 지도 */}
      <div ref={mapRef} className={fullscreen ? 'w-full h-full' : 'w-full h-56 rounded-xl overflow-hidden border border-gray-200'} />

      {/* 중앙 고정 핀 */}
      {ready && (
        <div className="absolute pointer-events-none" style={{ bottom: '50%', left: '50%', transform: 'translateX(-50%)' }}>
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 bg-[#9DB8A0] rounded-full border-2 border-white shadow-lg flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
            <div className="w-0.5 h-3 bg-[#9DB8A0]" />
            <div className="w-2 h-0.5 bg-gray-500 opacity-40 rounded-full" />
          </div>
        </div>
      )}

      {/* 현재 위치로 이동 버튼 */}
      {ready && (
        <button
          type="button"
          onClick={handleCurrentLocation}
          className="absolute top-2 right-2 bg-white rounded-full w-9 h-9 shadow-md flex items-center justify-center text-base hover:bg-gray-50 active:bg-gray-100 z-10"
        >
          📍
        </button>
      )}

      {/* 이 위치로 선택 버튼 */}
      {ready && (
        <div className="absolute bottom-2 left-2 right-2 z-10">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || !currentAddress}
            className={`w-full text-sm font-semibold py-2 rounded-lg shadow transition ${
              selected
                ? 'bg-[#6b8f6e] text-white'
                : 'bg-[#9DB8A0] text-white hover:opacity-90 disabled:opacity-50'
            }`}
          >
            {confirming ? '...' : selected ? t('gather.write.locationSelected') : t('gather.write.confirmLocation')}
          </button>
        </div>
      )}

      {/* 로딩 스피너 */}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl">
          <div className="w-6 h-6 border-2 border-[#9DB8A0] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── 지도로 글 목록 보기 컴포넌트 ────────────────────────
interface GatherPin {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  participant_count: number;
  max_participants: number;
}

interface GatherMapViewProps {
  pins: GatherPin[];
  onPinClick: (id: string) => void;
}

export function GatherMapView({ pins, onPinClick }: GatherMapViewProps) {
  const { currentLang } = useI18nLang();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    mapInstance.current = null;
    setReady(false);
    loadGoogleMaps(currentLang)
      .then(() => setReady(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
        center: { lat: 37.5665, lng: 126.978 },
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    // 기존 마커 제거
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const CATEGORY_EMOJI: Record<string, string> = {
      language: '🗣️', drink: '🍺', sports: '💪', food: '☕',
      talk: '💬', game: '🎮', pet: '🐾', travel: '✈️',
      sing: '🎤', movie: '🎬', etc: '📌',
    };

    const makeIcon = (emoji: string) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52">
        <path d="M20 0C8.954 0 0 8.954 0 20c0 15 20 32 20 32S40 35 40 20C40 8.954 31.046 0 20 0z" fill="#9DB8A0" stroke="white" stroke-width="2"/>
        <text x="20" y="24" text-anchor="middle" dominant-baseline="middle" font-size="17" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif">${emoji}</text>
      </svg>`;
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new (window as any).google.maps.Size(40, 52),
        anchor: new (window as any).google.maps.Point(20, 52),
      };
    };

    pins.forEach((pin) => {
      if (!pin.lat || !pin.lng) return;
      const emoji = CATEGORY_EMOJI[pin.category] || '📌';
      const marker = new (window as any).google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapInstance.current!,
        title: pin.title,
        icon: makeIcon(emoji),
      });

      const infoWindow = new (window as any).google.maps.InfoWindow({
        content: `<div style="font-size:13px;max-width:180px">
          <strong>${pin.title}</strong><br/>
          <span style="color:#666">${pin.participant_count}/${pin.max_participants}명</span>
        </div>`,
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstance.current!, marker);
        onPinClick(pin.id);
      });

      markersRef.current.push(marker);
    });

    // 핀들 기반으로 지도 범위 조절
    if (pins.length > 0) {
      const bounds = new (window as any).google.maps.LatLngBounds();
      pins.forEach((p) => {
        if (p.lat && p.lng) bounds.extend({ lat: p.lat, lng: p.lng });
      });
      if (!bounds.isEmpty()) {
        mapInstance.current.fitBounds(bounds, 60);
      }
    }
  }, [ready, pins, onPinClick]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-[60vh] bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
        Google Maps API key not configured
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[60vh] rounded-xl overflow-hidden border border-gray-200" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl">
          <div className="w-6 h-6 border-2 border-[#9DB8A0] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
