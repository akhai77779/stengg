import { useState } from "react";
import { Send, User, Search, X, MessageSquare, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  user_code: number | null;
}

export function AdminSendNotification() {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const { toast } = useToast();
  const { sendNotification } = useUserNotifications();

  // Fetch users for selection
  const { data: users = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["admin-users-for-notification"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, email, full_name, user_code")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Profile[];
    },
    enabled: open,
  });

  // Filter users based on search
  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.full_name?.toLowerCase().includes(query) ||
      user.user_code?.toString().includes(query)
    );
  });

  const handleSend = async () => {
    if (!selectedUser) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn người dùng",
        variant: "destructive",
      });
      return;
    }

    if (!title.trim() || !message.trim()) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập tiêu đề và nội dung",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const result = await sendNotification(selectedUser.id, title.trim(), message.trim(), type);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setOpen(false);
          resetForm();
        }, 1500);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể gửi thông báo. Vui lòng thử lại.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setSelectedUser(null);
    setSearchQuery("");
    setTitle("");
    setMessage("");
    setType("info");
    setSuccess(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
    }
  };

  const getTypeLabel = (t: string) => {
    switch (t) {
      case "info": return "Thông tin";
      case "success": return "Thành công";
      case "warning": return "Cảnh báo";
      case "error": return "Lỗi";
      case "admin_message": return "Tin nhắn Admin";
      default: return t;
    }
  };

  const getTypeColor = (t: string) => {
    switch (t) {
      case "success": return "bg-green-500";
      case "warning": return "bg-yellow-500";
      case "error": return "bg-red-500";
      case "admin_message": return "bg-blue-500";
      default: return "bg-muted-foreground";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Send className="h-4 w-4" />
          Gửi thông báo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold">Đã gửi thông báo!</h3>
            <p className="text-muted-foreground text-center">
              Thông báo đã được gửi đến {selectedUser?.full_name || selectedUser?.email}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Gửi thông báo cho người dùng
              </DialogTitle>
              <DialogDescription>
                Chọn người dùng và nhập nội dung thông báo muốn gửi
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              {/* User Selection */}
              <div className="space-y-2">
                <Label>Người nhận</Label>
                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-accent/30">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(selectedUser.full_name || selectedUser.email || "U")
                            .slice(0, 2)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {selectedUser.full_name || "Chưa có tên"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedUser.email}
                          {selectedUser.user_code && ` • #${selectedUser.user_code}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedUser(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Tìm theo tên, email hoặc mã..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className="h-[150px] rounded-md border">
                      {isLoadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                          <User className="h-6 w-6 mb-2 opacity-50" />
                          <p className="text-sm">Không tìm thấy người dùng</p>
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredUsers.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {(user.full_name || user.email || "U")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {user.full_name || "Chưa có tên"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.email}
                                </p>
                              </div>
                              {user.user_code && (
                                <Badge variant="secondary" className="text-xs">
                                  #{user.user_code}
                                </Badge>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* Notification Type */}
              <div className="space-y-2">
                <Label>Loại thông báo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["info", "success", "warning", "error", "admin_message"].map((t) => (
                      <SelectItem key={t} value={t}>
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", getTypeColor(t))} />
                          {getTypeLabel(t)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label>Tiêu đề</Label>
                <Input
                  placeholder="Nhập tiêu đề thông báo..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={100}
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>Nội dung</Label>
                <Textarea
                  placeholder="Nhập nội dung thông báo..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/500
                </p>
              </div>

              {/* Preview */}
              {(title || message) && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Xem trước</Label>
                  <div
                    className={cn(
                      "p-3 rounded-lg border-l-4",
                      type === "success" && "border-l-green-500 bg-green-500/5",
                      type === "error" && "border-l-red-500 bg-red-500/5",
                      type === "warning" && "border-l-yellow-500 bg-yellow-500/5",
                      type === "admin_message" && "border-l-blue-500 bg-blue-500/5",
                      type === "info" && "border-l-muted-foreground/50"
                    )}
                  >
                    <p className="font-medium text-sm">{title || "Tiêu đề..."}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {message || "Nội dung..."}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Hủy
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !selectedUser || !title.trim() || !message.trim()}
                  className="gap-2"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Gửi thông báo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
