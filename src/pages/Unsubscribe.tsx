import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MailX, CheckCircle, AlertTriangle } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    validateToken(token);
  }, [token]);

  const validateToken = async (t: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(t)}`,
        { headers: { apikey: anonKey } }
      );
      const data = await res.json();
      if (!res.ok) {
        setStatus('invalid');
      } else if (data.valid === false && data.reason === 'already_unsubscribed') {
        setStatus('already');
      } else if (data.valid) {
        setStatus('valid');
      } else {
        setStatus('invalid');
      }
    } catch {
      setStatus('invalid');
    }
  };

  const handleUnsubscribe = async () => {
    if (!token) return;
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus('success');
      } else if (data?.reason === 'already_unsubscribed') {
        setStatus('already');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f1d] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0f1426] rounded-2xl border border-gray-800 p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-[#00b8d4] animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Đang xác thực...</p>
          </>
        )}

        {status === 'valid' && (
          <>
            <MailX className="h-12 w-12 text-[#00b8d4] mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Hủy đăng ký nhận email</h1>
            <p className="text-gray-400 text-sm mb-6">
              Bạn có chắc chắn muốn hủy nhận email thông báo từ ST Engineering?
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={isProcessing}
              className="w-full bg-red-500 text-white py-3 rounded-lg text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                'Xác nhận hủy đăng ký'
              )}
            </button>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Đã hủy thành công</h1>
            <p className="text-gray-400 text-sm">
              Bạn sẽ không nhận email thông báo từ ST Engineering nữa.
            </p>
          </>
        )}

        {status === 'already' && (
          <>
            <CheckCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Đã hủy trước đó</h1>
            <p className="text-gray-400 text-sm">
              Email của bạn đã được hủy đăng ký nhận thông báo.
            </p>
          </>
        )}

        {status === 'invalid' && (
          <>
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Liên kết không hợp lệ</h1>
            <p className="text-gray-400 text-sm">
              Liên kết hủy đăng ký không hợp lệ hoặc đã hết hạn.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Có lỗi xảy ra</h1>
            <p className="text-gray-400 text-sm">
              Không thể xử lý yêu cầu. Vui lòng thử lại sau.
            </p>
          </>
        )}
      </div>
    </div>
  );
}