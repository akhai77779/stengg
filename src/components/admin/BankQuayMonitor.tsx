import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Ban, RefreshCw, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

export function BankQuayMonitor() {
  const [activeTab, setActiveTab] = useState("unmatched");

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

  const handleRefresh = () => {
    refetchUnmatched();
    refetchSig();
  };

  const unmatchedCount = unmatchedLogs?.length || 0;
  const invalidSigCount = invalidSigLogs?.length || 0;

  return (
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
                      <TableHead>Mã GD</TableHead>
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
                          <TableCell className="text-xs font-mono">
                            {(d?.transaction_id as string) || "—"}
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
  );
}
