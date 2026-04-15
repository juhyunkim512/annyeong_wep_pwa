"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import LoginModal from "@/components/common/LoginModal";
import AvatarImage from "@/components/common/AvatarImage";
import UserProfileModal from "@/components/common/UserProfileModal";
import ReportModal from "@/components/common/ReportModal";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getClientTranslation, setClientTranslation } from "@/lib/utils/clientTranslateCache";

// ── 클라이언트 측 언어 정규화 (서버 LANG_MAP 과 동일) ──────────────
const LANG_MAP: Record<string, string> = {
  english: 'en', korean: 'ko', japanese: 'ja',
  chinese: 'zh', spanish: 'es', vietnamese: 'vi',
  en: 'en', ko: 'ko', ja: 'ja', zh: 'zh', es: 'es', vi: 'vi',
  'zh-cn': 'zh', 'zh-tw': 'zh', 'zh-hant': 'zh', 'zh-hans': 'zh',
};
function normalizeLang(v?: string | null): string {
  if (!v) return 'en';
  return LANG_MAP[v.toLowerCase().trim()] ?? 'en';
}

// ── /api/translate 호출 헬퍼 (모듈 레벨, 클라이언트 캐시 적용) ─────────────────────────
async function callTranslate(
  contentType: 'post' | 'comment',
  contentId: string,
  fieldName: 'title' | 'content',
  sourceText: string,
  sourceLanguage: string,
  targetLang: string,
  accessToken: string,
  signal: AbortSignal,
): Promise<{ text: string; isTranslated: boolean }> {
  const cached = getClientTranslation(contentId, fieldName, targetLang)
  if (cached) return cached
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ contentType, contentId, fieldName, sourceText, sourceLanguage }),
      signal,
    });
    if (!res.ok) return { text: sourceText, isTranslated: false };
    const result = await res.json()
    setClientTranslation(contentId, fieldName, result, targetLang)
    return result
  } catch {
    return { text: sourceText, isTranslated: false };
  }
}

const FLAG_EMOJI_MAP: { [key: string]: string } = {
  korea: "🇰🇷",
  usa: "🇺🇸",
  japan: "🇯🇵",
  china: "🇨🇳",
  vietnam: "🇻🇳",
  spain: "🇪🇸",
  france: "🇫🇷",
  germany: "🇩🇪",
  thailand: "🇹🇭",
  philippines: "🇵🇭",
};
const getFlagEmoji = (flag?: string) => FLAG_EMOJI_MAP[flag || ""] || "";

interface Post {
  id: string;
  title: string;
  content: string;
  category: string;
  region: string;
  language: string;
  author_id: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  image_url?: string[];
}
interface Profile { nickname: string; flag?: string; image_url?: string; }
interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  language?: string;          // 댓글 작성자의 언어 (번역 sourceLanguage 에 사용)
  created_at: string;
  image_url?: string;
  nickname?: string;
  flag?: string;
  profile_image_url?: string;
  like_count?: number;
}

