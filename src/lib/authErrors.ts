import type { Language } from '@/contexts/LanguageContext';

export type LoginMethod = 'email' | 'phone';

type ErrorMap = Record<string, Record<string, string>>;

const AUTH_ERROR_MAP: ErrorMap = {
  'Password is known to be weak and easy to guess, please choose a different one.': {
    vi: 'Mật khẩu quá yếu và dễ đoán, vui lòng chọn mật khẩu khác.',
    en: 'Password is too weak and easy to guess, please choose a different one.',
  },
  'Password should be at least 6 characters.': {
    vi: 'Mật khẩu phải có ít nhất 6 ký tự.',
    en: 'Password must be at least 6 characters.',
  },
  'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789.': {
    vi: 'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số.',
    en: 'Password must contain at least one letter and one number.',
  },
  'User already registered': {
    vi: 'Email này đã được đăng ký.',
    en: 'This email is already registered.',
    vi_phone: 'Số điện thoại này đã được đăng ký.',
    en_phone: 'This phone number is already registered.',
  },
  'A user with this email address has already been registered': {
    vi: 'Email này đã được đăng ký.',
    en: 'This email is already registered.',
    vi_phone: 'Số điện thoại này đã được đăng ký.',
    en_phone: 'This phone number is already registered.',
  },
  'Phone number already registered': {
    vi: 'Số điện thoại này đã được đăng ký.',
    en: 'This phone number is already registered.',
  },
  'Unable to validate email address: invalid format': {
    vi: 'Địa chỉ email không hợp lệ.',
    en: 'Invalid email address format.',
  },
  'Signup requires a valid password': {
    vi: 'Đăng ký yêu cầu mật khẩu hợp lệ.',
    en: 'Signup requires a valid password.',
  },
  'Invalid login credentials': {
    vi: 'Email hoặc mật khẩu không đúng.',
    en: 'Invalid email or password.',
    vi_phone: 'SĐT hoặc mật khẩu không đúng.',
    en_phone: 'Invalid phone number or password.',
  },
  'Email not confirmed': {
    vi: 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư.',
    en: 'Email not verified. Please check your inbox.',
  },
  'Invalid Refresh Token: Refresh Token Not Found': {
    vi: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    en: 'Session expired. Please log in again.',
  },
  'Database error granting user': {
    vi: 'Hệ thống đăng nhập vừa khởi động lại sau khi nâng cấp. Vui lòng bấm đăng nhập lại sau vài giây.',
    en: 'The login system has just restarted after the upgrade. Please try logging in again in a few seconds.',
  },
  'unexpected_failure': {
    vi: 'Hệ thống đăng nhập đang ổn định lại. Vui lòng thử lại sau vài giây.',
    en: 'The login system is stabilizing. Please try again in a few seconds.',
  },
  'For security purposes, you can only request this after': {
    vi: 'Vì lý do bảo mật, bạn chỉ có thể thực hiện sau một khoảng thời gian.',
    en: 'For security purposes, please try again after a moment.',
  },
  'Email rate limit exceeded': {
    vi: 'Đã gửi quá nhiều email. Vui lòng thử lại sau.',
    en: 'Too many emails sent. Please try again later.',
  },
  'Token has expired or is invalid': {
    vi: 'Mã xác thực đã hết hạn hoặc không hợp lệ.',
    en: 'Verification code has expired or is invalid.',
  },
  'Otp has expired or is invalid': {
    vi: 'Mã OTP đã hết hạn hoặc không hợp lệ.',
    en: 'OTP code has expired or is invalid.',
  },
  'Hệ thống SMS đang quá tải. Vui lòng thử lại sau.': {
    vi: 'Hệ thống SMS đang quá tải. Vui lòng thử lại sau.',
    en: 'SMS system is overloaded. Please try again later.',
  },
  'Số điện thoại chưa được xác minh trong hệ thống.': {
    vi: 'Số điện thoại chưa được xác minh trong hệ thống.',
    en: 'Phone number is not verified in the system.',
  },
};

function resolve(translations: Record<string, string>, lang: string, method?: LoginMethod): string {
  // If phone method, try phone-specific translation first
  if (method === 'phone') {
    const phoneKey = `${lang}_phone`;
    if (translations[phoneKey]) {
      return translations[phoneKey];
    }
  }
  return translations[lang] || translations['en'] || translations['vi'] || '';
}

export function translateAuthError(message: string, lang: Language = 'vi', method?: LoginMethod): string {
  const effectiveLang = (lang === 'vi' || lang === 'en') ? lang : 'en';

  // Exact match
  if (AUTH_ERROR_MAP[message]) {
    return resolve(AUTH_ERROR_MAP[message], effectiveLang, method);
  }

  // Partial match
  for (const [key, translations] of Object.entries(AUTH_ERROR_MAP)) {
    if (message.includes(key) || message.toLowerCase().includes(key.toLowerCase())) {
      return resolve(translations, effectiveLang, method);
    }
  }

  // Rate limit with dynamic seconds
  if (message.includes('For security purposes, you can only request this after')) {
    const seconds = message.match(/after (\d+) seconds/);
    if (seconds) {
      return effectiveLang === 'vi'
        ? `Vì lý do bảo mật, vui lòng thử lại sau ${seconds[1]} giây.`
        : `For security purposes, please try again after ${seconds[1]} seconds.`;
    }
    return resolve(AUTH_ERROR_MAP['For security purposes, you can only request this after'], effectiveLang, method);
  }

  return message;
}
