// Translate common Supabase Auth error messages to Vietnamese
const AUTH_ERROR_MAP: Record<string, string> = {
  // Password errors
  'Password is known to be weak and easy to guess, please choose a different one.':
    'Mật khẩu quá yếu và dễ đoán, vui lòng chọn mật khẩu khác.',
  'Password should be at least 6 characters.':
    'Mật khẩu phải có ít nhất 6 ký tự.',
  'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, 0123456789.':
    'Mật khẩu phải chứa ít nhất một chữ cái và một chữ số.',

  // Email/user errors
  'User already registered':
    'Email này đã được đăng ký.',
  'A user with this email address has already been registered':
    'Email này đã được đăng ký.',
  'Unable to validate email address: invalid format':
    'Địa chỉ email không hợp lệ.',
  'Signup requires a valid password':
    'Đăng ký yêu cầu mật khẩu hợp lệ.',

  // Login errors
  'Invalid login credentials':
    'Email hoặc mật khẩu không đúng.',
  'Email not confirmed':
    'Email chưa được xác thực. Vui lòng kiểm tra hộp thư.',
  'Invalid Refresh Token: Refresh Token Not Found':
    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',

  // Rate limit
  'For security purposes, you can only request this after':
    'Vì lý do bảo mật, bạn chỉ có thể thực hiện sau một khoảng thời gian.',
  'Email rate limit exceeded':
    'Đã gửi quá nhiều email. Vui lòng thử lại sau.',

  // OTP
  'Token has expired or is invalid':
    'Mã xác thực đã hết hạn hoặc không hợp lệ.',
  'Otp has expired or is invalid':
    'Mã OTP đã hết hạn hoặc không hợp lệ.',
};

export function translateAuthError(message: string): string {
  // Exact match first
  if (AUTH_ERROR_MAP[message]) {
    return AUTH_ERROR_MAP[message];
  }

  // Partial match for messages that include dynamic parts
  for (const [key, value] of Object.entries(AUTH_ERROR_MAP)) {
    if (message.includes(key) || message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Check for rate limit pattern with dynamic seconds
  if (message.includes('For security purposes, you can only request this after')) {
    const seconds = message.match(/after (\d+) seconds/);
    if (seconds) {
      return `Vì lý do bảo mật, vui lòng thử lại sau ${seconds[1]} giây.`;
    }
    return 'Vì lý do bảo mật, vui lòng thử lại sau.';
  }

  return message;
}
