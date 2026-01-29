import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveChat } from '@/contexts/LiveChatContext';
import { ChevronLeft, Mail, Phone, Globe, MessageCircle, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import stEngineeringLogo from '@/assets/st-engineering-logo.png';

export default function About() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { openChat } = useLiveChat();
  
  const supportEmail = 'stengg.com@stengg.it.com';
  const supportPhone = '+65 6722 1234';
  const website = 'https://stengg.it.com';
  return <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 max-w-lg">
          {/* Header */}
          <div className="mb-6">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-muted/50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center mb-4 active:bg-muted/70 touch-action-manipulation">
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {t('settings.about')}
            </h1>
          </div>

          {/* App Info */}
          <Card className="bg-card border-border mb-4">
            <CardContent className="p-4">
              <div className="text-center mb-4">
                <img src={stEngineeringLogo} alt="ST Engineering Logo" className="h-10 mx-auto mb-4 object-contain" />
                <p className="text-sm text-muted-foreground">
                  {t('about.portalDescription')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <h3 className="text-sm font-medium text-foreground px-4 py-3 border-b border-border/30 text-center">
                {t('about.contactSupport')}
              </h3>
              
              {/* Address */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{t('about.address')}</span>
                </div>
                <span className="text-sm text-muted-foreground">ST Engineering Hub, Singapore</span>
              </div>

              {/* Email */}
              <a href={`mailto:${supportEmail}`} className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">Email</span>
                </div>
                <span className="text-sm text-muted-foreground">{supportEmail}</span>
              </a>

              {/* Phone */}
              <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{t('about.phone')}</span>
                </div>
                <span className="text-sm text-muted-foreground">{supportPhone}</span>
              </a>

              {/* Website */}
              <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-3 border-b border-border/30 hover:bg-muted/20 transition-colors active:bg-muted/40">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">Website</span>
                </div>
                <span className="text-sm text-muted-foreground">{website.replace('https://', '')}</span>
              </a>

              {/* Live Chat */}
              <button 
                onClick={openChat}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors active:bg-muted/40 w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground">{t('about.liveChat')}</span>
                </div>
                <span className="text-sm text-primary font-medium">{t('about.chatNow')}</span>
              </button>
            </CardContent>
          </Card>

          {/* Copyright */}
          <p className="text-xs text-muted-foreground text-center mt-6">
            © 2026 ST Engineering. {t('about.allRightsReserved')}
          </p>
        </div>
      </div>
    </Layout>;
}