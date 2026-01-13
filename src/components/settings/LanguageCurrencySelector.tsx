import { Globe, DollarSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useCurrency, Currency } from '@/contexts/CurrencyContext';

const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const currencies: { code: Currency; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'VND', name: 'Việt Nam Đồng', symbol: '₫' },
];

export function LanguageCurrencySelector() {
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency, exchangeRates } = useCurrency();

  const currentLanguage = languages.find((l) => l.code === language);
  const currentCurrency = currencies.find((c) => c.code === currency);

  return (
    <div className="flex items-center gap-1">
      {/* Language Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <span className="text-base">{currentLanguage?.flag}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('settings.language')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={language === lang.code ? 'bg-primary/10' : ''}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Currency Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs font-medium">
            {currentCurrency?.code}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            {t('settings.currency')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {currencies.map((curr) => (
            <DropdownMenuItem
              key={curr.code}
              onClick={() => setCurrency(curr.code)}
              className={currency === curr.code ? 'bg-primary/10' : ''}
            >
              <span className="mr-2 font-bold">{curr.symbol}</span>
              {curr.name}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('settings.exchangeRate')}: 1 USD = {exchangeRates.usd_to_vnd.toLocaleString()} VND
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
