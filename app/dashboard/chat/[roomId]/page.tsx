'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from '@/components/common/AvatarImage';
import ReportModal from '@/components/common/ReportModal';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';
import { normalizeLang } from '@/lib/utils/normalizeLang';
import { batchTranslate } from '@/lib/utils/batchTranslate';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_deleted: boolean;
  language: string | null;
  client_message_id: string | null;
  pending?: boolean;
  failed?: boolean;
}

interface OtherUser {
  id: string;
  nickname: string;
  flag: string | null;
  image_url: string | null;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FLAG_EMOJI_MAP: Record<string, string> = {
  korea: '🇰🇷', usa: '🇺🇸', japan: '🇯🇵', china: '🇨🇳',
  vietnam: '🇻🇳', spain: '🇪🇸', france: '🇫🇷', germany: '🇩🇪',
  thailand: '🇹🇭', philippines: '🇵🇭',
};

// ─────────────────────────────────────────────
// In-memory translation cache
// ─────────────────────────────────────────────
const _translationCache = new Map<string, string>();

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ChatRoomPage() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [myId, setMyId] = useState<string | null>(null);
  const [myLang, setMyLang] = useState<string>('en');
  const [myLangRaw, setMyLangRaw] = useState<string>('english');
  const [accessToken, setAccessToken] = useState<string>('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState('');
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const translatingRef = useRef(false);

  // ─── 번역 함수 ────────────────────────────

  const translateMessages = useCallback(async (
    msgs: Message[],
    userLang: string,
    token: string,
  ) => {
    if (translatingRef.current) return;
    translatingRef.current = true;

    const toTranslate = msgs
      .filter((m) => !m.pending && !m.is_deleted)
      .slice(-20)
      .filter((m) => {
        const msgLang = normalizeLang(m.language);
        return msgLang !== userLang && !_translationCache.has(`${m.id}:${userLang}`);
      });

    if (toTranslate.length === 0) { translatingRef.current = false; return; }

    try {
      const items = toTranslate.map((m) => ({
        key: m.id,
        contentType: 'chat_message' as const,
        contentId: m.id,
        fieldName: 'content' as const,
        sourceText: m.content,
        sourceLanguage: m.language ?? 'english',
      }));
      const results = await batchTranslate(items, userLang, token);

      const newMap: Record<string, string> = {};
      for (const [key, r] of Object.entries(results)) {
        if (r.isTranslated) {
          _translationCache.set(`${key}:${userLang}`, r.text);
          newMap[key] = r.text;
        }
      }
      if (Object.keys(newMap).length > 0) {
        setTranslatedMap((prev) => ({ ...prev, ...newMap }));
      }
    } catch (err) {
      console.error('[Chat] batch translate error:', err);
    }
    translatingRef.current = false;
  }, []);

  // ─── 초기 데이터 로드 ─────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/dashboard/home'); return; }
      const uid = session.user.id;
      setMyId(uid);
      setAccessToken(session.access_token);

      const { data: room } = await supabase
        .from('chat_room')
        .select('user_a, user_b')
        .eq('id', roomId)
        .maybeSingle();
      if (!room) { router.push('/dashboard/chat'); return; }

      const otherId = room.user_a === uid ? room.user_b : room.user_a;

      const [
        { data: myProfile },
        { data: profile },
        { data: blockRow },
        { data: myFollow },
        { data: theirFollow },
      ] = await Promise.all([
        supabase.from('profile').select('uselanguage').eq('id', uid).maybeSingle(),
        supabase.from('profile').select('id, nickname, flag, image_url').eq('id', otherId).maybeSingle(),
        supabase.from('user_block').select('id').eq('blocker_id', uid).eq('blocked_id', otherId).maybeSingle(),
        supabase.from('user_follow').select('id').eq('follower_id', uid).eq('following_id', otherId).maybeSingle(),
        supabase.from('user_follow').select('id').eq('follower_id', otherId).eq('following_id', uid).maybeSingle(),
      ]);

      const rawLang = myProfile?.uselanguage ?? 'english';
      const shortLang = normalizeLang(rawLang);
      setMyLangRaw(rawLang);
      setMyLang(shortLang);
      setOtherUser(profile ?? { id: otherId, nickname: t('common.unknown'), flag: null, image_url: null });
      setIsBlocked(!!blockRow);
      setIsFollowing(!!myFollow);
      setIsMutualFollow(!!myFollow && !!theirFollow);

      const { data: msgs } = await supabase
        .from('chat_message')
        .select('id, sender_id, content, created_at, is_deleted, language, client_message_id')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(50);

      const loaded = msgs ?? [];
      setMessages(loaded);
      setLoading(false);

      translateMessages(loaded, shortLang, session.access_token);
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ─── Realtime 구독 ────────────────────────

  useEffect(() => {
    if (!myId || !accessToken) return;
    const channel = supabase
      .channel(`chat_room_${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            const tempIdx = prev.findIndex(
              (m) => m.client_message_id && m.client_message_id === incoming.client_message_id
            );
            if (tempIdx !== -1) {
              const next = [...prev];
              next[tempIdx] = { ...incoming, pending: false, failed: false };
              return next;
            }
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.sender_id !== myId) {
            translateMessages([incoming], myLang, accessToken);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, myId, myLang, accessToken, translateMessages]);

  // ─── 스크롤 하단 ──────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── 메시지 전송 (Optimistic UI) ─────────

  const handleSend = useCallback(async () => {
    if (!input.trim() || !myId) return;
    const text = input.trim();
    const clientMsgId = `${myId}-${Date.now()}`;
    const tempId = `temp-${clientMsgId}`;

    const tempMsg: Message = {
      id: tempId,
      sender_id: myId,
      content: text,
      created_at: new Date().toISOString(),
      is_deleted: false,
      language: myLangRaw,
      client_message_id: clientMsgId,
      pending: true,
      failed: false,
    };
    setMessages((prev) => [...prev, tempMsg]);
    setInput('');

    const { data, error } = await supabase
      .from('chat_message')
      .insert({
        room_id: roomId,
        sender_id: myId,
        content: text,
        language: myLangRaw,
        client_message_id: clientMsgId,
      })
      .select('id, sender_id, content, created_at, is_deleted, language, client_message_id')
      .maybeSingle();

    if (error || !data) {
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, pending: false, failed: true } : m)
      );
    } else {
      setMessages((prev) => {
        const alreadyReplaced = prev.some((m) => m.id === data.id && !m.pending);
        if (alreadyReplaced) return prev.filter((m) => m.id !== tempId);
        return prev.map((m) =>
          m.id === tempId ? { ...data, pending: false, failed: false } : m
        );
      });
      await supabase
        .from('chat_room')
        .update({ last_message: text, last_message_at: data.created_at })
        .eq('id', roomId);
    }
    inputRef.current?.focus();
  }, [input, myId, myLangRaw, roomId]);

  const handleRetry = useCallback((msg: Message) => {
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    setInput(msg.content);
    inputRef.current?.focus();
  }, []);

  // ─── 팔로우 ───────────────────────────────

  const handleFollow = async () => {
    if (!myId || !otherUser) return;
    setFollowLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setFollowLoading(false); return; }
    const method = isFollowing ? 'DELETE' : 'POST';
    const res = await fetch('/api/follow', {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ targetUserId: otherUser.id }),
    });
    if (res.ok) {
      const newFollowing = !isFollowing;
      setIsFollowing(newFollowing);
      const { data: theirFollow } = await supabase
        .from('user_follow').select('id')
        .eq('follower_id', otherUser.id).eq('following_id', myId).maybeSingle();
      setIsMutualFollow(newFollowing && !!theirFollow);
    }
    setFollowLoading(false);
  };

  // ─── 차단 ─────────────────────────────────

  const handleBlock = async () => {
    if (!myId || !otherUser || !window.confirm(t('chat.blockConfirm'))) return;
    setMenuOpen(false);
    await supabase.from('user_block').insert({ blocker_id: myId, blocked_id: otherUser.id });
    await Promise.all([
      supabase.from('user_follow').delete().eq('follower_id', myId).eq('following_id', otherUser.id),
      supabase.from('user_follow').delete().eq('follower_id', otherUser.id).eq('following_id', myId),
    ]);
    setIsBlocked(true);
    setIsMutualFollow(false);
    setIsFollowing(false);
  };

  // ─── 나가기 ───────────────────────────────

  const handleLeave = useCallback(async () => {
    if (!myId || !window.confirm(t('chat.leaveConfirm'))) return;
    setMenuOpen(false);
    const { data: room } = await supabase
      .from('chat_room').select('user_a, user_b').eq('id', roomId).maybeSingle();
    if (!room) return;
    const field = room.user_a === myId ? 'user_a_hidden' : 'user_b_hidden';
    await supabase.from('chat_room').update({ [field]: true }).eq('id', roomId);
    router.push('/dashboard/chat');
  }, [myId, roomId, router, t]);

  const timeLabel = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20 text-gray-400">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-96px)] md:h-[calc(100vh-32px)] max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard/chat')}
          className="text-gray-500 hover:text-gray-700 mr-1"
        >
          ←
        </button>
        {otherUser && (
          <>
            <AvatarImage src={otherUser.image_url} size={36} />
            <div className="flex-1">
              <span className="font-semibold text-gray-800">{otherUser.nickname}</span>
              {otherUser.flag && (
                <span className="ml-1 text-base">{FLAG_EMOJI_MAP[otherUser.flag] ?? ''}</span>
              )}
            </div>
          </>
        )}
        <div className="relative">
          <button
            className="text-gray-400 hover:text-gray-600 px-2 py-1 text-base leading-none"
            onClick={() => setMenuOpen((o) => !o)}
          >
            •••
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-9 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-40">
                <button className="w-full text-center py-3 text-sm text-red-500 hover:bg-gray-50" onClick={handleBlock}>
                  {t('chat.menuBlock')}
                </button>
                <button
                  className="w-full text-center py-3 text-sm text-orange-500 hover:bg-gray-50"
                  onClick={() => { setMenuOpen(false); setShowReport(true); }}
                >
                  {t('chat.menuReport')}
                </button>
                <button className="w-full text-center py-3 text-sm text-gray-600 hover:bg-gray-50" onClick={handleLeave}>
                  {t('chat.menuLeave')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 팔로우 유도 배너 */}
      {!isMutualFollow && !isBlocked && otherUser && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-xs text-amber-700 flex-1">{t('chat.mutualFollowRequired')}</p>
          {!isFollowing && (
            <button
              onClick={handleFollow}
              disabled={followLoading}
              className="text-xs bg-[#9DB8A0] text-white px-3 py-1 rounded-full font-medium hover:opacity-90 disabled:opacity-60 flex-shrink-0"
            >
              {followLoading ? '...' : t('chat.followButton')}
            </button>
          )}
        </div>
      )}

      {/* 차단 배너 */}
      {isBlocked && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex-shrink-0">
          <p className="text-xs text-red-600 text-center">{t('chat.blocked')}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-8">{t('chat.noMessages')}</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === myId;
            const translated = !isMine ? translatedMap[msg.id] : undefined;
            const showOrig = showOriginalMap[msg.id] ?? false;
            const displayText = translated && !showOrig ? translated : msg.content;
            const isTranslated = !!translated && !msg.pending;

            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} items-end gap-2`}>
                {!isMine && otherUser && <AvatarImage src={otherUser.image_url} size={28} />}
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[70vw] md:max-w-xs`}>
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm transition-opacity ${
                      isMine
                        ? 'bg-[#9DB8A0] text-white rounded-br-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    } ${msg.pending ? 'opacity-50' : 'opacity-100'}`}
                  >
                    {msg.is_deleted ? <span className="italic opacity-60">삭제된 메시지</span> : displayText}
                  </div>

                  {isTranslated && (
                    <button
                      onClick={() => setShowOriginalMap((prev) => ({ ...prev, [msg.id]: !showOrig }))}
                      className="text-[10px] text-gray-400 hover:text-gray-600 mt-0.5 px-1"
                    >
                      {showOrig ? '번역 보기' : '원문 보기'}
                    </button>
                  )}

                  <div className="flex items-center gap-1 mt-0.5">
                    {msg.pending && <span className="text-[10px] text-gray-400">전송 중...</span>}
                    {msg.failed && (
                      <button onClick={() => handleRetry(msg)} className="text-[10px] text-red-500 hover:underline">
                        ⚠ 재전송
                      </button>
                    )}
                    {!msg.pending && !msg.failed && (
                      <span className="text-xs text-gray-400">{timeLabel(msg.created_at)}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0">
        {isMutualFollow && !isBlocked ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={t('chat.inputPlaceholder')}
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#9DB8A0]"
              maxLength={1000}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="bg-[#9DB8A0] text-white rounded-full w-9 h-9 flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition"
            >
              ↑
            </button>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-400 py-1">
            {isBlocked ? t('chat.blocked') : t('chat.mutualFollowRequired')}
          </p>
        )}
      </div>

      {otherUser && (
        <ReportModal
          isOpen={showReport}
          onClose={() => setShowReport(false)}
          targetType="user"
          targetId={otherUser.id}
        />
      )}
    </div>
  );
}
