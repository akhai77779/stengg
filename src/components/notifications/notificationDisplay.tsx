import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export type NotificationPreview = {
  type: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

export const getBaseNotificationStyles = (type: string) => {
  switch (type) {
    case "success":
      return "border-l-secondary bg-secondary/5";
    case "error":
      return "border-l-destructive bg-destructive/5";
    case "warning":
      return "border-l-accent bg-accent/5";
    case "admin_message":
    case "verification":
      return "border-l-primary bg-primary/5";
    case "transaction":
      return "border-l-secondary bg-secondary/5";
    case "option_trade":
      return "border-l-accent bg-accent/5";
    case "new_user":
      return "border-l-muted-foreground bg-muted/30";
    default:
      return "border-l-muted-foreground/50";
  }
};

export const getTradeResult = (notification: NotificationPreview) => {
  const result = notification.metadata?.result;
  const profitLoss = Number(notification.metadata?.profit_loss);

  if (!notification.metadata?.trade_id) return null;
  if (result === "won" || (!Number.isNaN(profitLoss) && profitLoss > 0)) return "positive";
  if (result === "lost" || (!Number.isNaN(profitLoss) && profitLoss < 0)) return "negative";

  return null;
};

export const getUserNotificationStyles = (notification: NotificationPreview) => {
  const tradeResult = getTradeResult(notification);

  if (tradeResult === "positive") return "border-l-secondary bg-secondary/5";
  if (tradeResult === "negative") return "border-l-destructive bg-destructive/5";

  return getBaseNotificationStyles(notification.type);
};

export const cleanTradeResultText = (text: string) => text
  .replace(/[🎉📉]/g, "")
  .replace(/\b(thắng|thua|won|lost|win|lose)\b/gi, "")
  .replace(/\s{2,}/g, " ")
  .trim();

export const getNotificationTitle = (notification: NotificationPreview) => {
  if (notification.metadata?.trade_id) return "Giao dịch quyền chọn";
  return cleanTradeResultText(notification.title || "");
};

export function TradeResultIcon({ notification }: { notification: NotificationPreview }) {
  const tradeResult = getTradeResult(notification);

  if (tradeResult === "positive") {
    return (
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        <ArrowUpCircle className="h-4 w-4 text-secondary" />
      </span>
    );
  }

  if (tradeResult === "negative") {
    return (
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
        <ArrowDownCircle className="h-4 w-4 text-destructive" />
      </span>
    );
  }

  return null;
}