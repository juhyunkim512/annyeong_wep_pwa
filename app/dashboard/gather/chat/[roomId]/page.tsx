'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import AvatarImage from '@/components/common/AvatarImage';
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

    // 유저 언어 조회
    const { data: profile } = await supabase
      .from('profile')
      .select('uselanguage')
      .eq('id', session.user.id)
      .maybeSingle();
    const userLang = normalizeLang(profile?.uselanguage);
    setMyLanguage(userLang);

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
      setMessages(data.messages || []);

      if (data.room && new Date(data.room.expires_at).getTime() < Date.now()) {
        setIsExpired(true);
      }

      // 초기 번역
      void translateMessages(data.messages || [], userLang, session.access_token);
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

  // ── 폴링 (5초 간격) ──
  useEffect(() => {
    if (!accessToken || isExpired) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/gather/chat/${roomId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          const newMsgs: ChatMessage[] = data.messages || [];
          setMessages(newMsgs);

          if (data.room && new Date(data.room.expires_at).getTime() < Date.now()) {
            setIsExpired(true);
          }

          // 폴링 시 새 메시지 번역
          void translateMessages(newMsgs, myLanguage, accessToken);
        }
      } catch { /* ignore */ }
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [accessToken, roomId, isExpired, myLanguage, translateMessages]);

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

  // ── 메시지 전송 ──
  const handleSend = async () => {
    if (!input.trim() || sending || isExpired || !accessToken) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/gather/chat/${roomId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content, language: myLanguage }),
      });

      if (res.ok) {
        const refreshRes = await fetch(`/api/gather/chat/${roomId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          const newMsgs: ChatMessage[] = data.messages || [];
          setMessages(newMsgs);
          void translateMessages(newMsgs, myLanguage, accessToken);
        }
      }
    } catch { /* ignore */ }

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
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white">
        <button
          onClick={() => router.push('/dashboard/gather')}
          className="text-gray-500 hover:text-gray-700 text-lg"
        >
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold truncate">{room?.title || t('gather.groupChat.title')}</h2>
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
      <div className="border-t bg-white p-3">
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
    </div>
  );
}

