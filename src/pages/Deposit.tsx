import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Wallet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";

const Maintenance = () => {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[radial-gradient(1100px_720px_at_18%_8%,rgba(59,130,246,0.08),transparent_60%),radial-gradient(900px_680px_at_82%_18%,rgba(148,163,184,0.05),transparent_55%),#0b1424]">
      <div className="max-w-[560px] w-full bg-[rgba(13,24,33,0.6)] border border-[rgba(148,163,184,0.18)] rounded-[20px] p-8 text-center shadow-[0_24px_60px_rgba(3,7,18,0.65)] backdrop-blur-md">
        {/* Badge */}
        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-[rgba(245,158,11,0.12)] text-[#fde68a] border border-[rgba(251,191,36,0.3)] text-xs font-semibold tracking-wide">
          BẢO TRÌ
        </span>

        {/* Icon */}
        <div className="w-16 h-16 mx-auto mt-5 mb-4 rounded-[18px] bg-[rgba(245,158,11,0.12)] border border-[rgba(251,191,36,0.3)] flex items-center justify-center text-3xl">
          🛠️
        </div>

        {/* Title */}
        <h1 className="text-[26px] font-bold text-[#f8fafc] mb-3">Hệ thống đang bảo trì</h1>

        {/* Description */}
        <p className="text-[#cbd5f1] leading-relaxed text-[15px]">
          Chúng tôi đang nâng cấp để phục vụ tốt hơn. Vui lòng quay lại sau.
        </p>

        {/* Note with pulsing dot */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[#94a3b8] text-[13px]">
          <span className="w-2 h-2 rounded-full bg-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.7)] animate-pulse" />
          Cảm ơn bạn đã kiên nhẫn.
        </div>
      </div>
    </div>
  );
};

export default Maintenance;

export default Deposit;
