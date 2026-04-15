'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from '@/components/common/AvatarImage';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

interface ChatRoom {
  id: string;
  other_user_id: string;
  other_nickname: string;
  other_flag: string | null;
  other_image_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
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

  useEffect(() => {
    const fetchRooms = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setMyId(uid);

      const { data, error } = await supabase
        .from('chat_room')
        .select('id, user_a, user_b, last_message, last_message_at, user_a_hidden, user_b_hidden')
        .or(`user_a.eq.${uid},user_b.eq.${uid}`)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error || !data) { setLoading(false); return; }

      // 숨긴 방 필터 + 상대 프로필 조회
      const visible = data.filter((r) =>
        (r.user_a === uid && !r.user_a_hidden) ||
        (r.user_b === uid && !r.user_b_hidden)
      );

      const others = visible.map((r) => (r.user_a === uid ? r.user_b : r.user_a));
      if (others.length === 0) { setLoading(false); return; }

      const { data: profiles } = await supabase
        .from('profile')
        .select('id, nickname, flag, image_url')
        .in('id', others);

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      setRooms(visible.map((r) => {
        const otherId = r.user_a === uid ? r.user_b : r.user_a;
        const p = profileMap[otherId];
        return {
          id: r.id,
          other_user_id: otherId,
          other_nickname: p?.nickname ?? t('common.unknown'),
          other_flag: p?.flag ?? null,
          other_image_url: p?.image_url ?? null,
          last_message: r.last_message,
          last_message_at: r.last_message_at,
        };
      }));
      setLoading(false);
    };
    fetchRooms();
  }, [t]);

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
        <div className="text-center py-12 text-gray-400">{t('auth.loginRequired')}</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">✉️</div>
          <p className="text-gray-600 font-medium mb-1">{t('chat.empty')}</p>
          <p className="text-sm text-gray-400">{t('chat.emptyDesc')}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => router.push(`/dashboard/chat/${room.id}`)}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-100 transition text-left"
            >
              <AvatarImage src={room.other_image_url} size={48} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-800 truncate">{room.other_nickname}</span>
                  {room.other_flag && (
                    <span className="text-base">{FLAG_EMOJI_MAP[room.other_flag] ?? ''}</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate mt-0.5">
                  {room.last_message ?? t('chat.noMessages')}
                </p>
              </div>
              {room.last_message_at && (
                <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(room.last_message_at)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
