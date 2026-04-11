import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';
import '@/lib/i18n';

const TITLE_MAX = 30;
const CONTENT_MAX = 200;

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
  const { t } = useTranslation('common');
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
      setError(t('writePost.fillRequired'));
      return;
    }
    if (title.length > TITLE_MAX) {
      setError(t('writePost.titleTooLong'));
      return;
    }
    if (content.length > CONTENT_MAX) {
      setError(t('writePost.contentTooLong'));
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

    const { data: postData, error: postError } = await supabase
      .from('post')
      .insert({
        author_id: userId,
        title,
        content,
        category,
        region: 'seoul',
        language: uselanguage,
        image_url: imageUrls.length > 0 ? imageUrls : null,
      })
      .select('id')
      .single();

    if (postError) {
      setError(t('writePost.failed'));
      setLoading(false);
      return;
    }

    if (postData?.id) {
      fetch('/api/post/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ postId: postData.id }),
      }).catch(console.error);
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
          <h2 className="text-xl font-bold">{t('writePost.title')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl" disabled={loading}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('writePost.category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
              required
              disabled={loading}
            >
              <option value="">{t('writePost.categoryPlaceholder')}</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {/* Title */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold">{t('writePost.postTitle')}</label>
              <span className={`text-xs ${title.length > TITLE_MAX ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              placeholder={t('writePost.titlePlaceholder')}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] ${
                title.length >= TITLE_MAX ? 'border-red-400' : 'border-gray-300'
              }`}
              required
              disabled={loading}
            />
          </div>
          {/* Content */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold">{t('writePost.content')}</label>
              <span className={`text-xs ${content.length >= CONTENT_MAX ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {content.length}/{CONTENT_MAX}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
              placeholder={t('writePost.contentPlaceholder')}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] min-h-[120px] ${
                content.length >= CONTENT_MAX ? 'border-red-400' : 'border-gray-300'
              }`}
              required
              disabled={loading}
            />
          </div>
          {/* Images */}
          <div>
            <label className="block text-sm font-semibold mb-2">{t('writePost.photo')}</label>
            <label className="flex items-center gap-2 cursor-pointer w-fit">
              <span className="bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                {t('writePost.uploadImage')} {images.length > 0 && `(${images.length}/3)`}
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
            {loading ? t('writePost.saving') : t('writePost.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
