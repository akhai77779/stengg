import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ChevronLeft, ChevronRight, Sun, Moon, Info, Globe } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import stEngineeringLogo from '@/assets/st-engineering-logo.png';

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

export default function Settings() {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { currency } = useCurrency();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const themeLabel = mounted 
    ? (theme === 'dark' ? t('settings.darkMode') : t('settings.lightMode'))
    : t('settings.darkMode');

  const handleThemeChange = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const currentLanguage = languages.find((l) => l.code === language);

  const handleLanguageSelect = (code: Language) => {
    setLanguage(code);
    setLanguageSheetOpen(false);
  };

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 rounded-full hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center mb-4 active:bg-muted/70 touch-action-manipulation"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {t('settings.generalSettings')}
            </h1>
          </div>

          {/* Settings List */}
          <div className="space-y-0">
            {/* Language Settings */}
            <Sheet open={languageSheetOpen} onOpenChange={setLanguageSheetOpen}>
              <SheetTrigger asChild>
                <button className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]">
                  <span className="text-sm md:text-base text-foreground">
                    {t('settings.language')}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{currentLanguage?.flag}</span>
                    <span className="text-sm text-muted-foreground">
                      {currentLanguage?.name}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    {t('settings.language')}
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4 space-y-1 overflow-y-auto">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageSelect(lang.code)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        language === lang.code 
                          ? 'bg-primary/10 text-primary' 
                          : 'hover:bg-muted/50 active:bg-muted/70'
                      }`}
                    >
                      <span className="text-xl">{lang.flag}</span>
                      <span className="text-sm md:text-base font-medium">{lang.name}</span>
                      {language === lang.code && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Theme Mode */}
            <button
              onClick={handleThemeChange}
              className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]"
            >
              <span className="text-sm md:text-base text-foreground">
                {t('settings.themeMode')}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {themeLabel}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>

            {/* About Us */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]">
                  <span className="text-sm md:text-base text-foreground">
                    {t('settings.currencySettings')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-500" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh]">
                <SheetHeader>
                  <SheetTitle>{t('settings.currencySettings')}</SheetTitle>
                </SheetHeader>
                <div className="py-4 overflow-y-auto space-y-4">
                  <div className="flex justify-center mb-2">
                    <img src={stEngineeringLogo} alt="ST Engineering Logo" className="h-10 object-contain" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Tại ST Engineering, chúng tôi ứng dụng công nghệ và sự đổi mới để giải quyết các vấn đề thực tế và cải thiện cuộc sống. Sự tận tâm hướng đến sự xuất sắc và thành tích vững chắc đã mang lại cho chúng tôi danh tiếng đặc biệt về chất lượng và sự tin cậy với tư cách là một tập đoàn công nghệ, quốc phòng và kỹ thuật toàn cầu.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Danh mục kinh doanh đa dạng của chúng tôi trải rộng trên các lĩnh vực hàng không vũ trụ, thành phố thông minh, giải pháp kỹ thuật số, quốc phòng và an ninh công cộng, và mạng lưới toàn cầu gồm các công ty con và công ty liên kết của chúng tôi trải rộng khắp châu Á, châu Âu, Trung Đông và Hoa Kỳ.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Chúng tôi thành công nhờ khả năng đáp ứng nhu cầu của các đối tác và khách hàng. Trên toàn Tập đoàn, chúng tôi có hơn 27.000 nhân viên với nền tảng và kỹ năng đa dạng, bao gồm hơn 19.000 kỹ sư và chuyên gia công nghệ tận tâm giải quyết các vấn đề thực tế cho khách hàng. Cùng nhau, chúng tôi chuyển đổi và bảo vệ tương lai các thành phố, giúp chúng trở nên năng động hơn, an toàn hơn và đáng sống hơn cho cộng đồng. Với chuyên môn và cơ sở vật chất trên toàn thế giới, chúng tôi đảm bảo máy bay bay an toàn và tàu thuyền hoạt động hiệu quả.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Chúng tôi giúp các quốc gia bảo vệ công dân của họ bằng cách đáp ứng nhu cầu quốc phòng trên không, trên bộ và trên biển, đồng thời trang bị cho lực lượng chiến đấu của họ để hoạt động hiệu quả trên chiến trường. An ninh mạng và các hệ thống quan trọng của chúng tôi giúp khách hàng tăng cường an ninh công cộng và an ninh quốc gia trong một thế giới ngày càng số hóa. Và thiết bị truyền thông vệ tinh của chúng tôi đóng góp vào phần lớn khả năng kết nối mạng lưới toàn cầu.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Chúng tôi đón nhận mọi thách thức bằng những giải pháp hiệu quả và cạnh tranh, giúp khách hàng tại hơn 100 quốc gia được chuẩn bị tốt hơn, bảo vệ tốt hơn và kết nối tốt hơn cho một tương lai bền vững. Sức mạnh đằng sau tất cả điều này là đội ngũ nhân viên toàn cầu của chúng tôi, được truyền cảm hứng bởi một cam kết và mục tiêu chung. Chúng tôi là một đội ngũ hiểu rõ những gì cần thiết và cam kết thách thức, thay đổi và bảo vệ tương lai.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Tại Mỹ, các hoạt động chính của chúng tôi trải rộng trên hơn 50 thành phố thuộc 21 tiểu bang, với khoảng 6.000 nhân viên cung cấp các sản phẩm và giải pháp sáng tạo cho khách hàng thương mại và chính phủ trên nhiều phân khúc thị trường khác nhau.
                  </p>
                  <p className="text-sm text-primary font-medium leading-relaxed">
                    Hãy cùng tìm hiểu về lịch sử phong phú và hành trình huy hoàng đưa chúng tôi đến vị trí hiện tại.
                  </p>
                  <Button 
                    onClick={() => navigate('/about')} 
                    className="w-full mt-2"
                  >
                    {t('about.learnMore') || 'Tìm hiểu thêm'}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Contact Info */}
            <button 
              onClick={() => navigate('/about')}
              className="w-full flex items-center justify-between py-4 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40 touch-action-manipulation min-h-[52px]"
            >
              <span className="text-sm md:text-base text-foreground">
                {t('settings.about')}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
