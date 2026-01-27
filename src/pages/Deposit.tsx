import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layout } from "@/components/layout/Layout";

const CSKH_URL = "https://direct.lc.chat/19460523/";

const Deposit = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleContactSupport = () => {
    window.open(CSKH_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-foreground hover:bg-muted min-h-[44px] min-w-[44px]"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg md:text-xl font-bold text-foreground">Nạp tiền</h1>
          </div>

          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="bg-card border-border w-full">
              <CardContent className="pt-6 md:pt-8 pb-6 md:pb-8 px-4 md:px-6 text-center space-y-4 md:space-y-6">
                {/* Icon */}
                <div className="mx-auto w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Headphones className="h-8 w-8 md:h-10 md:w-10 text-primary" />
                </div>

                {/* Message */}
                <div className="space-y-2 md:space-y-3">
                  <h2 className="text-base md:text-xl font-semibold text-foreground">
                    Liên hệ hỗ trợ để nạp tiền
                  </h2>
                  <p className="text-muted-foreground text-xs md:text-sm leading-relaxed">
                    Để thực hiện nạp tiền vào tài khoản, vui lòng liên hệ với đội ngũ 
                    Chăm sóc khách hàng (CSKH) của chúng tôi. Nhân viên hỗ trợ sẽ 
                    hướng dẫn bạn các bước nạp tiền an toàn và nhanh chóng.
                  </p>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={handleContactSupport}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2 min-h-[48px] text-sm md:text-base"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5" />
                  Liên hệ CSKH ngay
                </Button>

                {/* Additional info */}
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Đội ngũ CSKH hoạt động 24/7, sẵn sàng hỗ trợ bạn
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Deposit;
