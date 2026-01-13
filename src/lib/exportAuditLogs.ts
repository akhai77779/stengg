import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Json } from '@/integrations/supabase/types';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
  } | null;
}

const actionLabels: Record<string, string> = {
  trade_completed: 'Giao dịch thành công',
  trade_failed: 'Giao dịch thất bại',
  trade_error: 'Lỗi giao dịch',
  withdrawal_requested: 'Yêu cầu rút tiền',
  withdrawal_failed: 'Rút tiền thất bại',
  withdrawal_error: 'Lỗi rút tiền',
  withdrawal_approved: 'Duyệt rút tiền',
  withdrawal_rejected: 'Từ chối rút tiền',
  deposit_approved: 'Duyệt nạp tiền',
  deposit_rejected: 'Từ chối nạp tiền',
  rate_limit_exceeded: 'Vượt giới hạn',
};

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const getDetailsString = (details: Json | null): string => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return '-';
  
  const d = details as Record<string, unknown>;
  const parts: string[] = [];
  
  if (d.trade_type) parts.push(`Type: ${String(d.trade_type)}`);
  if (d.amount) parts.push(`Amount: ${formatCurrency(Number(d.amount))}`);
  if (d.total) parts.push(`Total: ${formatCurrency(Number(d.total))}`);
  if (d.reason) parts.push(`Reason: ${String(d.reason)}`);
  if (d.network) parts.push(`Network: ${String(d.network)}`);
  
  return parts.join(', ') || '-';
};

export function exportToCSV(logs: AuditLog[], filename: string = 'audit-logs') {
  const headers = ['Thời gian', 'Người dùng', 'User ID', 'Hành động', 'Đối tượng', 'Entity ID', 'Chi tiết', 'IP Address'];
  
  const rows = logs.map(log => [
    formatDate(log.created_at),
    log.profiles?.full_name || 'N/A',
    log.user_id,
    actionLabels[log.action] || log.action,
    log.entity_type,
    log.entity_id || '-',
    getDetailsString(log.details),
    log.ip_address || '-'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(logs: AuditLog[], filename: string = 'audit-logs') {
  const doc = new jsPDF('landscape');
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Báo cáo Nhật ký Kiểm tra (Audit Logs)', 14, 22);
  
  // Subtitle with date
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Xuất ngày: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
  doc.text(`Tổng số bản ghi: ${logs.length}`, 14, 36);

  // Table data
  const tableData = logs.map(log => [
    formatDate(log.created_at),
    log.profiles?.full_name || 'N/A',
    actionLabels[log.action] || log.action,
    log.entity_type,
    getDetailsString(log.details),
    log.ip_address || '-'
  ]);

  autoTable(doc, {
    head: [['Thời gian', 'Người dùng', 'Hành động', 'Đối tượng', 'Chi tiết', 'IP']],
    body: tableData,
    startY: 42,
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
      3: { cellWidth: 30 },
      4: { cellWidth: 80 },
      5: { cellWidth: 30 },
    },
  });

  doc.save(`${filename}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
