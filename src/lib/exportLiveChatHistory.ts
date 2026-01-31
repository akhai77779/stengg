import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  room_id: string;
  sender_type: 'customer' | 'support' | 'bot';
  sender_name: string;
  message: string;
  attachment_url: string | null;
  attachment_name: string | null;
  is_read: boolean;
  created_at: string;
}

interface ChatRoom {
  id: string;
  customer_name: string;
  customer_email: string | null;
  status: string;
  created_at: string;
}

const senderTypeLabels: Record<string, string> = {
  customer: 'Khách hàng',
  support: 'Hỗ trợ',
  bot: 'Bot',
};

const formatDate = (dateString: string) => {
  return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
};

const formatDateShort = (dateString: string) => {
  return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
};

export function exportChatToCSV(
  messages: ChatMessage[],
  room: ChatRoom,
  filename: string = 'chat-history'
) {
  const headers = ['Thời gian', 'Người gửi', 'Loại', 'Tin nhắn', 'Đính kèm', 'Đã đọc'];

  const rows = messages.map((msg) => [
    formatDate(msg.created_at),
    msg.sender_name,
    senderTypeLabels[msg.sender_type] || msg.sender_type,
    msg.message,
    msg.attachment_name || '-',
    msg.is_read ? 'Đã đọc' : 'Chưa đọc',
  ]);

  // Add room info header
  const roomInfo = [
    ['--- THÔNG TIN PHÒNG CHAT ---'],
    [`Khách hàng: ${room.customer_name}`],
    [`Email: ${room.customer_email || 'N/A'}`],
    [`Trạng thái: ${room.status}`],
    [`Ngày tạo: ${formatDate(room.created_at)}`],
    [`Tổng tin nhắn: ${messages.length}`],
    [''],
  ];

  const csvContent = [
    ...roomInfo.map((row) => row.join(',')),
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `${filename}-${room.customer_name}-${format(new Date(), 'yyyy-MM-dd')}.csv`
  );
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportChatToPDF(
  messages: ChatMessage[],
  room: ChatRoom,
  filename: string = 'chat-history'
) {
  const doc = new jsPDF('portrait');

  // Title
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Lịch sử Chat', 14, 22);

  // Room info
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Khách hàng: ${room.customer_name}`, 14, 32);
  doc.text(`Email: ${room.customer_email || 'N/A'}`, 14, 38);
  doc.text(`Trạng thái: ${room.status}`, 14, 44);
  doc.text(`Ngày tạo phòng: ${formatDateShort(room.created_at)}`, 14, 50);
  doc.text(`Tổng tin nhắn: ${messages.length}`, 14, 56);
  doc.text(`Xuất ngày: ${formatDateShort(new Date().toISOString())}`, 14, 62);

  // Table data
  const tableData = messages.map((msg) => [
    formatDateShort(msg.created_at),
    msg.sender_name,
    senderTypeLabels[msg.sender_type] || msg.sender_type,
    msg.message.length > 60 ? msg.message.substring(0, 60) + '...' : msg.message,
  ]);

  autoTable(doc, {
    head: [['Thời gian', 'Người gửi', 'Loại', 'Tin nhắn']],
    body: tableData,
    startY: 70,
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
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 95 },
    },
  });

  doc.save(
    `${filename}-${room.customer_name}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
  );
}

export function exportAllChatsToCSV(
  rooms: (ChatRoom & { messages: ChatMessage[] })[],
  filename: string = 'all-chats'
) {
  const headers = [
    'Phòng',
    'Khách hàng',
    'Email',
    'Thời gian',
    'Người gửi',
    'Loại',
    'Tin nhắn',
  ];

  const rows: string[][] = [];

  rooms.forEach((room) => {
    room.messages.forEach((msg) => {
      rows.push([
        room.id.substring(0, 8),
        room.customer_name,
        room.customer_email || 'N/A',
        formatDate(msg.created_at),
        msg.sender_name,
        senderTypeLabels[msg.sender_type] || msg.sender_type,
        msg.message,
      ]);
    });
  });

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
