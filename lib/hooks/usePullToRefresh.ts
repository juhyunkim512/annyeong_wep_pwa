'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export interface UsePullToRefreshOptions {
  /** 당겨야 새로고침이 트리거되는 최소 px (default: 72) */
  threshold?: number
  /** 성공 후 인디케이터를 유지할 ms (default: 700) */
  holdDuration?: number
  /** 실제 데이터 재조회 함수. Promise를 반환해야 함. */
  onRefresh: () => Promise<void>
  /** 새로고침을 비활성화할 조건 (e.g. 채팅방) */
  disabled?: boolean
}

export type RefreshState = 'idle' | 'pulling' | 'ready' | 'refreshing' | 'success' | 'error'

export interface UsePullToRefreshResult {
  pullY: number
  refreshState: RefreshState
  /** threshold 대비 0~1 진행률 */
  progress: number
  onTouchStart: (e: React.TouchEvent) => void
  onTouchMove: (e: React.TouchEvent) => void
  onTouchEnd: () => void
}

export function usePullToRefresh({
  threshold = 72,
  holdDuration = 700,
  onRefresh,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullY, setPullY] = useState(0)
  const [refreshState, setRefreshState] = useState<RefreshState>('idle')

  const touchStartY = useRef(0)
  const isPulling = useRef(false)
  // 중복 새로고침 방지용
  const isRefreshing = useRef(false)
  // 언마운트 후 setState 방지
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const safeSet = useCallback(<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    if (mountedRef.current) setter(value)
  }, [])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || isRefreshing.current) return
      const el = e.currentTarget as HTMLElement
      if (el.scrollTop === 0) {
        touchStartY.current = e.touches[0].clientY
        isPulling.current = true
      }
    },
    [disabled],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling.current || disabled || isRefreshing.current) return
      const delta = e.touches[0].clientY - touchStartY.current
      if (delta > 0) {
        // rubber-band 저항감 (기존 0.45 유지)
        const clamped = Math.min(delta * 0.45, threshold + 20)
        safeSet(setPullY, clamped)
        safeSet(
          setRefreshState,
          (clamped >= threshold ? 'ready' : 'pulling') as RefreshState,
        )
      }
    },
    [disabled, threshold, safeSet],
  )

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullY < threshold || isRefreshing.current) {
      // 임계값 미달 또는 이미 새로고침 중 → 원위치
      safeSet(setPullY, 0)
      safeSet(setRefreshState, 'idle')
      return
    }

    // ── 새로고침 시작 ──────────────────────────────────────────
    isRefreshing.current = true
    safeSet(setPullY, 0)
    safeSet(setRefreshState, 'refreshing')

    ;(async () => {
      try {
        await onRefresh()

        if (!mountedRef.current) return

        // 성공: 0.7초 유지
        safeSet(setRefreshState, 'success')
        await new Promise<void>((resolve) => setTimeout(resolve, holdDuration))

        if (!mountedRef.current) return
      } catch {
        if (!mountedRef.current) return
        // 실패해도 UI가 영원히 로딩에 빠지지 않게 처리
        safeSet(setRefreshState, 'error')
        await new Promise<void>((resolve) => setTimeout(resolve, holdDuration))
        if (!mountedRef.current) return
      } finally {
        // endRefreshing()에 해당
        if (mountedRef.current) {
          safeSet(setRefreshState, 'idle')
        }
        isRefreshing.current = false
      }
    })()
  }, [pullY, threshold, holdDuration, onRefresh, safeSet])

  const progress = Math.min(pullY / threshold, 1)

  return { pullY, refreshState, progress, onTouchStart, onTouchMove, onTouchEnd }
}
