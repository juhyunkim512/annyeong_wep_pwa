import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

const CATEGORY_OPTIONS = [
  { label: 'Food', value: 'food' },
  { label: 'Housing', value: 'housing' },
  { label: 'School', value: 'school' },
  { label: 'Job', value: 'job' },
  { label: 'Hospital', value: 'hospital' },
  { label: 'Info', value: 'info' },
  { label: 'Free', value: 'free' },
];

interface WritePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequireLogin: () => void;
}

export default function WritePostModal({ isOpen, onClose, onRequireLogin }: WritePostModalProps) {
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).slice(0, 3);
    setImages(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
  };

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!category || !title || !content) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setLoading(false);
      onRequireLogin();
      return;
    }
    const userId = session.user.id;

    let uselanguage = 'english';
    const { data: profile } = await supabase
      .from('profile')
      .select('uselanguage')
      .eq('id', userId)
      .single();
    if (profile?.uselanguage) uselanguage = profile.uselanguage;

    // 이미지 먼저 업로드 → public URL 수집
    const imageUrls: string[] = [];
    for (const file of images) {
      const ext = file.name.split('.').pop();
      const filePath = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('post-images')
        .upload(filePath, file);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(filePath);
        imageUrls.push(urlData.publicUrl);
      }
    }

    const { error: postError } = await supabase
      .from('post')
      .insert({
        author_id: userId,
        title,
        content,
        category,
        region: 'seoul',
        language: uselanguage,
        image_url: imageUrls.length > 0 ? imageUrls : null,
      });

    if (postError) {
      setError('Failed to save post.');
      setLoading(false);
      return;
    }

    setLoading(false);
    setCategory('');
    setTitle('');
    setContent('');
    setImages([]);
    setPreviews([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Write a Post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={loading}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-semibold mb-2">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              required
              disabled={loading}
            >
              <option value="">Select a category</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              required
              disabled={loading}
            />
          </div>
          {/* Content */}
          <div>
            <label className="block text-sm font-semibold mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] min-h-[120px]"
              required
              disabled={loading}
            />
          </div>
          {/* Images */}
          <div>
            <label className="block text-sm font-semibold mb-2">Photo (optional)</label>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <span className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                📷 Upload Image {images.length > 0 && `(${images.length}/3)`}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageChange}
                disabled={loading}
              />
            </label>
            {previews.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative">
                    <img src={src} alt="preview" className="w-20 h-20 object-cover rounded-lg border" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-1.5 -right-1.5 bg-gray-700 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-500 transition"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Error */}
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-[#9DB8A0] text-white py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 mt-2"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Submit'}
          </button>
        </form>
      </div>
    </div>
  );
}
