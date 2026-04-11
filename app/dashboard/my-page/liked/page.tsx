'use client'

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

interface PostItem {
  id: string;
  title: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export default function LikedPostsPage() {
  const router = useRouter();
  const { t } = useTranslation('common');
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.replace('/dashboard/my-page'); return; }

        const { data } = await supabase
          .from('post_like')
          .select('post(id, title, like_count, comment_count, created_at)')
          .eq('user_id', session.user.id);

        const likedPosts = (data ?? [])
          .map((row: any) => (Array.isArray(row.post) ? row.post[0] : row.post))
          .filter(Boolean);

        setPosts(likedPosts);
      } catch (err) {
        console.error('[LikedPosts] init exception:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-800 transition text-xl">‹</button>
        <h1 className="text-3xl font-bold">{t('myPage.likedPosts')}</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-3">❤️</span>
          <p className="text-gray-500 text-sm">{t('myPage.noPostsLiked')}</p>
          <Link href="/dashboard/community" className="mt-4 text-sm text-[#9DB8A0] font-semibold hover:underline">
            {t('common.exploreCommunity')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Link href={`/dashboard/community/${p.id}`} key={p.id}>
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition cursor-pointer">
                <p className="font-semibold text-gray-900 truncate">{p.title}</p>
                <p className="text-xs text-gray-500 mt-1.5">
                  ♡ {p.like_count} · 💬 {p.comment_count} · {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
