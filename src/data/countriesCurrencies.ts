export interface CountryCurrency {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencyName: string;
  flag: string;
}

// Danh sách quốc gia & loại tiền tệ phổ biến trên thế giới
export const COUNTRIES_CURRENCIES: CountryCurrency[] = [
  { countryCode: "SG", countryName: "Singapore", currencyCode: "SGD", currencyName: "Singapore Dollar", flag: "🇸🇬" },
  { countryCode: "VN", countryName: "Việt Nam", currencyCode: "VND", currencyName: "Vietnamese Dong", flag: "🇻🇳" },
  { countryCode: "US", countryName: "United States", currencyCode: "USD", currencyName: "US Dollar", flag: "🇺🇸" },
  { countryCode: "GB", countryName: "United Kingdom", currencyCode: "GBP", currencyName: "British Pound", flag: "🇬🇧" },
  { countryCode: "EU", countryName: "European Union", currencyCode: "EUR", currencyName: "Euro", flag: "🇪🇺" },
  { countryCode: "JP", countryName: "Japan", currencyCode: "JPY", currencyName: "Japanese Yen", flag: "🇯🇵" },
  { countryCode: "CN", countryName: "China", currencyCode: "CNY", currencyName: "Chinese Yuan", flag: "🇨🇳" },
  { countryCode: "KR", countryName: "South Korea", currencyCode: "KRW", currencyName: "South Korean Won", flag: "🇰🇷" },
  { countryCode: "TH", countryName: "Thailand", currencyCode: "THB", currencyName: "Thai Baht", flag: "🇹🇭" },
  { countryCode: "MY", countryName: "Malaysia", currencyCode: "MYR", currencyName: "Malaysian Ringgit", flag: "🇲🇾" },
  { countryCode: "ID", countryName: "Indonesia", currencyCode: "IDR", currencyName: "Indonesian Rupiah", flag: "🇮🇩" },
  { countryCode: "PH", countryName: "Philippines", currencyCode: "PHP", currencyName: "Philippine Peso", flag: "🇵🇭" },
  { countryCode: "IN", countryName: "India", currencyCode: "INR", currencyName: "Indian Rupee", flag: "🇮🇳" },
  { countryCode: "AU", countryName: "Australia", currencyCode: "AUD", currencyName: "Australian Dollar", flag: "🇦🇺" },
  { countryCode: "CA", countryName: "Canada", currencyCode: "CAD", currencyName: "Canadian Dollar", flag: "🇨🇦" },
  { countryCode: "CH", countryName: "Switzerland", currencyCode: "CHF", currencyName: "Swiss Franc", flag: "🇨🇭" },
  { countryCode: "HK", countryName: "Hong Kong", currencyCode: "HKD", currencyName: "Hong Kong Dollar", flag: "🇭🇰" },
  { countryCode: "TW", countryName: "Taiwan", currencyCode: "TWD", currencyName: "Taiwan Dollar", flag: "🇹🇼" },
  { countryCode: "NZ", countryName: "New Zealand", currencyCode: "NZD", currencyName: "New Zealand Dollar", flag: "🇳🇿" },
  { countryCode: "AE", countryName: "United Arab Emirates", currencyCode: "AED", currencyName: "UAE Dirham", flag: "🇦🇪" },
  { countryCode: "SA", countryName: "Saudi Arabia", currencyCode: "SAR", currencyName: "Saudi Riyal", flag: "🇸🇦" },
  { countryCode: "TR", countryName: "Turkey", currencyCode: "TRY", currencyName: "Turkish Lira", flag: "🇹🇷" },
  { countryCode: "RU", countryName: "Russia", currencyCode: "RUB", currencyName: "Russian Ruble", flag: "🇷🇺" },
  { countryCode: "BR", countryName: "Brazil", currencyCode: "BRL", currencyName: "Brazilian Real", flag: "🇧🇷" },
  { countryCode: "MX", countryName: "Mexico", currencyCode: "MXN", currencyName: "Mexican Peso", flag: "🇲🇽" },
  { countryCode: "ZA", countryName: "South Africa", currencyCode: "ZAR", currencyName: "South African Rand", flag: "🇿🇦" },
  { countryCode: "SE", countryName: "Sweden", currencyCode: "SEK", currencyName: "Swedish Krona", flag: "🇸🇪" },
  { countryCode: "NO", countryName: "Norway", currencyCode: "NOK", currencyName: "Norwegian Krone", flag: "🇳🇴" },
  { countryCode: "DK", countryName: "Denmark", currencyCode: "DKK", currencyName: "Danish Krone", flag: "🇩🇰" },
  { countryCode: "PL", countryName: "Poland", currencyCode: "PLN", currencyName: "Polish Zloty", flag: "🇵🇱" },
];