'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from '@/components/common/AvatarImage';
import GatherDetailModal from '@/components/gather/GatherDetailModal';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { normalizeLang } from '@/lib/utils/normalizeLang';
import { batchTranslate, type BatchTranslateItem } from '@/lib/utils/batchTranslate';

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  language: string | null;
  created_at: string;
  nickname: string | null;
  image_url: string | null;
  flag: string | null;
}

interface ChatRoom {
  id: string;
  gather_post_id: string;
  title: string;
  expires_at: string;
  created_at: string;
}

const FLAG_EMOJI_MAP: Record<string, string> = {
  korea: '🇰🇷', usa: '🇺🇸', japan: '🇯🇵', china: '🇨🇳',
  vietnam: '🇻🇳', spain: '🇪🇸', france: '🇫🇷', germany: '🇩🇪',
  thailand: '🇹🇭', philippines: '🇵🇭',
};

export default function GatherChatPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [myId, setMyId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [myLanguage, setMyLanguage] = useState<string>('ko');
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [translatedMessages, setTranslatedMessages] = useState<Record<string, string>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [isGatherDetailOpen, setIsGatherDetailOpen] = useState(false);
  const [memberReadMap, setMemberReadMap] = useState<Record<string, string>>({});
  const [totalMembers, setTotalMembers] = useState(0);

  const [myProfile, setMyProfile] = useState<{ nickname: string | null; image_url: string | null; flag: string | null } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const profileCacheRef = useRef<Record<string, { nickname: string | null; image_url: string | null; flag: string | null }>>({});
  const pendingMsgIdRef = useRef<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string>('');
  const myLanguageRef = useRef<string>('ko');

  // ── 번역 ──
  const translateMessages = useCallback(async (
    msgs: ChatMessage[],
    userLang: string,
    token: string,
    signal?: AbortSignal,
  ) => {
    const toTranslate = msgs.filter((m) => {
      if (!m.language) return false;
      return normalizeLang(m.language) !== userLang;
    }).slice(0, 30);

    if (toTranslate.length === 0) return;

    const items: BatchTranslateItem[] = toTranslate.map((m) => ({
      key: m.id,
      contentType: 'chat_message' as const,
      contentId: m.id,
      fieldName: 'content' as const,
      sourceText: m.content,
      sourceLanguage: m.language ?? 'en',
    }));

    try {
      const results = await batchTranslate(items, userLang, token, signal);
      if (signal?.aborted) return;
      setTranslatedMessages((prev) => {
        const next = { ...prev };
        for (const [key, r] of Object.entries(results)) {
          if (r.isTranslated) next[key] = r.text;
        }
        return next;
      });
    } catch { /* 번역 실패 시 원문 유지 */ }
  }, []);

  // ── 초기 로딩 ──
  const fetchData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/dashboard/gather');
      return;
    }

    setMyId(session.user.id);
    setAccessToken(session.access_token);
    myIdRef.current = session.user.id;
    accessTokenRef.current = session.access_token;

    // 유저 언어 + 프로필 조회
    const { data: profile } = await supabase
      .from('profile')
      .select('uselanguage, nickname, image_url, flag')
      .eq('id', session.user.id)
      .maybeSingle();
    const userLang = normalizeLang(profile?.uselanguage);
    setMyLanguage(userLang);
    myLanguageRef.current = userLang;
    const myProf = { nickname: profile?.nickname ?? null, image_url: profile?.image_url ?? null, flag: profile?.flag ?? null };
    setMyProfile(myProf);
    profileCacheRef.current[session.user.id] = myProf;

    try {
      const res = await fetch(`/api/gather/chat/${roomId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        router.push('/dashboard/gather');
        return;
      }

      const data = await res.json();
      setRoom(data.room);
      const initialMsgs: ChatMessage[] = data.messages || [];
      setMessages(initialMsgs);
      // 초기 메시지에서 프로필 캐시 구성
      for (const m of initialMsgs) {
        if (m.sender_id && !profileCacheRef.current[m.sender_id]) {
          profileCacheRef.current[m.sender_id] = { nickname: m.nickname, image_url: m.image_url, flag: m.flag };
        }
      }

      // 멤버 수 + 읽음 상태 조회
      const [{ count: memCount }, { data: memberReadStates }] = await Promise.all([
        supabase.from('gather_chat_member').select('id', { count: 'exact', head: true }).eq('room_id', roomId),
        supabase.from('chat_room_read_state').select('user_id, last_read_at').eq('room_id', roomId).eq('room_type', 'gather'),
      ]);
      setTotalMembers(memCount ?? 0);
      const readMap: Record<string, string> = {};
      for (const rs of memberReadStates || []) readMap[rs.user_id] = rs.last_read_at;
      setMemberReadMap(readMap);

      if (data.room && new Date(data.room.expires_at).getTime() < Date.now()) {
        setIsExpired(true);
      }

      // 초기 번역
      void translateMessages(initialMsgs, userLang, session.access_token);

      // 읽음 상태 갱신 후 layout에 즉시 반영
      supabase.from('chat_room_read_state').upsert(
        { room_id: roomId, room_type: 'gather', user_id: session.user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'room_id,room_type,user_id' }
      ).then(() => {
        window.dispatchEvent(new CustomEvent('unreadUpdate'));
      });
    } catch {
      router.push('/dashboard/gather');
    } finally {
      setLoading(false);
    }
  }, [roomId, router, translateMessages]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── 자동 스크롤 ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Realtime 구독 ──
  useEffect(() => {
    if (!myId || !accessToken) return;
    const channel = supabase
      .channel(`gather_chat_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'gather_chat_message', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const incoming = payload.new as {
            id: string; sender_id: string; content: string; language: string | null; created_at: string;
          };

          if (incoming.sender_id === myIdRef.current) {
            // optimistic 메시지를 실제 메시지로 교체
            setMessages((prev) => {
              const tempId = pendingMsgIdRef.current;
              const tempIdx = tempId ? prev.findIndex((m) => m.id === tempId) : -1;
              const uid = myIdRef.current!;
              const prof = profileCacheRef.current[uid];
              const realMsg: ChatMessage = { ...incoming, nickname: prof?.nickname ?? null, image_url: prof?.image_url ?? null, flag: prof?.flag ?? null };
              if (tempIdx !== -1) {
                pendingMsgIdRef.current = null;
                const next = [...prev];
                next[tempIdx] = realMsg;
                return next;
              }
              if (prev.some((m) => m.id === incoming.id)) return prev;
              return [...prev, realMsg];
            });
            return;
          }

          // 다른 유저 메시지
          let prof = profileCacheRef.current[incoming.sender_id];
          if (!prof) {
            const { data } = await supabase
              .from('profile')
              .select('nickname, image_url, flag')
              .eq('id', incoming.sender_id)
              .maybeSingle();
            prof = { nickname: data?.nickname ?? null, image_url: data?.image_url ?? null, flag: data?.flag ?? null };
            profileCacheRef.current[incoming.sender_id] = prof;
          }

          const newMsg: ChatMessage = { ...incoming, ...prof };
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, newMsg];
          });

          void translateMessages([newMsg], myLanguageRef.current, accessTokenRef.current);

          // 읽음 상태 갱신
          const uid = myIdRef.current;
          if (uid) {
            supabase.from('chat_room_read_state').upsert(
              { room_id: roomId, room_type: 'gather', user_id: uid, last_read_at: incoming.created_at },
              { onConflict: 'room_id,room_type,user_id' }
            ).then(() => window.dispatchEvent(new CustomEvent('unreadUpdate')));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_room_read_state', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string; room_type: string };
          if (row.room_type !== 'gather') return;
          setMemberReadMap((prev) => ({ ...prev, [row.user_id]: row.last_read_at }));
        }
      )
      .subscribe((status, err) => {
        console.log('[GatherChat] Realtime status:', status, err ?? '');
      });
    return () => { supabase.removeChannel(channel); };
  }, [roomId, myId, translateMessages]);

  // ── 만료 체크 ──
  useEffect(() => {
    if (!room) return;
    const checkExpiry = setInterval(() => {
      if (new Date(room.expires_at).getTime() < Date.now()) {
        setIsExpired(true);
      }
    }, 30000);
    return () => clearInterval(checkExpiry);
  }, [room]);

  // ── 메시지 전송 (optimistic) ──
  const handleSend = async () => {
    if (!input.trim() || sending || isExpired || !accessToken || !myId) return;

    const content = input.trim();
    const tempId = `temp-${myId}-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender_id: myId,
      content,
      language: myLanguage,
      created_at: new Date().toISOString(),
      nickname: myProfile?.nickname ?? null,
      image_url: myProfile?.image_url ?? null,
      flag: myProfile?.flag ?? null,
    };

    pendingMsgIdRef.current = tempId;
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/gather/chat/${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ content, language: myLanguage }),
      });
      if (!res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        pendingMsgIdRef.current = null;
      }
      // 성공 시 Realtime이 optimistic 교체
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pendingMsgIdRef.current = null;
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatExpiryTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-gray-400">...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <button
          onClick={() => router.push('/dashboard/chat')}
          className="text-gray-500 hover:text-gray-700 text-lg"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={() => room?.gather_post_id && setIsGatherDetailOpen(true)}
            className="text-sm font-bold truncate text-left hover:underline block w-full"
          >
            {room?.title || t('gather.groupChat.title')}
          </button>
          {room && !isExpired && (
            <p className="text-xs text-gray-400">
              {t('gather.groupChat.expiresAt', { time: formatExpiryTime(room.expires_at) })}
            </p>
          )}
        </div>
      </div>

      {/* Expired banner */}
      {isExpired && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center">
          <p className="text-xs text-yellow-700">{t('gather.groupChat.expired')}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
        {messages.map((msg) => {
          const isMe = msg.sender_id === myId;
          const displayContent = translatedMessages[msg.id] ?? msg.content;
          const isTranslated = !!(translatedMessages[msg.id]);
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && (
                <div className="shrink-0">
                  <AvatarImage src={msg.image_url} size={32} />
                </div>
              )}

              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && (
                  <span className="text-xs text-gray-500 mb-0.5">
                    {msg.flag && FLAG_EMOJI_MAP[msg.flag] ? FLAG_EMOJI_MAP[msg.flag] + ' ' : ''}
                    {msg.nickname || 'Unknown'}
                  </span>
                )}

                <div
                  className={`px-3 py-2 rounded-2xl text-sm break-words ${
                    isMe
                      ? 'bg-[#9DB8A0] text-white rounded-tr-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                  }`}
                >
                  {displayContent}
                </div>

                <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {isMe && (() => {
                    const readCount = Object.entries(memberReadMap)
                      .filter(([uid, readAt]) => uid !== myId && readAt >= msg.created_at)
                      .length;
                    const unread = Math.max(0, totalMembers - 1 - readCount);
                    return unread > 0 ? (
                      <span className="text-[10px] text-[#9DB8A0] font-medium">{unread}</span>
                    ) : null;
                  })()}
                  <span className="text-[10px] text-gray-400">{formatTime(msg.created_at)}</span>
                  {isTranslated && !isMe && (
                    <span className="text-[10px] text-gray-400">🌐</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-10 flex-shrink-0">
        {isExpired ? (
          <p className="text-center text-sm text-gray-400 py-2">{t('gather.groupChat.expired')}</p>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="..."
              className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] text-sm"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="bg-[#9DB8A0] text-white px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition shrink-0"
            >
              ↑
            </button>
          </div>
        )}
      </div>
      {room?.gather_post_id && (
        <GatherDetailModal
          postId={room.gather_post_id}
          isOpen={isGatherDetailOpen}
          onClose={() => setIsGatherDetailOpen(false)}
          onRequireLogin={() => {}}
          onChanged={() => {}}
        />
      )}
    </div>
  );
}

