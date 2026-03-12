'use client'

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import WritePostModal from '@/components/common/WritePostModal';
import LoginModal from '@/components/common/LoginModal';
import Link from 'next/link';

interface Post {
  id: string;
  title: string;
  category: string;
  language: string;
  author_id: string;
  created_at: string;
  like_count: number;
  comment_count: number;
  nickname: string | null;
}

const CATEGORIES = [
  { label: 'All Posts', value: '' },
  { label: 'Food 🍚', value: 'food' },
  { label: 'Housing 🏠', value: 'housing' },
  { label: 'School 🏫', value: 'school' },
  { label: 'Job 👨\u200d💻', value: 'job' },
  { label: 'Hospital 🏥', value: 'hospital' },
  { label: 'Info 💁', value: 'info' },
  { label: 'Free 🍀', value: 'free' },
];

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError('');

      let query = supabase
        .from('post')
        .select('id, title, category, language, author_id, created_at, like_count, comment_count, public_profile(nickname)')
        .order('created_at', { ascending: false });

      if (activeCategory) {
        query = query.eq('category', activeCategory);
      }

      const { data, error } = await query;

      if (error) {
        setError('Failed to load posts');
        setPosts([]);
      } else {
        const normalized = (data || []).map((p: any) => ({
          ...p,
          nickname: Array.isArray(p.public_profile) ? p.public_profile[0]?.nickname : p.public_profile?.nickname ?? null,
        }));
        setPosts(normalized);
      }
      setLoading(false);
    };
    fetchPosts();
  }, [activeCategory, isWriteOpen]);

  const handleWriteClick = () => {
    if (!isLoggedIn) {
      setIsLoginOpen(true);
    } else {
      setIsWriteOpen(true);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl font-bold">Community</h1>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
              activeCategory === cat.value
                ? 'bg-[#9DB8A0] text-white border-[#9DB8A0]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-[#9DB8A0]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No posts yet.</div>
        ) : (
          posts.map((post) => (
            <Link href={`/dashboard/community/${post.id}`} key={post.id}>
              <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition cursor-pointer">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-2">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full capitalize">
                        {post.category || post.language}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold hover:text-[#9DB8A0]">{post.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {post.nickname ?? 'Unknown'} · {timeAgo(post.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-3 text-sm text-gray-500 shrink-0">
                    <span>♡ {post.like_count}</span>
                    <span>💬 {post.comment_count}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        className="fixed bottom-8 right-8 z-50 bg-[#9DB8A0] text-white px-5 py-3 rounded-full font-semibold shadow-lg hover:opacity-90 transition flex items-center gap-2"
        onClick={handleWriteClick}
      >
        + Write a post
      </button>

      <WritePostModal
        isOpen={isWriteOpen}
        onClose={() => setIsWriteOpen(false)}
        onRequireLogin={() => setIsLoginOpen(true)}
      />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </div>
  );
}
