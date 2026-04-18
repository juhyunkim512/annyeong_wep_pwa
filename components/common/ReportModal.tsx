'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useTranslation } from 'react-i18next';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'user';
  targetId: string;
  onLoginRequired?: () => void;
}

export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  onLoginRequired,
}: ReportModalProps) {
  const { t } = useTranslation('common');
  const REPORT_REASONS = [
    t('report.reasons.hate'),
    t('report.reasons.sexual'),
    t('report.reasons.spam'),
    t('report.reasons.scam'),
    t('report.reasons.misinformation'),
    t('report.reasons.privacy'),
    t('report.reasons.illegal'),
    t('report.reasons.other'),
  ];
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setReason('');
    setDescription('');
    setImage(null);
    setImagePreview(null);
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      setError(t('report.selectReason'));
      return;
    }
    setLoading(true);
    setError('');

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setLoading(false);
      handleClose();
      onLoginRequired?.();
      return;
    }

    const reporterId = sessionData.session.user.id;
    const imageUrls: string[] = [];

    if (image) {
      const ext = image.name.split('.').pop();
      const filePath = `${reporterId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('report-attachments')
        .upload(filePath, image);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from('report-attachments')
          .getPublicUrl(filePath);
        imageUrls.push(urlData.publicUrl);
      }
    }

    const { error: insertError } = await supabase.from('report').insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason,
      description: description.trim() || null,
      image_url: imageUrls.length > 0 ? imageUrls : null,
    });

    if (insertError) {
      if (insertError.code === '23505') {
        setError(
          targetType === 'post'
            ? t('report.duplicatePost')
            : t('report.duplicateComment')
        );
      } else {
        setError(t('report.errorGeneric'));
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-5 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold">{t('report.title')}</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {success ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-lg font-semibold text-gray-800 mb-1">
                {t('report.successTitle')}
              </p>
              <p className="text-sm text-gray-500">{t('report.successDesc')}</p>
              <button
                className="mt-6 bg-[#9DB8A0] text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90"
                onClick={handleClose}
              >
                {t('common.close')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {t('report.reason')} *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0]"
                  required
                  disabled={loading}
                >
                  <option value="">{t('report.reasonPlaceholder')}</option>
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {t('report.description')}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('report.descriptionPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#9DB8A0] resize-none"
                  rows={3}
                  disabled={loading}
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-semibold mb-2">
                  {t('report.attachImage')}
                </label>
                {imagePreview ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={imagePreview}
                      alt="preview"
                      className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      className="text-sm text-gray-400 hover:text-red-400 transition"
                      onClick={() => {
                        setImage(null);
                        setImagePreview(null);
                      }}
                    >
                      {t('report.removeImage')}
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer w-fit bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600 transition">
                    <img src="/icons/camera.png" className="w-4 h-4 object-contain" />
                    {t('report.attachImage')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                      disabled={loading}
                    />
                  </label>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition"
                  onClick={handleClose}
                  disabled={loading}
                >
                  {t('report.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#9DB8A0] text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition"
                  disabled={loading || !reason}
                >
                  {loading ? t('report.submitting') : t('report.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
