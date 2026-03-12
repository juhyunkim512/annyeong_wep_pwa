"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import LoginModal from "@/components/common/LoginModal";
import AvatarImage from "@/components/common/AvatarImage";
import { useRouter } from "next/navigation";

const FLAG_EMOJI_MAP: { [key: string]: string } = {
  korea: "🇰🇷",
  usa: "🇺🇸",
  jpan: "🇯🇵",
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
  created_at: string;
  image_url?: string;
  nickname?: string;
  flag?: string;
  profile_image_url?: string;
  like_count?: number;
}

export default function PostDetailPage() {
  const params = useParams();
  const postId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentImage, setCommentImage] = useState<File | null>(null);
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

  // fetch post, author, comments, likes
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");
      const { data: sessionData } = await supabase.auth.getSession();
      setIsLoggedIn(!!sessionData.session);
      setCurrentUserId(sessionData.session?.user.id ?? null);
      // post fetch
      const { data: postData, error: postError } = await supabase
        .from("post")
        .select("*")
        .eq("id", postId)
        .maybeSingle();
      if (postError || !postData) {
        setError("Post not found");
        setPost(null);
        setLoading(false);
        return;
      }
      setPost(postData);
      // post_like 여부
      if (sessionData.session) {
        const { data: likeRow } = await supabase
          .from("post_like")
          .select("id")
          .eq("user_id", sessionData.session.user.id)
          .eq("post_id", postId)
          .maybeSingle();
        setPostLiked(!!likeRow);
      }
      // author fetch
      const { data: authorProfile } = await supabase
        .from("profile")
        .select("nickname, flag, image_url")
        .eq("id", postData.author_id)
        .maybeSingle();
      setAuthor(authorProfile);
      // comments fetch
      const { data: commentData } = await supabase
        .from("comment")
        .select("*, profile(nickname, flag, image_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      // flatten profile join
      const commentsWithProfile = (commentData || []).map((c: any) => ({
        ...c,
        nickname: c.profile?.nickname,
        flag: c.profile?.flag,
        profile_image_url: c.profile?.image_url,
      }));
      setComments(commentsWithProfile);
      // comment likes fetch
      if (sessionData.session) {
        const userId = sessionData.session.user.id;
        const { data: likeRows } = await supabase
          .from("comment_like")
          .select("comment_id")
          .eq("user_id", userId);
        const likeMap: { [commentId: string]: boolean } = {};
        (likeRows || []).forEach((row: any) => { likeMap[row.comment_id] = true; });
        setCommentLikes(likeMap);
      }
      setLoading(false);
    };
    fetchData();
  }, [postId, isLoginOpen, commentVersion, postLikeLoading, deleteLoading]);

  // 댓글 작성
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() && !commentImage) return;
    setCommentLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setIsLoginOpen(true);
      setCommentLoading(false);
      return;
    }
    let imageUrl = null;
    if (commentImage) {
      const fileExt = commentImage.name.split('.').pop();
      const filePath = `comment-images/${postId}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('comment-images')
        .upload(filePath, commentImage);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('comment-images').getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }
    }
    await supabase.from("comment").insert({
      post_id: postId,
      author_id: sessionData.session.user.id,
      content: commentText,
      image_url: imageUrl,
    });
    setCommentText("");
    setCommentImage(null);
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

  // 게시글 좋아요 토글
  const handlePostLike = async () => {
    setPostLikeLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setIsLoginOpen(true);
      setPostLikeLoading(false);
      return;
    }
    if (postLiked) {
      await supabase.from("post_like").delete().eq("user_id", sessionData.session.user.id).eq("post_id", postId);
    } else {
      await supabase.from("post_like").insert({ user_id: sessionData.session.user.id, post_id: postId });
    }
    setPostLikeLoading(false);
  };

  // 게시글 삭제
  const handleDeletePost = async () => {
    if (!window.confirm("정말 삭제하시겠습니까?")) return;
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
      setEditingPost(false);
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
      setEditingCommentId(null);
      setEditText("");
    }
  };

  // 비회원 접근 시 게이트
  if (!loading && !isLoggedIn) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">you have to need login</h2>
          <button
            className="bg-[#9DB8A0] text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90"
            onClick={() => setIsLoginOpen(true)}
          >
            Login
          </button>
        </div>
        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-12">
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : post ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          {/* 작성자 닉네임+국기 + ... 메뉴 */}
          <div className="flex items-center gap-2 mb-2">
            <AvatarImage src={author?.image_url} size={32} />
            <span className="text-lg font-semibold text-[#000000]">{author?.nickname || "Unknown"}</span>
            {author?.flag && <span className="text-xl">{getFlagEmoji(author.flag)}</span>}
            {isLoggedIn && post?.author_id === currentUserId && (
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
                      <button
                        className="w-full text-center py-3 text-sm text-blue-500 hover:bg-gray-50 border-b border-gray-100"
                        onClick={() => {
                          setEditPostTitle(post.title);
                          setEditPostContent(post.content);
                          setEditingPost(true);
                          setPostMenuOpen(false);
                        }}
                      >
                        수정
                      </button>
                      <button
                        className="w-full text-center py-3 text-sm text-red-500 hover:bg-gray-50"
                        onClick={() => {
                          handleDeletePost();
                          setPostMenuOpen(false);
                        }}
                        disabled={deleteLoading}
                      >
                        삭제
                      </button>
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
                  저장
                </button>
                <button
                  className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200"
                  onClick={() => setEditingPost(false)}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">{post.title}</h1>
              <div className="text-gray-800 mb-4 whitespace-pre-line">{post.content}</div>
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
          <div className="text-xs text-gray-400 mb-3">{new Date(post.created_at).toLocaleString()}</div>
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
            <h2 className="text-lg font-bold mb-4">Comments</h2>
            {comments.length === 0 ? (
              <div className="text-gray-400">No comments yet.</div>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                    {/* 닉네임 행: 닉네임+국기 / 오른쪽 끝에 시간 + ··· 메뉴 */}
                    <div className="flex items-center gap-2 mb-1">
                      <AvatarImage src={c.profile_image_url} size={28} />
                      <span className="font-semibold text-[#9DB8A0]">{c.nickname || "Unknown"}</span>
                      {c.flag && <span className="text-xl">{getFlagEmoji(c.flag)}</span>}
                      <span className="ml-auto text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                      {isLoggedIn && c.author_id === currentUserId && (
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
                                <button
                                  className="w-full text-center py-3 text-sm text-blue-500 hover:bg-gray-50 border-b border-gray-100"
                                  onClick={() => {
                                    setEditingCommentId(c.id);
                                    setEditText(c.content);
                                    setCommentMenuOpen(null);
                                  }}
                                >
                                  수정
                                </button>
                                <button
                                  className="w-full text-center py-3 text-sm text-red-500 hover:bg-gray-50"
                                  onClick={() => {
                                    handleDeleteComment(c.id, c.author_id);
                                    setCommentMenuOpen(null);
                                  }}
                                >
                                  삭제
                                </button>
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
                          저장
                        </button>
                        <button
                          className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-sm hover:bg-gray-200"
                          onClick={() => { setEditingCommentId(null); setEditText(""); }}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="text-gray-700 text-sm mb-2">{c.content}</div>
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
              {commentImage && (
                <div className="flex items-center gap-2 px-1">
                  <img
                    src={URL.createObjectURL(commentImage)}
                    alt="preview"
                    className="w-14 h-14 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-red-400 transition"
                    onClick={() => setCommentImage(null)}
                  >
                    × Remove
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <label className="flex items-center gap-1 cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm px-3 py-2 rounded-lg transition flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCommentImage(e.target.files[0]);
                      }
                    }}
                    disabled={commentLoading || !isLoggedIn}
                  />
                </label>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                  disabled={commentLoading || !isLoggedIn}
                />
                <button
                  type="submit"
                  className="bg-[#9DB8A0] text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                  disabled={commentLoading || !isLoggedIn || (!commentText.trim() && !commentImage)}
                >
                  Send
                </button>
              </div>
            </form>
            {!isLoggedIn && (
              <div className="text-xs text-gray-400 mt-2">Login required to comment.</div>
            )}
          </div>
        </div>
      ) : null}
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
