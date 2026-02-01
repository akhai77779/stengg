import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, FileText, Download, MoreVertical, Pencil, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { LiveChatMessage } from "@/hooks/useLiveChatMessages";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface MessageListProps {
  messages: LiveChatMessage[];
  currentUserId: string;
  typingText?: string | null;
  isLoading?: boolean;
  onEditMessage?: (messageId: string, newMessage: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  canModifyMessages?: boolean;
}

export function MessageList({
  messages,
  currentUserId,
  typingText,
  isLoading,
  onEditMessage,
  onDeleteMessage,
  canModifyMessages = false,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingText]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingMessageId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingMessageId]);

  const handleStartEdit = (message: LiveChatMessage) => {
    setEditingMessageId(message.id);
    setEditingText(message.message);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText("");
  };

  const handleSaveEdit = () => {
    if (editingMessageId && editingText.trim() && onEditMessage) {
      onEditMessage(editingMessageId, editingText.trim());
      setEditingMessageId(null);
      setEditingText("");
    }
  };

  const handleDeleteClick = (messageId: string) => {
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (messageToDelete && onDeleteMessage) {
      onDeleteMessage(messageToDelete);
    }
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <p>Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isOwn = message.sender_id === currentUserId || 
              (message.sender_type === "customer" && message.sender_id === currentUserId);
            const isSupport = message.sender_type === "support";
            const isBot = message.sender_type === "bot";
            const isEditing = editingMessageId === message.id;
            
            // Admin can modify all messages, users can only modify their own
            const canModify = canModifyMessages;
            const canEdit = canModifyMessages && (isOwn || isSupport); // Only edit support messages

            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 group",
                  isOwn ? "justify-end" : "justify-start"
                )}
              >
                {!isOwn && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback
                      className={cn(
                        isBot
                          ? "bg-purple-500 text-white"
                          : isSupport
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {isBot ? "AI" : message.sender_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}

                <div className="flex items-start gap-1 max-w-[75%]">
                  {/* Action menu - show on left for own messages */}
                  {isOwn && canModify && !isEditing && !isBot && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Sửa
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(message.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  <div
                    className={cn(
                      "rounded-lg px-4 py-2",
                      isOwn
                        ? "bg-primary text-primary-foreground"
                        : isBot
                        ? "bg-purple-100 dark:bg-purple-900/30"
                        : "bg-muted"
                    )}
                  >
                    {!isOwn && (
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {message.sender_name}
                        {isBot && " 🤖"}
                      </p>
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          ref={editInputRef}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className="h-7 text-sm bg-background text-foreground"
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={handleSaveEdit}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        {message.message && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.message}
                          </p>
                        )}
                      </>
                    )}

                    {/* Attachment */}
                    {message.attachment_url && (
                      <div className="mt-2">
                        {message.attachment_type === "image" ? (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={message.attachment_url}
                              alt={message.attachment_name || "Image"}
                              className="max-w-full rounded-lg max-h-48 object-cover"
                            />
                          </a>
                        ) : (
                          <a
                            href={message.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-background/50 rounded-lg hover:bg-background/80 transition-colors"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="text-sm truncate">
                              {message.attachment_name || "File"}
                            </span>
                            <Download className="h-4 w-4 ml-auto" />
                          </a>
                        )}
                      </div>
                    )}

                    <p className="text-[10px] opacity-50 mt-1 text-right">
                      {format(new Date(message.created_at), "HH:mm", { locale: vi })}
                      {message.is_read && isOwn && " ✓✓"}
                    </p>
                  </div>

                  {/* Action menu - show on right for other's messages (admin view) */}
                  {!isOwn && canModify && !isEditing && !isBot && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-32">
                        {canEdit && (
                          <DropdownMenuItem onClick={() => handleStartEdit(message)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Sửa
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(message.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {isOwn && (
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {message.sender_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingText && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-muted">...</AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground italic">
                    {typingText}
                  </span>
                  <span className="flex gap-1">
                    <span className="animate-bounce delay-0 h-1.5 w-1.5 bg-muted-foreground rounded-full" />
                    <span className="animate-bounce delay-150 h-1.5 w-1.5 bg-muted-foreground rounded-full" />
                    <span className="animate-bounce delay-300 h-1.5 w-1.5 bg-muted-foreground rounded-full" />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa tin nhắn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa tin nhắn này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MessageInputProps {
  onSend: (message: string, attachment?: { url: string; type: "image" | "file"; name: string }) => void;
  onTyping?: (text?: string) => void;
  onUpload?: (file: File) => Promise<{ url: string; type: "image" | "file"; name: string }>;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  onTyping,
  onUpload,
  disabled,
  placeholder = "Nhập tin nhắn...",
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Max 10MB
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
    const newValue = e.target.value;
    setMessage(newValue);
    onTyping?.(newValue);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t p-4">
      {/* File preview */}
      {selectedFile && (
        <div className="mb-3 p-2 bg-muted rounded-lg flex items-center gap-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="h-16 w-16 object-cover rounded"
            />
          ) : (
            <div className="h-16 w-16 bg-background rounded flex items-center justify-center">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClearFile}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <Input
          value={message}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || uploading}
          className="flex-1"
        />

        <Button
          type="submit"
          size="icon"
          disabled={disabled || uploading || (!message.trim() && !selectedFile)}
        >
          {uploading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </form>
  );
}
