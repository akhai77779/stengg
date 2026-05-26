import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle } from "lucide-react";

export interface PreChatPayload {
  name: string;
  email?: string;
  topic: string;
}

const TOPICS = [
  { value: "deposit_withdraw", label: "Nạp / Rút tiền" },
  { value: "account", label: "Tài khoản" },
  { value: "trading", label: "Giao dịch" },
  { value: "other", label: "Khác" },
];

interface Props {
  onStart: (data: PreChatPayload) => void;
  isLoading?: boolean;
}

export function PreChatForm({ onStart, isLoading }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("other");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const trimmedEmail = email.trim();
    onStart({
      name: trimmed,
      email: trimmedEmail || undefined,
      topic,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-1 flex flex-col justify-center p-5 space-y-4 bg-background"
    >
      <div className="flex flex-col items-center text-center gap-2 mb-2">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold text-base">Chào bạn 👋</h3>
        <p className="text-xs text-muted-foreground">
          Vui lòng để lại vài thông tin để chúng tôi hỗ trợ bạn tốt nhất.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prechat-name" className="text-xs">
          Tên của bạn *
        </Label>
        <Input
          id="prechat-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Nguyễn Văn A"
          required
          maxLength={80}
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prechat-email" className="text-xs">
          Email <span className="text-muted-foreground">(tuỳ chọn)</span>
        </Label>
        <Input
          id="prechat-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@example.com"
          maxLength={200}
        />
        <p className="text-[10px] text-muted-foreground">
          Để chúng tôi liên hệ lại nếu bạn rời đi trước khi nhận phản hồi.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Chủ đề cần hỗ trợ</Label>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOPICS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
        {isLoading ? "Đang khởi tạo..." : "Bắt đầu trò chuyện"}
      </Button>
    </form>
  );
}

export const TOPIC_LABELS: Record<string, string> = TOPICS.reduce(
  (acc, t) => ({ ...acc, [t.value]: t.label }),
  {},
);