# 🔄 Migration Guide: Devv.ai → Supabase (Lovable Cloud)

## Tổng quan

Hướng dẫn này giúp migrate hệ thống Live Chat từ Devv.ai sang Supabase với đầy đủ:
- Database schema mapping
- Code structure recommendations  
- Supabase best practices

---

## 📊 1. Database Schema Mapping

### Devv.ai Tables → Supabase Tables

| Devv Table | Supabase Table | Mô tả |
|------------|----------------|-------|
| `chat_messages` (fb2ff6ns99fk) | `live_chat_messages` | Tin nhắn giữa customer và support |
| `chat_rooms` (fb2ff6ns99fl) | `live_chat_rooms` | Thông tin phòng chat |
| `typing_status` (fb3zd1mjaqkg) | `live_chat_typing` | Trạng thái đang nhập |
| `internal_notes` (fbi3bmxdnchs) | `live_chat_notes` | Ghi chú nội bộ cho support |

### Chi tiết Schema Mapping

#### 1.1 `live_chat_rooms` (từ chat_rooms)

```sql
CREATE TABLE public.live_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer info (có thể là guest hoặc authenticated user)
  customer_id TEXT NOT NULL,           -- Devv: customer_id (string)
  customer_name TEXT NOT NULL,          -- Devv: customer_name
  customer_email TEXT,                  -- Devv: customer_email
  
  -- Room status
  status TEXT NOT NULL DEFAULT 'waiting' 
    CHECK (status IN ('active', 'waiting', 'closed')),
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id), -- Support staff ID
  
  -- Last activity
  last_message TEXT,                    -- Devv: last_message
  last_updated_at TIMESTAMPTZ DEFAULT now(), -- Devv: last_updated (number → timestamp)
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_live_chat_rooms_status ON live_chat_rooms(status);
CREATE INDEX idx_live_chat_rooms_customer ON live_chat_rooms(customer_id);
CREATE INDEX idx_live_chat_rooms_assigned ON live_chat_rooms(assigned_to);
```

#### 1.2 `live_chat_messages` (từ chat_messages)

```sql
CREATE TABLE public.live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  room_id UUID NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  
  -- Message content
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'support', 'bot')),
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  
  -- Attachments
  attachment_url TEXT,
  attachment_type TEXT CHECK (attachment_type IN ('image', 'file', NULL)),
  attachment_name TEXT,
  
  -- Read status
  is_read BOOLEAN DEFAULT false,       -- Devv: is_read (number → boolean)
  read_at TIMESTAMPTZ,                 -- Devv: read_at (number → timestamp)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(), -- Devv: timestamp
  
  -- Denormalized for query performance
  sender_id TEXT                        -- customer_id or support user_id
);

-- Indexes
CREATE INDEX idx_live_chat_messages_room ON live_chat_messages(room_id);
CREATE INDEX idx_live_chat_messages_created ON live_chat_messages(created_at DESC);
CREATE INDEX idx_live_chat_messages_unread ON live_chat_messages(room_id, is_read) 
  WHERE is_read = false;
```

#### 1.3 `live_chat_typing` (từ typing_status)

```sql
CREATE TABLE public.live_chat_typing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  room_id UUID NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,               -- customer_id or support user_id
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'support')),
  
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: one typing status per user per room
  UNIQUE(room_id, user_id)
);

-- Auto-cleanup old typing status
CREATE INDEX idx_live_chat_typing_updated ON live_chat_typing(updated_at);
```

#### 1.4 `live_chat_notes` (từ internal_notes)

```sql
CREATE TABLE public.live_chat_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  room_id UUID NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  
  -- Note content
  content TEXT NOT NULL,
  
  -- Author (support staff)
  author_id UUID REFERENCES auth.users(id),
  author_name TEXT NOT NULL,
  author_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_live_chat_notes_room ON live_chat_notes(room_id);
```

---

## 🔐 2. Row Level Security (RLS) Policies

### 2.1 live_chat_rooms

```sql
ALTER TABLE live_chat_rooms ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all rooms" ON live_chat_rooms
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Customers can view their own rooms
CREATE POLICY "Customers can view own rooms" ON live_chat_rooms
  FOR SELECT USING (customer_id = auth.uid()::text);

-- Allow creating rooms (for guests too)
CREATE POLICY "Anyone can create rooms" ON live_chat_rooms
  FOR INSERT WITH CHECK (true);
```

### 2.2 live_chat_messages

```sql
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all messages" ON live_chat_messages
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Users can view messages in their rooms
CREATE POLICY "Users can view room messages" ON live_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM live_chat_rooms r 
      WHERE r.id = room_id AND r.customer_id = auth.uid()::text
    )
  );

-- Users can send messages to their rooms
CREATE POLICY "Users can send messages" ON live_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_chat_rooms r 
      WHERE r.id = room_id AND r.customer_id = auth.uid()::text
    ) OR has_role(auth.uid(), 'admin')
  );
```

### 2.3 live_chat_typing

```sql
ALTER TABLE live_chat_typing ENABLE ROW LEVEL SECURITY;

-- Anyone in room can see typing status
CREATE POLICY "View typing in own rooms" ON live_chat_typing
  FOR SELECT USING (true);

-- Users can update their typing status
CREATE POLICY "Update own typing" ON live_chat_typing
  FOR ALL USING (user_id = auth.uid()::text OR has_role(auth.uid(), 'admin'));
```

### 2.4 live_chat_notes (Admin only)

```sql
ALTER TABLE live_chat_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can access notes
CREATE POLICY "Admins only for notes" ON live_chat_notes
  FOR ALL USING (has_role(auth.uid(), 'admin'));
```

