'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

let mapsLoaded = false;
let mapsLoadPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (mapsLoaded) return Promise.resolve();
  if (mapsLoadPromise) return mapsLoadPromise;

  mapsLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('SSR');
    if ((window as any).google?.maps) {
      mapsLoaded = true;
      return resolve();
    }
    if (!GOOGLE_MAPS_API_KEY) return reject('No API key');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => { mapsLoaded = true; resolve(); };
    script.onerror = () => reject('Failed to load Google Maps');
    document.head.appendChild(script);
  });

  return mapsLoadPromise;
}

// ─── 지도에서 위치 선택 컴포넌트 (중앙 고정 핀 방식) ──────────────────────────
interface GatherMapPickerProps {
  onSelect: (lat: number, lng: number, label: string) => void;
  hint?: string;
}

export function GatherMapPicker({ onSelect, hint }: GatherMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>('');
  const [selected, setSelected] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch(() => {});
  }, []);

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

    // 지도 이동이 멈추면 중심 좌표의 주소 역지오코딩
    map.addListener('idle', () => {
      const c = map.getCenter();
      if (!c) return;
      const lat = c.lat();
      const lng = c.lng();
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          setCurrentAddress(results[0].formatted_address);
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
        <span>지도 기능을 사용할 수 없습니다</span>
        <span className="text-xs text-gray-300">관리자에게 문의하세요</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 지도 */}
      <div ref={mapRef} className="w-full h-56 rounded-xl overflow-hidden border border-gray-200" />

      {/* 중앙 고정 핀 (pointer-events-none으로 드래그 방해 안 함) */}
      {ready && (
        <div className="absolute inset-0 flex items-end justify-center pointer-events-none" style={{ paddingBottom: '52px' }}>
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
            {confirming ? '...' : selected ? '✓ 선택됨' : '이 위치로 선택'}
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
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadGoogleMaps()
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
      drink: '🍺', smoke: '🚬', cafe: '☕', food: '🍚', walk: '🚶', etc: '💬',
    };

    pins.forEach((pin) => {
      if (!pin.lat || !pin.lng) return;
      const marker = new (window as any).google.maps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapInstance.current!,
        title: pin.title,
        label: {
          text: CATEGORY_EMOJI[pin.category] || '📍',
          fontSize: '18px',
        },
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
