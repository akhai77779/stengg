 import { useState, useRef, useEffect } from "react";
 import { Send, Paperclip, Hash, Smile, X, FileText, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

 import { useQuickReplyTemplates } from "@/hooks/useQuickReplyTemplates";
 import { QuickReplyManager } from "./QuickReplyManager";

// Common emojis
const EMOJI_LIST = [
  "😊", "👍", "❤️", "🎉", "👋",
  "😄", "🙏", "✅", "⭐", "💯",
  "😀", "🤝", "💪", "🔥", "✨",
  "😃", "🥳", "💖", "🌟", "👏",
];

interface ChatInputWithExtrasProps {
  onSend: (message: string, attachment?: { url: string; type: "image" | "file"; name: string }) => void;
  onTyping?: () => void;
  onUpload?: (file: File) => Promise<{ url: string; type: "image" | "file"; name: string }>;
  disabled?: boolean;
  placeholder?: string;
   isAdmin?: boolean;
}

export function ChatInputWithExtras({
  onSend,
  onTyping,
  onUpload,
  disabled,
  placeholder = "Nhập tin nhắn...",
   isAdmin = false,
}: ChatInputWithExtrasProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showHashtag, setShowHashtag] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
   const [showManager, setShowManager] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
   const { templates, loading: templatesLoading } = useQuickReplyTemplates();
 
   // Filter only active templates
   const activeTemplates = templates.filter(t => t.is_active);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File quá lớn. Tối đa 10MB.");
        return;
      }
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() && !selectedFile) return;

    try {
      let attachment: { url: string; type: "image" | "file"; name: string } | undefined;
      if (selectedFile && onUpload) {
        setUploading(true);
        attachment = await onUpload(selectedFile);
      }
      onSend(message.trim(), attachment);
      setMessage("");
      handleClearFile();
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    onTyping?.();
  };

  const handleQuickReply = (text: string) => {
    setMessage(text);
    setShowHashtag(false);
    inputRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      {/* File preview */}
      {selectedFile && (
        <div className="p-2 bg-muted rounded-lg flex items-center gap-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-12 w-12 object-cover rounded"
            />
          ) : (
            <div className="h-12 w-12 bg-background rounded flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{selectedFile.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClearFile}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Hashtag / Quick Replies */}
        <Popover open={showHashtag} onOpenChange={setShowHashtag}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", showHashtag && "bg-primary/10 text-primary")}
              disabled={disabled || uploading}
            >
              <Hash className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
              Trả lời nhanh
            </p>
            <ScrollArea className="h-48">
              <div className="space-y-1">
                 {templatesLoading ? (
                   <p className="text-xs text-muted-foreground px-2">Đang tải...</p>
                 ) : activeTemplates.length === 0 ? (
                   <p className="text-xs text-muted-foreground px-2">Chưa có mẫu trả lời</p>
                 ) : activeTemplates.map((reply) => (
                   <button
                     key={reply.id}
                    type="button"
                    className="w-full text-left p-2 text-xs rounded-md hover:bg-muted transition-colors"
                    onClick={() => handleQuickReply(reply.text)}
                  >
                    <span className="text-primary font-medium">#{reply.tag}</span>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2">
                      {reply.text}
                    </p>
                  </button>
                ))}
              </div>
               {isAdmin && (
                 <div className="mt-2 pt-2 border-t">
                   <button
                     type="button"
                     className="w-full text-left p-2 text-xs rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-primary"
                     onClick={() => {
                       setShowHashtag(false);
                       setShowManager(true);
                     }}
                   >
                     <Settings className="h-3 w-3" />
                     Quản lý mẫu trả lời
                   </button>
                 </div>
               )}
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Attachment */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Emoji */}
        <Popover open={showEmoji} onOpenChange={setShowEmoji}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8", showEmoji && "bg-primary/10 text-primary")}
              disabled={disabled || uploading}
            >
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
              Chọn emoji
            </p>
            <div className="grid grid-cols-5 gap-1">
              {EMOJI_LIST.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  className="h-8 w-8 flex items-center justify-center text-lg rounded hover:bg-muted transition-colors"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Message Input */}
        <Input
          ref={inputRef}
          value={message}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || uploading}
          className="flex-1 h-8 text-sm"
        />

        {/* Send Button */}
        <Button
          type="submit"
          size="sm"
          className="h-8 px-3"
          disabled={disabled || uploading || (!message.trim() && !selectedFile)}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-1" />
              <span className="text-xs">Gửi</span>
            </>
          )}
        </Button>
      </form>
       
       {/* Quick Reply Manager Dialog */}
       {isAdmin && (
         <QuickReplyManager open={showManager} onOpenChange={setShowManager} />
       )}
    </div>
  );
}