---

## 📦 3. Code Structure Recommendations

### 3.1 Devv.ai → Supabase Code Mapping

| Devv.ai Pattern | Supabase Equivalent |
|-----------------|---------------------|
| `table.getItems()` | `supabase.from().select()` |
| `table.addItem()` | `supabase.from().insert()` |
| `table.updateItem()` | `supabase.from().update()` |
| `upload.uploadFile()` | `supabase.storage.from().upload()` |
| `auth.logout()` | `supabase.auth.signOut()` |
| `useAuthStore` (Zustand) | `useAuth` hook (existing) |

### 3.2 Recommended File Structure

```
src/
├── components/
│   └── live-chat/
│       ├── ChatWidget.tsx         # Customer chat widget (floating button)
│       ├── ChatWindow.tsx         # Chat window UI
│       ├── MessageList.tsx        # Message display
│       ├── MessageInput.tsx       # Input with attachments
│       ├── TypingIndicator.tsx    # "Đang nhập..." indicator
│       ├── QuickReplies.tsx       # Quick reply templates
│       ├── AttachmentPreview.tsx  # Preview uploaded files
│       └── WorkingHours.tsx       # Giờ làm việc display
│
├── pages/
│   └── admin/
│       └── AdminLiveChat.tsx      # Full admin panel (from AdminPage.tsx)
│
├── hooks/
│   ├── useLiveChatRooms.tsx       # Room management
│   ├── useLiveChatMessages.tsx    # Message CRUD + realtime
│   ├── useLiveChatTyping.tsx      # Typing status
│   └── useLiveChatNotes.tsx       # Internal notes
│
└── lib/
    └── live-chat-utils.ts         # Helper functions
```

### 3.3 Key Hook Examples

#### useLiveChatRooms.tsx
```typescript
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useLiveChatRooms() {
  const queryClient = useQueryClient();

  // Fetch all rooms (admin)
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["live-chat-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_chat_rooms")
        .select("*")
        .order("last_updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("live-chat-rooms")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_chat_rooms" },
        () => queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return { rooms, isLoading };
}
```

#### useLiveChatMessages.tsx
```typescript
export function useLiveChatMessages(roomId: string | null) {
  const queryClient = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ["live-chat-messages", roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!roomId,
  });

  // Realtime subscription for messages
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          queryClient.setQueryData(
            ["live-chat-messages", roomId],
            (old: any[]) => [...(old || []), payload.new]
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  return { messages };
}
```

---

## 📤 4. Data Export Script (Devv → JSON)

Chạy script này trong Devv.ai console để export data:

```javascript
// Export script for Devv.ai tables
const exportData = async () => {
  const { table } = await import('@devvai/devv-code-backend');
  
  const exportTable = async (tableId, name) => {
    const result = await table.getItems(tableId, { limit: 10000 });
    return { name, items: result.items };
  };

  const data = {
    exportedAt: new Date().toISOString(),
    tables: await Promise.all([
      exportTable('fb2ff6ns99fk', 'chat_messages'),
      exportTable('fb2ff6ns99fl', 'chat_rooms'),
      exportTable('fb3zd1mjaqkg', 'typing_status'),
      exportTable('fbi3bmxdnchs', 'internal_notes'),
    ])
  };

  // Download as JSON
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'devv-chat-export.json';
  a.click();
  
  console.log('Export complete!', data);
  return data;
};

exportData();
```

---

## 📥 5. Data Import Script (JSON → Supabase)

```typescript
// Run via Supabase Edge Function or local script
import { createClient } from "@supabase/supabase-js";

const importData = async (jsonData: any) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  for (const table of jsonData.tables) {
    if (table.name === 'chat_rooms') {
      const rooms = table.items.map((item: any) => ({
        customer_id: item.customer_id,
        customer_name: item.customer_name,
        customer_email: item.customer_email,
        status: item.status || 'waiting',
        last_message: item.last_message,
        last_updated_at: new Date(item.last_updated).toISOString(),
        assigned_to: item.assigned_to || null,
      }));
      
      await supabase.from('live_chat_rooms').insert(rooms);
    }
    
    if (table.name === 'chat_messages') {
      // Need to map old room IDs to new UUIDs
      // This requires a mapping table or two-pass import
    }
    
    // ... similar for other tables
  }
};
```

---

## ✅ 6. Migration Checklist

### Phase 1: Database Setup
- [ ] Run migration SQL to create tables
- [ ] Enable RLS policies
- [ ] Enable realtime for messages & typing tables
- [ ] Create storage bucket for attachments

### Phase 2: Code Migration
- [ ] Create live-chat hooks
- [ ] Build ChatWidget component
- [ ] Build admin AdminLiveChat page
- [ ] Integrate with existing auth system

### Phase 3: Data Migration
- [ ] Export data from Devv.ai
- [ ] Transform JSON format
- [ ] Import to Supabase
- [ ] Verify data integrity

### Phase 4: Testing
- [ ] Test customer chat flow
- [ ] Test admin response flow
- [ ] Test realtime updates
- [ ] Test file uploads
- [ ] Test notifications

---

## 🚀 7. Next Steps

Bạn muốn tôi thực hiện bước nào?

1. **Tạo migration SQL** - Tạo tables trong Supabase ngay
2. **Tạo hooks** - Implement các hooks cho live chat
3. **Tạo components** - Build UI components từ code Devv
4. **Full implementation** - Làm tất cả

Cho tôi biết để bắt đầu! 🎯