export default function PostDetailPage() {
  const params = useParams();
  const { t } = useTranslation('common');
  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return t('common.justNow');
    if (diff < 3600) return t('common.minutesAgo', { count: Math.floor(diff / 60) });
    if (diff < 86400) return t('common.hoursAgo', { count: Math.floor(diff / 3600) });
    if (diff < 86400 * 7) return t('common.daysAgo', { count: Math.floor(diff / 86400) });
    if (diff < 86400 * 30) return t('common.weeksAgo', { count: Math.floor(diff / (86400 * 7)) });
    if (diff < 86400 * 365) return t('common.monthsAgo', { count: Math.floor(diff / (86400 * 30)) });
    return t('common.yearsAgo', { count: Math.floor(diff / (86400 * 365)) });
  };
  const postId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [commentText, setCommentText] = useState("");

  const [commentLoading, setCommentLoading] = useState(false);
  const [commentLikeLoading, setCommentLikeLoading] = useState<string | null>(null);
  const [commentLikes, setCommentLikes] = useState<{ [commentId: string]: boolean }>({});
  const [commentVersion, setCommentVersion] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");
  const router = useRouter();
  const [postLiked, setPostLiked] = useState(false);
  const [postLikeLoading, setPostLikeLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'post' | 'comment'; id: string } | null>(null);

  // ── 번역 상태 ──────────────────────────────────────────────────────
  const [translatedPost, setTranslatedPost] = useState<{
    title: string; titleIsTranslated: boolean;
    content: string; contentIsTranslated: boolean;
  } | null>(null);
  const [translatedComments, setTranslatedComments] = useState<
    Record<string, { text: string; isTranslated: boolean }>
  >({});
  // 원문/번역 토글 상태
  const [showOriginalPost, setShowOriginalPost] = useState(false);
  const [showOriginalComments, setShowOriginalComments] = useState<Record<string, boolean>>({});

  // ── 로그인 모달 닫힌 시에만 auth 상태 업데이트 (풀 리패치 없이) ─────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
      setCurrentUserId(session?.user.id ?? null)
    })
  }, [isLoginOpen])

  // fetch post, author, comments, likes
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;

        // ✅ post fetch
        const { data: postData, error: postError } = await supabase
          .from("post")
          .select("*")
          .eq("id", postId)
          .maybeSingle();
        if (controller.signal.aborted) return;
        if (postError || !postData) {
          setError("Post not found");
          setPost(null);
          return;
        }
        setPost(postData);

        // ✅ like + author + comments + comment_likes 병렬 fetch
        const [likeResult, authorResult, commentResult, commentLikeResult] = await Promise.all([
          sessionData.session
            ? supabase.from("post_like").select("id").eq("user_id", sessionData.session.user.id).eq("post_id", postId).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from("profile").select("nickname, flag, image_url").eq("id", postData.author_id).maybeSingle(),
          supabase.from("comment").select("*, profile(nickname, flag, image_url)").eq("post_id", postId).order("created_at", { ascending: true }),
          sessionData.session
            ? supabase.from("comment_like").select("comment_id").eq("user_id", sessionData.session.user.id)
            : Promise.resolve({ data: null }),
        ]);
        if (controller.signal.aborted) return;

        if (likeResult.data) setPostLiked(true);
        setAuthor((authorResult as any).data ?? null);

        const commentsWithProfile = (((commentResult as any).data as any[]) || []).map((c: any) => ({
          ...c,
          nickname: c.profile?.nickname,
          flag: c.profile?.flag,
          profile_image_url: c.profile?.image_url,
        }));
        setComments(commentsWithProfile);

        const likeMap: { [commentId: string]: boolean } = {};
        (((commentLikeResult as any).data as any[]) || []).forEach((row: any) => { likeMap[row.comment_id] = true; });
        setCommentLikes(likeMap);

        setLoading(false);

        // ── 번역: 완전히 분리된 비동기 컨텍스트 (I18nProvider auth 충돌 방지) ──
        if (sessionData.session) {
          const _session = sessionData.session;
          const _post = postData;
          const _comments = commentsWithProfile;
          void (async () => {
            try {
              if (controller.signal.aborted) return;
              const { data: userProfile } = await supabase
                .from('profile')
                .select('uselanguage')
                .eq('id', _session.user.id)
                .maybeSingle();
              if (controller.signal.aborted) return;
              const userLangCode = normalizeLang(userProfile?.uselanguage);
              const postLangCode = normalizeLang(_post.language);
              const accessToken = _session.access_token;
              if (userLangCode !== postLangCode) {
                const [titleRes, contentRes] = await Promise.all([
                  callTranslate('post', _post.id, 'title', _post.title, _post.language, userLangCode, accessToken, controller.signal),
                  callTranslate('post', _post.id, 'content', _post.content, _post.language, userLangCode, accessToken, controller.signal),
                ]);
                if (!controller.signal.aborted) {
                  setTranslatedPost({
                    title: titleRes.isTranslated ? titleRes.text : _post.title,
                    titleIsTranslated: titleRes.isTranslated,
                    content: contentRes.isTranslated ? contentRes.text : _post.content,
                    contentIsTranslated: contentRes.isTranslated,
                  });
                }
                if (_comments.length > 0 && !controller.signal.aborted) {
                  const commentResults = await Promise.all(
                    _comments.map((c) =>
                      callTranslate('comment', c.id, 'content', c.content, c.language ?? _post.language, userLangCode, accessToken, controller.signal)
                    )
                  );
                  if (!controller.signal.aborted) {
                    const cMap: Record<string, { text: string; isTranslated: boolean }> = {};
                    _comments.forEach((c, i) => {
                      cMap[c.id] = {
                        text: commentResults[i].isTranslated ? commentResults[i].text : c.content,
                        isTranslated: commentResults[i].isTranslated,
                      };
                    });
                    setTranslatedComments(cMap);
                  }
                }
              }
            } catch { /* 번역 실패는 무시 */ }
          })()
        }
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return;
        console.error("[PostDetail] fetchData exception:", err);
        setError("Failed to load post");
      } finally {
        // 에러 경로에서 loading이 아직 true이면 해제 (React 18은 unmounted setState 무시)
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [postId, commentVersion]);

  // 댓글 작성
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setIsLoginOpen(true);
      setCommentLoading(false);
      return;
    }
    await supabase.from("comment").insert({
      post_id: postId,
      author_id: sessionData.session.user.id,
      content: commentText,
      // [수정] 댓글 작성자의 언어 저장 → 번역 sourceLanguage로 사용
      language: (await supabase.from('profile').select('uselanguage').eq('id', sessionData.session.user.id).maybeSingle()).data?.uselanguage ?? 'english',
    });

    // 글 작성자에게 푸쉬 알림 전송 (본인 글에 댓글 달 때는 제외)
    if (post && post.author_id !== sessionData.session.user.id) {
      fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: post.author_id,
          title: 'ANNYEONG - 새 댓글',
          body: commentText.length > 60 ? commentText.slice(0, 60) + '…' : commentText,
          url: `/dashboard/community/${postId}`,
        }),
      }).catch(() => {});
    }

    setCommentText("");
    setCommentLoading(false);
    setCommentVersion((v) => v + 1); // 댓글 목록 refetch 트리거
  };

  // 댓글 좋아요 토글 (optimistic update)
  const handleCommentLike = async (commentId: string) => {
    // 중복 클릭 방지
    if (commentLikeLoading === commentId) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setIsLoginOpen(true);
      return;
    }

    const currentlyLiked = !!commentLikes[commentId];

    // ── Optimistic update: 즉시 UI 반영 ──
    setCommentLikes((prev) => ({ ...prev, [commentId]: !currentlyLiked }));
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, like_count: (c.like_count ?? 0) + (currentlyLiked ? -1 : 1) }
          : c
      )
    );

    setCommentLikeLoading(commentId);
    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from("comment_like")
          .delete()
          .eq("user_id", sessionData.session.user.id)
          .eq("comment_id", commentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("comment_like")
          .insert({ user_id: sessionData.session.user.id, comment_id: commentId });
        if (error) throw error;
      }
    } catch {
      // ── Rollback: 요청 실패 시 이전 상태 복원 ──
      setCommentLikes((prev) => ({ ...prev, [commentId]: currentlyLiked }));
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, like_count: (c.like_count ?? 0) + (currentlyLiked ? 1 : -1) }
            : c
        )
      );
    } finally {
      setCommentLikeLoading(null);
    }
  };

  // 게시글 좋아요 토글 (optimistic update)
  const handlePostLike = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setIsLoginOpen(true);
      return;
    }
    const wasLiked = postLiked;
    // Optimistic update: 즐시 UI 반영
    setPostLiked(!wasLiked);
    setPost((prev) => prev ? { ...prev, like_count: prev.like_count + (wasLiked ? -1 : 1) } : prev);
    setPostLikeLoading(true);
    try {
      if (wasLiked) {
        await supabase.from("post_like").delete().eq("user_id", sessionData.session.user.id).eq("post_id", postId);
      } else {
        await supabase.from("post_like").insert({ user_id: sessionData.session.user.id, post_id: postId });
      }
    } catch {
      // Rollback on error
      setPostLiked(wasLiked);
      setPost((prev) => prev ? { ...prev, like_count: prev.like_count + (wasLiked ? 1 : -1) } : prev);
    } finally {
      setPostLikeLoading(false);
    }
  };

  // 게시글 삭제
  const handleDeletePost = async () => {
    if (!window.confirm(t('community.deleteConfirm'))) return;
    setDeleteLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session || post?.author_id !== sessionData.session.user.id) {
      setDeleteLoading(false);
      return;
    }
    await supabase.from("post").delete().eq("id", postId);
    setDeleteLoading(false);
    router.push("/dashboard/community");
  };

  // 게시글 수정
  const handleEditPost = async () => {
    if (!editPostTitle.trim() || !editPostContent.trim()) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const { error } = await supabase
      .from("post")
      .update({ title: editPostTitle, content: editPostContent })
      .eq("id", postId);
    if (!error) {
      setPost((prev) => prev ? { ...prev, title: editPostTitle, content: editPostContent } : prev);
      setTranslatedPost(null); // 수정 후 번역 캐시 클리어 (원문 표시)
      setEditingPost(false);
      fetch('/api/post/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ postId }),
      }).catch(console.error);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId: string, authorId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session || authorId !== sessionData.session.user.id) return;
    await supabase.from("comment").delete().eq("id", commentId);
    setCommentVersion((v) => v + 1);
  };

  // 댓글 수정
  const handleEditComment = async (commentId: string) => {
    if (!editText.trim()) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const { error } = await supabase
      .from("comment")
      .update({ content: editText })
      .eq("id", commentId);
    if (!error) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, content: editText } : c))
      );
      // 수정된 댓글 번역 캐시 클리어
      setTranslatedComments((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      setEditingCommentId(null);
      setEditText("");
    }
  };

  // 비회원 접근 시 게이트
  if (!loading && !isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">{t('auth.loginRequiredDesc')}</h2>
          <button
            className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
            onClick={() => setIsLoginOpen(true)}
          >
            {t('auth.login')}
          </button>
        </div>
        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12">
      {loading ? (
        <div className="text-center py-8 text-gray-400">{t('common.loading')}</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : post ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {/* 작성자 닉네임+국기 + ... 메뉴 */}
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              className="flex-shrink-0"
              onClick={() => {
                if (post?.author_id && post.author_id !== currentUserId) {
                  setProfileModalUserId(post.author_id);
                }
              }}
            >
              <AvatarImage src={author?.image_url} size={32} />
            </button>
            <button
              type="button"
              className="text-lg font-semibold text-[#000000] hover:underline"
              onClick={() => {
                if (post?.author_id && post.author_id !== currentUserId) {
                  setProfileModalUserId(post.author_id);
                }
              }}
            >
              {author?.nickname || "Unknown"}
            </button>
            {author?.flag && <span className="text-xl">{getFlagEmoji(author.flag)}</span>}
            {isLoggedIn && (
              <div className="relative ml-auto">
                <button
                  className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded text-base leading-none"
                  onClick={() => setPostMenuOpen((o) => !o)}
                >
                  •••
                </button>
                {postMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setPostMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-24">
                      {post?.author_id === currentUserId ? (
                        <>
                          <button
                            className="w-full text-center py-3 text-sm text-blue-500 hover:bg-gray-50 border-b border-gray-100"
                            onClick={() => {
                              setEditPostTitle(post.title);
                              setEditPostContent(post.content);
                              setEditingPost(true);
                              setPostMenuOpen(false);
                            }}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            className="w-full text-center py-3 text-sm text-red-500 hover:bg-gray-50"
                            onClick={() => {
                              handleDeletePost();
                              setPostMenuOpen(false);
                            }}
                            disabled={deleteLoading}
                          >
                            {t('common.delete')}
                          </button>
                        </>
                      ) : (
                        <button
                          className="w-full text-center py-3 text-sm text-gray-600 hover:bg-gray-50"
                          onClick={() => {
                            setReportTarget({ type: 'post', id: postId });
                            setPostMenuOpen(false);
                          }}
                        >
                          {t('community.report')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          {/* 제목 + 본문: 인라인 수정 폼 or 일반 표시 */}
          {editingPost ? (
            <div className="mb-6">
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-bold mb-2 focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                value={editPostTitle}
                onChange={(e) => setEditPostTitle(e.target.value)}
              />
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
                rows={5}
                value={editPostContent}
                onChange={(e) => setEditPostContent(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  className="bg-[#9DB8A0] text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90"
                  onClick={handleEditPost}
                >
                  {t('common.save')}
                </button>
                <button
                  className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200"
                  onClick={() => setEditingPost(false)}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">
                {showOriginalPost || !translatedPost?.titleIsTranslated
                  ? post.title
                  : translatedPost!.title}
              </h1>
              {translatedPost?.titleIsTranslated && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">🌐 {t('community.translated')}</span>
                  <button
                    className="text-xs text-[#9DB8A0] underline hover:opacity-80"
                    onClick={() => setShowOriginalPost((v) => !v)}
                  >
                    {showOriginalPost ? t('community.viewTranslation') : t('community.viewOriginal')}
                  </button>
                </div>
              )}
              <div className="text-gray-800 mb-4 whitespace-pre-line">
                {showOriginalPost || !translatedPost?.contentIsTranslated
                  ? post.content
                  : translatedPost!.content}
              </div>
              {post.image_url && post.image_url.length > 0 && (
                <div className="space-y-3 mb-6">
                  {post.image_url.map((url, idx) => (
                    <img key={idx} src={url} alt={`post-image-${idx}`}
                      className="w-full rounded-xl object-contain max-h-[480px]" />
                  ))}
                </div>
              )}
            </>
          )}
          <div className="text-xs text-gray-400 mb-3">{timeAgo(post.created_at)}</div>
          <div className="flex items-center gap-4 mb-6">
            <button
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${postLiked ? 'bg-[#9DB8A0] text-white' : 'bg-white text-[#9DB8A0]'} hover:opacity-90`}
              onClick={handlePostLike}
              disabled={postLikeLoading}
            >
              {postLiked ? '❤️' : '♡'} {post.like_count}
            </button>
            <span className="text-gray-500">💬 {post.comment_count}</span>
          </div>
          {/* 댓글 섹션 */}
          <div className="mt-8">
            <h2 className="text-lg font-bold mb-4">{t('community.comments')}</h2>
            {comments.length === 0 ? (
              <div className="text-gray-400">{t('community.noComments')}</div>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    {/* 닉네임 행: 닉네임+국기 / 오른쪽 끝에 시간 + ··· 메뉴 */}
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        type="button"
                        className="flex-shrink-0"
                        onClick={() => {
                          if (c.author_id !== currentUserId) {
                            setProfileModalUserId(c.author_id);
                          }
                        }}
                      >
                        <AvatarImage src={c.profile_image_url} size={28} />
                      </button>
                      <button
                        type="button"
                        className="font-semibold text-[#9DB8A0] hover:underline"
                        onClick={() => {
                          if (c.author_id !== currentUserId) {
                            setProfileModalUserId(c.author_id);
                          }
                        }}
                      >
                        {c.nickname || "Unknown"}
                      </button>
                      {c.flag && <span className="text-xl">{getFlagEmoji(c.flag)}</span>}
                      <span className="ml-auto text-xs text-gray-400">{timeAgo(c.created_at)}</span>
                      {isLoggedIn && (
                        <div className="relative">
                          <button
                            className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded text-base leading-none"
                            onClick={() =>
                              setCommentMenuOpen(commentMenuOpen === c.id ? null : c.id)
                            }
                          >
                            •••
                          </button>
                          {commentMenuOpen === c.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setCommentMenuOpen(null)}
                              />
                              <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-24">
                                {c.author_id === currentUserId ? (
                                  <>
                                    <button
                                      className="w-full text-center py-3 text-sm text-blue-500 hover:bg-gray-50 border-b border-gray-100"
                                      onClick={() => {
                                        setEditingCommentId(c.id);
                                        setEditText(c.content);
                                        setCommentMenuOpen(null);
                                      }}
                                    >
                                      {t('common.edit')}
                                    </button>
                                    <button
                                      className="w-full text-center py-3 text-sm text-red-500 hover:bg-gray-50"
                                      onClick={() => {
                                        handleDeleteComment(c.id, c.author_id);
                                        setCommentMenuOpen(null);
                                      }}
                                    >
                                      {t('common.delete')}
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="w-full text-center py-3 text-sm text-gray-600 hover:bg-gray-50"
                                    onClick={() => {
                                      setReportTarget({ type: 'comment', id: c.id });
                                      setCommentMenuOpen(null);
                                    }}
                                  >
                                    {t('community.report')}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    {/* 내용 or 인라인 수정 폼 */}
                    {editingCommentId === c.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          className="flex-1 px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <button
                          className="bg-[#9DB8A0] text-white px-3 py-1 rounded-lg text-sm hover:opacity-90"
                          onClick={() => handleEditComment(c.id)}
                        >
                          {t('common.save')}
                        </button>
                        <button
                          className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm hover:bg-gray-200"
                          onClick={() => { setEditingCommentId(null); setEditText(""); }}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-700 text-sm mb-2">
                        {showOriginalComments[c.id] || !translatedComments[c.id]?.isTranslated
                          ? c.content
                          : translatedComments[c.id].text}
                        {translatedComments[c.id]?.isTranslated && (
                          <span className="ml-1 inline-flex items-center gap-1 align-middle">
                            <span className="text-xs text-gray-400">🌐 {t('community.translated')}</span>
                            <button
                              className="text-xs text-[#9DB8A0] underline hover:opacity-80"
                              onClick={() =>
                                setShowOriginalComments((prev) => ({
                                  ...prev,
                                  [c.id]: !prev[c.id],
                                }))
                              }
                            >
                              {showOriginalComments[c.id]
                                ? t('community.viewTranslation')
                                : t('community.viewOriginal')}
                            </button>
                          </span>
                        )}
                      </div>
                    )}
                    {c.image_url && (
                      <img src={c.image_url} alt="comment-img" className="w-20 h-20 object-cover rounded mt-1 mb-2" />
                    )}
                    {/* 좋아요 버튼 — 댓글 내용 아래 */}
                    <div>
                      <button
                        className={`text-sm flex items-center gap-1 px-2 py-1 rounded-full ${commentLikes[c.id] ? 'bg-[#9DB8A0] text-white' : 'bg-white text-[#9DB8A0]'} hover:opacity-90`}
                        disabled={commentLikeLoading === c.id}
                        onClick={() => handleCommentLike(c.id)}
                      >
                        {commentLikes[c.id] ? '❤️' : '♡'} {c.like_count ?? ''}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* 댓글 작성 */}
            <form onSubmit={handleCommentSubmit} className="mt-6 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t('community.commentPlaceholder')}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                  disabled={commentLoading || !isLoggedIn}
                />
                <button
                  type="submit"
                  className="bg-[#9DB8A0] text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                  disabled={commentLoading || !isLoggedIn || !commentText.trim()}
                >
                  {t('common.send')}
                </button>
              </div>
            </form>
            {!isLoggedIn && (
              <div className="text-xs text-gray-400 mt-2">{t('community.loginToComment')}</div>
            )}
          </div>
        </div>
      ) : null}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      {profileModalUserId && (
        <UserProfileModal
          userId={profileModalUserId}
          currentUserId={currentUserId}
          isOpen={!!profileModalUserId}
          onClose={() => setProfileModalUserId(null)}
          onLoginRequired={() => {
            setProfileModalUserId(null);
            setIsLoginOpen(true);
          }}
          onBlockChange={() => setCommentVersion((v) => v + 1)}
        />
      )}
      {reportTarget && (
        <ReportModal
          isOpen={!!reportTarget}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.type}
          targetId={reportTarget.id}
          onLoginRequired={() => {
            setReportTarget(null);
            setIsLoginOpen(true);
          }}
        />
      )}
    </div>
  );
}
