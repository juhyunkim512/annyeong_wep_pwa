'use client'

import { RefreshState } from '@/lib/hooks/usePullToRefresh'

interface RefreshIndicatorProps {
  refreshState: RefreshState
  pullY: number
  progress: number
  /** 새로고침 트리거 임계값 px (default: 72) */
  threshold?: number
}

/**
 * 브랜드 sage green (#9DB8A0) 기반 pull-to-refresh 인디케이터.
 * - idle: 숨김
 * - pulling: 반투명 원형 아크 (progress 비례)
 * - ready: 꽉 찬 아크 + 살짝 펄스
 * - refreshing: 스피너 회전
 * - success: 체크 아이콘 + 페이드아웃 준비
 * - error: X 아이콘
 */
export default function RefreshIndicator({
  refreshState,
  pullY,
  progress,
  threshold = 72,
}: RefreshIndicatorProps) {
  const isVisible = refreshState !== 'idle' || pullY > 0

  // 컨테이너 높이: refreshing/success/error는 고정 48px, pulling은 pullY 기반
  const containerHeight =
    refreshState === 'refreshing' || refreshState === 'success' || refreshState === 'error'
      ? 48
      : pullY > 0
      ? pullY
      : 0

  if (!isVisible) return null

  // SVG 아크 계산 (원형 progress ring)
  const size = 28
  const r = 11
  const circumference = 2 * Math.PI * r
  const arcProgress =
    refreshState === 'refreshing' || refreshState === 'success' || refreshState === 'error'
      ? 1
      : progress

  return (
    <div
      className="md:hidden flex items-center justify-center overflow-hidden"
      style={{
        height: containerHeight,
        transition:
          refreshState === 'refreshing' || refreshState === 'idle'
            ? 'height 0.2s ease'
            : undefined,
      }}
    >
      <div
        style={{
          opacity:
            refreshState === 'pulling'
              ? 0.4 + progress * 0.6
              : refreshState === 'idle'
              ? Math.min(pullY / (threshold * 0.3), 1)
              : 1,
          transition: 'opacity 0.15s ease',
        }}
      >
        {/* refreshing: 스피너 */}
        {refreshState === 'refreshing' && (
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="animate-spin"
            style={{ animationDuration: '0.8s' }}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#D6E8DC"
              strokeWidth="2.5"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#9DB8A0"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * 0.25}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </svg>
        )}

        {/* success: 체크 아이콘 */}
        {refreshState === 'success' && (
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r + 2}
              fill="#9DB8A0"
              opacity="0.15"
            />
            <polyline
              points="8,14 12,18 20,10"
              fill="none"
              stroke="#9DB8A0"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* error: X 아이콘 */}
        {refreshState === 'error' && (
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r + 2}
              fill="#E57373"
              opacity="0.15"
            />
            <line
              x1="9" y1="9" x2="19" y2="19"
              stroke="#E57373"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <line
              x1="19" y1="9" x2="9" y2="19"
              stroke="#E57373"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* pulling / ready: progress arc */}
        {(refreshState === 'pulling' || refreshState === 'ready') && (
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            style={{
              transform: `rotate(${progress * 180}deg)`,
              transition: 'transform 0.1s linear',
            }}
          >
            {/* 배경 트랙 */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="#D6E8DC"
              strokeWidth="2.5"
            />
            {/* 진행 아크 */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={refreshState === 'ready' ? '#9DB8A0' : '#B8D1BC'}
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - arcProgress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.15s ease' }}
            />
            {/* ready 상태: 중앙 화살표 */}
            {refreshState === 'ready' && (
              <polyline
                points={`${size / 2 - 4},${size / 2 - 2} ${size / 2},${size / 2 + 3} ${size / 2 + 4},${size / 2 - 2}`}
                fill="none"
                stroke="#9DB8A0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        )}
      </div>
    </div>
  )
}
