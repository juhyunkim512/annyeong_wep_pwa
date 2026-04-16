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

// ─── 지도에서 위치 선택 컴포넌트 ──────────────────────────
interface GatherMapPickerProps {
  onSelect: (lat: number, lng: number, label: string) => void;
  hint?: string;
}

export function GatherMapPicker({ onSelect, hint }: GatherMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    // 서울 중심
    const center = { lat: 37.5665, lng: 126.978 };
    const map = new (window as any).google.maps.Map(mapRef.current, {
      center,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });
    mapInstance.current = map;

    map.addListener('click', (e: any) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      if (markerInstance.current) {
        markerInstance.current.setPosition(e.latLng);
      } else {
        markerInstance.current = new (window as any).google.maps.Marker({
          position: e.latLng,
          map,
        });
      }

      // Geocode로 주소 가져오기
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: e.latLng }, (results: any, status: any) => {
        let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (status === 'OK' && results && results[0]) {
          label = results[0].formatted_address;
        }
        onSelect(lat, lng, label);
      });
    });
  }, [ready, onSelect]);

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-sm">
        Google Maps API key not configured
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-48 rounded-lg overflow-hidden border border-gray-200" />
      {hint && !markerInstance.current && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="bg-black bg-opacity-50 text-white text-xs px-3 py-1.5 rounded-full">{hint}</span>
        </div>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
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
