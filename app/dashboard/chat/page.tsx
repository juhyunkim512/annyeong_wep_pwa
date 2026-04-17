'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from '@/components/common/AvatarImage';
import LoginModal from '@/components/common/LoginModal';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

interface ChatRoom {
  id: string;
  roomType: 'direct' | 'gather';
  // direct
  other_user_id?: string;
  other_nickname?: string;
  other_flag?: string | null;
  other_image_url?: string | null;
  // gather
  gather_title?: string;
  // common
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

const FLAG_EMOJI_MAP: Record<string, string> = {
  korea: '🇰🇷', usa: '🇺🇸', japan: '🇯🇵', china: '🇨🇳',
  vietnam: '🇻🇳', spain: '🇪🇸', france: '🇫🇷', germany: '🇩🇪',
  thailand: '🇹🇭', philippines: '🇵🇭',
};

export default function ChatListPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const touchStartX = useRef<number>(0);

  const hideRoom = async (roomId: string, roomType: 'direct' | 'gather') => {
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    setRevealedId(null);
    const { data: { session } } = await supabase.auth.getSession();
    await fetch('/api/chat/hide', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? ''}`,
      },
      body: JSON.stringify({ roomId, roomType }),
    });
  };

  useEffect(() => {
    const fetchRooms = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setMyId(uid);
      setAccessToken(session.access_token);

      // ── 1:1 채팅방 ──
      const { data: directData } = await supabase
        .from('chat_room')
        .select('id, user_a, user_b, last_message, last_message_at, user_a_hidden, user_b_hidden')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      const visible = (directData || []).filter((r) =>
        (r.user_a === uid && !r.user_a_hidden) ||
        (r.user_b === uid && !r.user_b_hidden)
      );

      const others = visible.map((r) => (r.user_a === uid ? r.user_b : r.user_a));
      const profileMap: Record<string, { nickname: string; flag: string | null; image_url: string | null }> = {};
      if (others.length > 0) {
        const { data: profiles } = await supabase
          .from('profile')
          .select('id, nickname, flag, image_url')
          .in('id', others);
        for (const p of profiles || []) profileMap[p.id] = p;
      }

      // ── unread count 계산 ──
      const allRoomIds = visible.map((r) => r.id);
      const readStateMap: Record<string, string | null> = {};
      if (allRoomIds.length > 0) {
        const { data: readStates } = await supabase
          .from('chat_room_read_state')
          .select('room_id, last_read_at')
          .eq('user_id', uid)
          .eq('room_type', 'direct')
          .in('room_id', allRoomIds);
        for (const rs of readStates || []) readStateMap[rs.room_id] = rs.last_read_at;
      }

      const unreadCountMap: Record<string, number> = {};
      await Promise.all(
        visible.map(async (r) => {
          const otherId = r.user_a === uid ? r.user_b : r.user_a;
          const lastRead = readStateMap[r.id] ?? null;
          let query = supabase
            .from('chat_message')
            .select('id', { count: 'exact', head: true })
            .eq('room_id', r.id)
            .neq('sender_id', uid);
          if (lastRead) query = query.gt('created_at', lastRead);
          const { count } = await query;
          unreadCountMap[r.id] = count ?? 0;
          return otherId;
        })
      );

      const directRooms: ChatRoom[] = visible.map((r) => {
        const otherId = r.user_a === uid ? r.user_b : r.user_a;
        const p = profileMap[otherId];
        return {
          id: r.id,
          roomType: 'direct',
          other_user_id: otherId,
          other_nickname: p?.nickname ?? t('common.unknown'),
          other_flag: p?.flag ?? null,
          other_image_url: p?.image_url ?? null,
          last_message: r.last_message,
          last_message_at: r.last_message_at,
          unread_count: unreadCountMap[r.id] ?? 0,
        };
      });

      // ── 모임 단톡방 ──
      const { data: memberRows } = await supabase
        .from('gather_chat_member')
        .select('room_id')
        .eq('user_id', uid)
        .eq('hidden', false);

      const gatherRoomIds = (memberRows || []).map((m: any) => m.room_id).filter(Boolean);
      let gatherRooms: ChatRoom[] = [];

      if (gatherRoomIds.length > 0) {
        const { data: gatherData } = await supabase
          .from('gather_chat_room')
          .select('id, title, last_message, last_message_at')
          .in('id', gatherRoomIds);

        // gather unread 계산
        const { data: gatherReadStates } = await supabase
          .from('chat_room_read_state')
          .select('room_id, last_read_at')
          .eq('user_id', uid)
          .eq('room_type', 'gather')
          .in('room_id', gatherRoomIds);
        const gatherReadMap: Record<string, string | null> = {};
        for (const rs of gatherReadStates || []) gatherReadMap[rs.room_id] = rs.last_read_at;

        const gatherUnreadMap: Record<string, number> = {};
        await Promise.all(
          (gatherData || []).map(async (r: any) => {
            const lastRead = gatherReadMap[r.id] ?? null;
            let query = supabase
              .from('gather_chat_message')
              .select('id', { count: 'exact', head: true })
              .eq('room_id', r.id)
              .neq('sender_id', uid);
            if (lastRead) query = query.gt('created_at', lastRead);
            const { count } = await query;
            gatherUnreadMap[r.id] = count ?? 0;
          })
        );

        gatherRooms = (gatherData || []).map((r: any) => ({
          id: r.id,
          roomType: 'gather' as const,
          gather_title: r.title ?? t('gather.title'),
          last_message: r.last_message ?? null,
          last_message_at: r.last_message_at ?? null,
          unread_count: gatherUnreadMap[r.id] ?? 0,
        }));
      }

      // ── 합치고 최신순 정렬 ──
      const all = [...directRooms, ...gatherRooms].sort((a, b) =>
        (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '')
      );
      setRooms(all);
      setLoading(false);
    };
    fetchRooms();
  }, [t]);

  // ─── Realtime: chat_room 변경 시 목록 갱신 ───
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel('chat_list_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_room' },
        (payload) => {
          const updated = payload.new as {
            id: string; user_a: string; user_b: string;
            last_message: string | null; last_message_at: string | null;
            user_a_hidden: boolean; user_b_hidden: boolean;
          };
          if (updated.user_a !== myId && updated.user_b !== myId) return;
          const isHidden =
            (updated.user_a === myId && updated.user_a_hidden) ||
            (updated.user_b === myId && updated.user_b_hidden);
          setRooms((prev) => {
            if (isHidden) return prev.filter((r) => r.id !== updated.id);
            const existing = prev.find((r) => r.id === updated.id);
            if (existing) {
              const next = prev.map((r) =>
                r.id === updated.id
                  ? { ...r, last_message: updated.last_message, last_message_at: updated.last_message_at }
                  : r
              );
              return next.sort((a, b) =>
                (b.last_message_at ?? '').localeCompare(a.last_message_at ?? '')
              );
            }
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_room' },
        async (payload) => {
          const newRoom = payload.new as {
            id: string; user_a: string; user_b: string;
            last_message: string | null; last_message_at: string | null;
          };
          if (newRoom.user_a !== myId && newRoom.user_b !== myId) return;
          const otherId = newRoom.user_a === myId ? newRoom.user_b : newRoom.user_a;
          const { data: profile } = await supabase
            .from('profile').select('id, nickname, flag, image_url')
            .eq('id', otherId).maybeSingle();
          setRooms((prev) => {
            if (prev.some((r) => r.id === newRoom.id)) return prev;
            const room: ChatRoom = {
              id: newRoom.id,
              roomType: 'direct',
              other_user_id: otherId,
              other_nickname: profile?.nickname ?? t('common.unknown'),
              other_flag: profile?.flag ?? null,
              other_image_url: profile?.image_url ?? null,
              last_message: newRoom.last_message,
              last_message_at: newRoom.last_message_at,
              unread_count: 0,
            };
            return [room, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message' },
        (payload) => {
          const msg = payload.new as { room_id: string; sender_id: string; content: string; created_at: string };
          if (msg.sender_id === myId) return; // 내가 보낸 메시지는 unread 아님
          setRooms((prev) => {
            const idx = prev.findIndex((r) => r.id === msg.room_id);
            if (idx === -1) return prev;
            const updated = {
              ...prev[idx],
              last_message: msg.content,
              last_message_at: msg.created_at,
              unread_count: prev[idx].unread_count + 1,
            };
            return [updated, ...prev.filter((r) => r.id !== msg.room_id)];
          });
          // 탭 badge 즉시 증가
          window.dispatchEvent(new CustomEvent('unreadUpdate'));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'gather_chat_room' },
        (payload) => {
          const updated = payload.new as { id: string; last_message: string | null; last_message_at: string | null };
          setRooms((prev) => {
            const idx = prev.findIndex((r) => r.id === updated.id && r.roomType === 'gather');
            if (idx === -1) return prev;
            const next = prev.map((r) =>
              r.id === updated.id ? { ...r, last_message: updated.last_message, last_message_at: updated.last_message_at } : r
            );
            return next.sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''));
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, t]);

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return t('common.justNow');
    if (diff < 3600) return t('common.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('common.hoursAgo', { count: Math.floor(diff / 3600) });
    return t('common.daysAgo', { count: Math.floor(diff / 86400) });
  };

  return (
    <div className="max-w-lg mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">{t('chat.title')}</h1>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : !myId ? (
        <div className="mt-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <h2 className="text-lg font-bold mb-4">{t('auth.loginRequiredDesc')}</h2>
            <button
              className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
              onClick={() => setIsLoginOpen(true)}
            >
              {t('auth.login')}
            </button>
          </div>
          <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✉️</div>
          <p className="text-gray-600 font-medium mb-1">{t('chat.empty')}</p>
          <p className="text-sm text-gray-400">{t('chat.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rooms.map((room) => (
            <div key={room.id} className="relative overflow-hidden rounded-xl">
              {/* 삭제 버튼 (뒤에 숨겨짐) */}
              <div className="absolute right-0 top-0 bottom-0 flex items-center">
                <button
                  onClick={() => hideRoom(room.id, room.roomType)}
                  className="h-full px-5 bg-red-500 text-white text-sm font-medium"
                >
                  {t('common.delete')}
                </button>
              </div>
              {/* 채팅방 항목 */}
              <div
                className="relative bg-white transition-transform duration-200"
                style={{ transform: revealedId === room.id ? 'translateX(-72px)' : 'translateX(0)' }}
              >
                <button
                  onClick={() => {
                    if (revealedId === room.id) { setRevealedId(null); return; }
                    room.roomType === 'gather'
                      ? router.push(`/dashboard/gather/chat/${room.id}`)
                      : router.push(`/dashboard/chat/${room.id}`);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setRevealedId(revealedId === room.id ? null : room.id); }}
                  onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    const dx = touchStartX.current - e.changedTouches[0].clientX;
                    if (dx > 50) { setRevealedId(room.id); }
                    else if (dx < -20) { setRevealedId(null); }
                  }}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition text-left"
                >
                  {room.roomType === 'gather' ? (
                    <div className="w-12 h-12 rounded-full bg-[#e8f0e9] flex items-center justify-center text-2xl flex-shrink-0">
                      👥
                    </div>
                  ) : (
                    <AvatarImage src={room.other_image_url ?? null} size={48} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {room.roomType === 'gather' ? (
                        <span className="font-semibold text-gray-800 truncate">{room.gather_title}</span>
                      ) : (
                        <>
                          <span className="font-semibold text-gray-800 truncate">{room.other_nickname}</span>
                          {room.other_flag && (
                            <span className="text-base">{FLAG_EMOJI_MAP[room.other_flag] ?? ''}</span>
                          )}
                        </>
                      )}
                      {room.roomType === 'gather' && (
                        <span className="ml-1 text-xs bg-[#e8f0e9] text-[#6b8f6e] px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {t('gather.title')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {room.last_message ?? (room.roomType === 'gather' ? t('chat.gatherCreated') : t('chat.noMessages'))}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {room.last_message_at && (
                      <span className="text-xs text-gray-400">{timeAgo(room.last_message_at)}</span>
                    )}
                    {room.unread_count > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {room.unread_count > 99 ? '99+' : room.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
