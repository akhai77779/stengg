import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Ban, RefreshCw, Loader2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface MatchTarget {
  log: AuditLogEntry;
}

export function BankQuayMonitor() {
  const [activeTab, setActiveTab] = useState("unmatched");
  const [matchDialog, setMatchDialog] = useState<MatchTarget | null>(null);
  const [searchEmail, setSearchEmail] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: unmatchedLogs, isLoading: unmatchedLoading, refetch: refetchUnmatched } = useQuery({
    queryKey: ["bankquay-unmatched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action", "bankquay_unmatched")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const { data: invalidSigLogs, isLoading: sigLoading, refetch: refetchSig } = useQuery({
    queryKey: ["bankquay-invalid-signature"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("action", "bankquay_invalid_signature")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  // Search users for manual match
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["user-search-match", searchEmail],
    queryFn: async () => {
      if (!searchEmail || searchEmail.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles_safe")
        .select("id, email, full_name, user_code, balance")
        .or(`email.ilike.%${searchEmail}%,full_name.ilike.%${searchEmail}%,user_code.eq.${parseInt(searchEmail) || 0}`)
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!searchEmail && searchEmail.length >= 2,
  });

  const manualMatchMutation = useMutation({
    mutationFn: async ({ auditLogId, userId }: { auditLogId: string; userId: string }) => {
      const { data, error } = await supabase.functions.invoke("bankquay-manual-match", {
        body: { audit_log_id: auditLogId, user_id: userId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Đã khớp thành công! Số dư mới: ${Number(data.new_balance).toLocaleString()}`);
      setMatchDialog(null);
      setSearchEmail("");
      setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ["bankquay-unmatched"] });
    },
    onError: (err: Error) => {
      toast.error(`Lỗi: ${err.message}`);
    },
  });

  const handleRefresh = () => {
    refetchUnmatched();
    refetchSig();
  };

  const openMatchDialog = (log: AuditLogEntry) => {
    setMatchDialog({ log });
    setSearchEmail("");
    setSelectedUserId(null);
  };

  const handleMatch = () => {
    if (!matchDialog || !selectedUserId) return;
    manualMatchMutation.mutate({
      auditLogId: matchDialog.log.id,
      userId: selectedUserId,
    });
  };

  const unmatchedCount = unmatchedLogs?.length || 0;
  const invalidSigCount = invalidSigLogs?.length || 0;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            BankQuay Monitor
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Làm mới
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="unmatched" className="flex-1 gap-1.5">
                Chưa khớp
                {unmatchedCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                    {unmatchedCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="invalid_sig" className="flex-1 gap-1.5">
                <Ban className="h-3.5 w-3.5" />
                Signature lỗi
                {invalidSigCount > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                    {invalidSigCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="unmatched" className="mt-4">
              {unmatchedLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : unmatchedLogs && unmatchedLogs.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>Số tiền</TableHead>
                        <TableHead>Nội dung CK</TableHead>
                        <TableHead>Người gửi</TableHead>
                        <TableHead>Ngân hàng</TableHead>
                        <TableHead className="text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmatchedLogs.map((log) => {
                        const d = log.details as Record<string, unknown> | null;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell className="font-medium text-primary">
                              {d?.amount ? Number(d.amount).toLocaleString() : "—"}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate text-xs">
                              {(d?.content as string) || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {(d?.sender_name as string) || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {(d?.bank_name as string) || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={() => openMatchDialog(log)}
                              >
                                <UserPlus className="h-3.5 w-3.5" />
                                Khớp
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Không có giao dịch chưa khớp
                </div>
              )}
            </TabsContent>

            <TabsContent value="invalid_sig" className="mt-4">
              {sigLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : invalidSigLogs && invalidSigLogs.length > 0 ? (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Thời gian</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>User-Agent</TableHead>
                        <TableHead>Signature (trích)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidSigLogs.map((log) => {
                        const d = log.details as Record<string, unknown> | null;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {(d?.ip as string) || "—"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-xs">
                              {(d?.user_agent as string) || "—"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {(d?.signature_provided as string) || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Không có request nào có signature không hợp lệ
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Manual Match Dialog */}
      <Dialog open={!!matchDialog} onOpenChange={(open) => !open && setMatchDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Khớp giao dịch thủ công</DialogTitle>
            <DialogDescription>
              Chọn người dùng để cộng{" "}
              <span className="font-semibold text-primary">
                {matchDialog?.log.details?.amount
                  ? Number(matchDialog.log.details.amount).toLocaleString()
                  : 0}{" "}
                VND
              </span>{" "}
              vào tài khoản.
            </DialogDescription>
          </DialogHeader>

          {/* Transaction info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Người gửi:</span>{" "}
              {(matchDialog?.log.details?.sender_name as string) || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Nội dung:</span>{" "}
              {(matchDialog?.log.details?.content as string) || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Ngân hàng:</span>{" "}
              {(matchDialog?.log.details?.bank_name as string) || "—"}
            </p>
          </div>

          {/* User search */}
          <div className="space-y-2">
            <Label>Tìm người dùng (email, tên, mã)</Label>
            <Input
              placeholder="Nhập email, tên hoặc mã người dùng..."
              value={searchEmail}
              onChange={(e) => {
                setSearchEmail(e.target.value);
                setSelectedUserId(null);
              }}
            />
          </div>

          {/* Search results */}
          {searchLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id!)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedUserId === u.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="font-medium">{u.full_name || "Chưa đặt tên"}</div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span>{u.email}</span>
                    {u.user_code && <span>• Mã: {u.user_code}</span>}
                    <span>• Số dư: {Number(u.balance || 0).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : searchEmail.length >= 2 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Không tìm thấy</p>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchDialog(null)}>
              Hủy
            </Button>
            <Button
              onClick={handleMatch}
              disabled={!selectedUserId || manualMatchMutation.isPending}
            >
              {manualMatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              Xác nhận khớp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
