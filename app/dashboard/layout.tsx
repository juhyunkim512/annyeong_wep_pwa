'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '@/lib/i18n'
import { usePushNotification } from '@/lib/hooks/usePushNotification'
import { supabase } from '@/lib/supabase/client'

const PULL_THRESHOLD = 72 // px

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { t } = useTranslation('common')

  // 푸쉬 알림 구독 (로그인 상태면 자동 요청)
  usePushNotification()

  // ── Pull-to-refresh ──────────────────────────────────────
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)

  // ── Total unread badge ──────────────────────────────────
  const [totalUnread, setTotalUnread] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const uid = session.user.id

      const { data: directRooms } = await supabase
        .from('chat_room')
        .select('id, user_a, user_b, user_a_hidden, user_b_hidden, user_a_hidden_at, user_b_hidden_at')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      const visibleDirect = (directRooms || []).filter((r: any) =>
        (r.user_a === uid && !r.user_a_hidden) ||
        (r.user_b === uid && !r.user_b_hidden)
      )

      const { data: directReadStates } = await supabase
        .from('chat_room_read_state')
        .select('room_id, last_read_at')
        .eq('user_id', uid)
        .eq('room_type', 'direct')
      const directReadMap: Record<string, string> = {}
      for (const rs of directReadStates || []) directReadMap[rs.room_id] = rs.last_read_at

      let count = 0
      await Promise.all(visibleDirect.map(async (r: any) => {
        const lastRead = directReadMap[r.id] ?? null
        const myHiddenAt = (r.user_a === uid ? r.user_a_hidden_at : r.user_b_hidden_at) ?? null
        const baseline = myHiddenAt && lastRead
          ? (new Date(myHiddenAt) > new Date(lastRead) ? myHiddenAt : lastRead)
          : (myHiddenAt || lastRead)
        let query = supabase
          .from('chat_message')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', r.id)
          .neq('sender_id', uid)
        if (baseline) query = query.gt('created_at', baseline)
        const { count: c } = await query
        count += c ?? 0
      }))

      // ── Gather 채팅 unread ──
      const { data: gatherMembers } = await supabase
        .from('gather_chat_member')
        .select('room_id, hidden_at')
        .eq('user_id', uid)
        .eq('hidden', false)
      const visibleGatherRoomIds: string[] = (gatherMembers || []).map((m: any) => m.room_id)
      if (visibleGatherRoomIds.length > 0) {
        const { data: gatherReadStates } = await supabase
          .from('chat_room_read_state')
          .select('room_id, last_read_at')
          .eq('user_id', uid)
          .eq('room_type', 'gather')
          .in('room_id', visibleGatherRoomIds)
        const gatherReadMap: Record<string, string> = {}
        for (const rs of gatherReadStates || []) gatherReadMap[rs.room_id] = rs.last_read_at
        const memberHiddenAtMap: Record<string, string | null> = {}
        for (const m of gatherMembers || []) memberHiddenAtMap[m.room_id] = m.hidden_at ?? null
        await Promise.all(visibleGatherRoomIds.map(async (rId: string) => {
          const lastRead = gatherReadMap[rId] ?? null
          const hiddenAt = memberHiddenAtMap[rId] ?? null
          const baseline = hiddenAt && lastRead
            ? (new Date(hiddenAt) > new Date(lastRead) ? hiddenAt : lastRead)
            : (hiddenAt || lastRead)
          let query = supabase
            .from('gather_chat_message')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', rId)
            .neq('sender_id', uid)
          if (baseline) query = query.gt('created_at', baseline)
          const { count: c } = await query
          count += c ?? 0
        }))
      }

      setTotalUnread(count)
    }
    fetchUnread()
    const handler = () => fetchUnread()
    window.addEventListener('focus', handler)
    window.addEventListener('unreadUpdate', handler)
    return () => {
      window.removeEventListener('focus', handler)
      window.removeEventListener('unreadUpdate', handler)
    }
  }, [pathname])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const main = e.currentTarget as HTMLElement
    if (main.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
      isPulling.current = true
    }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return
    const delta = e.touches[0].clientY - touchStartY.current
    if (delta > 0) {
      // rubber-band: 저항감
      setPullY(Math.min(delta * 0.45, PULL_THRESHOLD + 20))
    }
  }, [])

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return
    isPulling.current = false
    if (pullY >= PULL_THRESHOLD) {
      setRefreshing(true)
      setPullY(0)
      window.location.reload()
    } else {
      setPullY(0)
    }
  }, [pullY])

  const isChatRoom = /^\/dashboard\/(chat|gather\/chat)\/[^/]+/.test(pathname)

  const menuItems = [
    { icon: '🏠', label: t('nav.main'), href: '/dashboard/home' },
    { icon: '💬', label: t('nav.community'), href: '/dashboard/community' },
    { icon: '🙌', label: t('nav.gather'), href: '/dashboard/gather' },
    { icon: '✉️', label: t('nav.chat'), href: '/dashboard/chat' },
    { icon: '🛠', label: t('nav.services'), href: '/dashboard/services' },
    { icon: '❓', label: t('nav.help'), href: '/dashboard/help' },
    { icon: '👤', label: t('nav.myPage'), href: '/dashboard/my-page' },
  ]

  const bottomTabItems = [
    { icon: '/icons/tab-home.png', label: t('nav.main'), href: '/dashboard/home' },
    { icon: '/icons/tab-community.png', label: t('nav.community'), href: '/dashboard/community' },
    { icon: '/icons/tab-gather.png', label: t('nav.gather'), href: '/dashboard/gather' },
    { icon: '/icons/tab-chat.png', label: t('nav.chat'), href: '/dashboard/chat' },
    { icon: '/icons/tab-mypage.png', label: t('nav.myPage'), href: '/dashboard/my-page' },
  ]
                                            


  return (
    <div className="min-h-screen bg-[#F7FAF8] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <Link
            href="/dashboard/home"
            className="flex items-center gap-2 text-xl font-bold text-[#9DB8A0]"
          >
            <Image
              src="/logo.png"
              alt="ANNYEONG logo"
              width={28}
              height={28}
              className="object-contain"
              priority
            />
            ANNYEONG
          </Link>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-6 space-y-2">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-[#9DB8A0] text-white font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>


      </aside>

      {/* Mobile Header */}
      <div className={`md:hidden w-full fixed top-0 z-40 bg-white border-b border-gray-200 ${isChatRoom ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between p-4">
          <Link
            href="/dashboard/home"
            className="flex items-center gap-2 text-lg font-bold text-[#9DB8A0]"
          >
            <Image
              src="/logo.png"
              alt="ANNYEONG logo"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
            ANNYEONG
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <main
        className={`md:mt-0 md:pb-0 ${isChatRoom ? 'flex-1 flex flex-col mt-0 p-0 overflow-hidden' : 'flex-1 mt-16 pb-32 overflow-auto'}`}
        onTouchStart={!isChatRoom ? onTouchStart : undefined}
        onTouchMove={!isChatRoom ? onTouchMove : undefined}
        onTouchEnd={!isChatRoom ? onTouchEnd : undefined}
      >
        {/* Pull-to-refresh 인디케이터 (모바일 전용) */}
        {!isChatRoom && (
        <div
          className="md:hidden flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: refreshing ? 48 : pullY > 0 ? pullY : 0 }}
        >
          <div
            className={`w-7 h-7 rounded-full border-2 border-[#9DB8A0] border-t-transparent ${refreshing ? 'animate-spin' : ''}`}
            style={{
              opacity: Math.min(pullY / PULL_THRESHOLD, 1),
              transform: `rotate(${pullY * 3}deg)`,
            }}
          />
        </div>
        )}
        <div className={isChatRoom ? 'flex-1 flex flex-col min-h-0' : 'px-6 pt-0 pb-6 md:px-8 md:pt-2 md:pb-8'}>{children}</div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      {!isChatRoom && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex">
        {bottomTabItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center pt-1 pb-8 gap-1 transition ${
                isActive ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div className="relative">
                <Image src={item.icon} alt={item.label} width={48} height={50} className="w-9 h-auto" />
                {item.href === '/dashboard/chat' && totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
              <span className={`text-[13px] font-medium leading-none ${isActive ? 'text-[#9DB8A0]' : 'text-gray-400'}`}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      )}
    </div>
  )
}