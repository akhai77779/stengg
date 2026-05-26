import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Trash2, Search } from "lucide-react";
import { format } from "date-fns";


interface DeleteSnapshot {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  user_code?: number | null;
  balance?: number | null;
}

interface DeleteLog {
  id: string;
  created_at: string;
  user_id: string; // admin who performed action
  entity_id: string | null; // deleted user id
  details: {
    target_user_id?: string;
    snapshot?: DeleteSnapshot;
  } | null;
  admin_name?: string | null;
}

export function RecentDeletedUsersPanel() {
  const [logs, setLogs] = useState<DeleteLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, created_at, user_id, entity_id, details")
        .eq("action", "admin_delete_user")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      const rows = (data ?? []) as DeleteLog[];

      // Lookup admin names
      const adminIds = Array.from(new Set(rows.map((r) => r.user_id))).filter(
        Boolean,
      );
      let adminMap: Record<string, string | null> = {};
      if (adminIds.length) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", adminIds);
        adminMap = Object.fromEntries(
          (admins ?? []).map((a) => [
            a.id,
            a.full_name || a.email || a.id.slice(0, 8),
          ]),
        );
      }

      setLogs(
        rows.map((r) => ({ ...r, admin_name: adminMap[r.user_id] ?? null })),
      );
    } catch (err) {
      console.error("Load delete audit logs error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trash2 className="w-4 h-4 text-destructive" />
            Xóa tài khoản gần đây
            <Badge variant="secondary" className="ml-1">
              {logs.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">
            Chưa có thao tác xóa tài khoản nào được ghi nhận.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Admin thực hiện</TableHead>
                  <TableHead>Người dùng bị xóa</TableHead>
                  <TableHead>Liên hệ</TableHead>
                  <TableHead className="text-right">Số dư cuối</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const snap = log.details?.snapshot ?? {};
                  const contact = snap.email || snap.phone || "—";
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.admin_name ?? log.user_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {snap.full_name || "—"}
                          </span>
                          {snap.user_code ? (
                            <span className="text-xs text-muted-foreground">
                              #{snap.user_code}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {contact}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {typeof snap.balance === "number"
                          ? `$${snap.balance.toFixed(2)}`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}