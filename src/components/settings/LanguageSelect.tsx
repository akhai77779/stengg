import { useLanguage, Language } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ms', name: 'Bahasa Melayu', flag: '🇲🇾' },
];

interface LanguageSelectProps {
  variant?: 'default' | 'compact' | 'full';
  className?: string;
}

export function LanguageSelect({ variant = 'default', className }: LanguageSelectProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as Language)}
      className={cn(
        "bg-background/40 border border-border text-foreground/90 rounded focus:outline-none focus:ring-1 focus:ring-primary/50",
        variant === 'compact' && "text-[11px] px-2 py-0.5",
        variant === 'default' && "text-xs px-2 py-1",
        variant === 'full' && "w-full text-sm px-3 py-2 rounded-md",
        className
      )}
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code} className="bg-background">
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
