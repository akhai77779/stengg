-- =============================================
-- LIVE CHAT SYSTEM TABLES
-- =============================================

-- 1. Live Chat Rooms
CREATE TABLE public.live_chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Customer info (can be guest or authenticated user)
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  
  -- Room status
  status TEXT NOT NULL DEFAULT 'waiting' 
    CHECK (status IN ('active', 'waiting', 'closed')),
  
  -- Assignment (support staff)
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Last activity
  last_message TEXT,
  last_updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Live Chat Messages
CREATE TABLE public.live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- References
  room_id UUID NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  
  -- Message content
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'support', 'bot')),
  sender_id TEXT,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  
  -- Attachments
  attachment_url TEXT,
  attachment_type TEXT CHECK (attachment_type IN ('image', 'file') OR attachment_type IS NULL),
  attachment_name TEXT,
  
  -- Read status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Live Chat Typing Status
CREATE TABLE public.live_chat_typing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  room_id UUID NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'support')),
  
  is_typing BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: one typing status per user per room
  UNIQUE(room_id, user_id)
);

-- 4. Live Chat Internal Notes (Admin only)
CREATE TABLE public.live_chat_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  room_id UUID NOT NULL REFERENCES live_chat_rooms(id) ON DELETE CASCADE,
  
  -- Note content
  content TEXT NOT NULL,
  
  -- Author (support staff)
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  author_email TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_live_chat_rooms_status ON live_chat_rooms(status);
CREATE INDEX idx_live_chat_rooms_customer ON live_chat_rooms(customer_id);
CREATE INDEX idx_live_chat_rooms_assigned ON live_chat_rooms(assigned_to);
CREATE INDEX idx_live_chat_rooms_updated ON live_chat_rooms(last_updated_at DESC);

CREATE INDEX idx_live_chat_messages_room ON live_chat_messages(room_id);
CREATE INDEX idx_live_chat_messages_created ON live_chat_messages(created_at DESC);
CREATE INDEX idx_live_chat_messages_unread ON live_chat_messages(room_id, is_read) WHERE is_read = false;

CREATE INDEX idx_live_chat_typing_room ON live_chat_typing(room_id);
CREATE INDEX idx_live_chat_typing_updated ON live_chat_typing(updated_at);

CREATE INDEX idx_live_chat_notes_room ON live_chat_notes(room_id);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE live_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_typing ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_chat_notes ENABLE ROW LEVEL SECURITY;

-- LIVE_CHAT_ROOMS POLICIES
CREATE POLICY "Admins can manage all rooms" ON live_chat_rooms
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can view own rooms" ON live_chat_rooms
  FOR SELECT USING (customer_id = COALESCE(auth.uid()::text, customer_id));

CREATE POLICY "Anyone can create rooms" ON live_chat_rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Customers can update own rooms" ON live_chat_rooms
  FOR UPDATE USING (customer_id = auth.uid()::text);

-- LIVE_CHAT_MESSAGES POLICIES
CREATE POLICY "Admins can manage all messages" ON live_chat_messages
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view room messages" ON live_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM live_chat_rooms r 
      WHERE r.id = room_id 
      AND (r.customer_id = auth.uid()::text OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can send messages" ON live_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_chat_rooms r 
      WHERE r.id = room_id 
      AND (r.customer_id = auth.uid()::text OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Users can update own messages" ON live_chat_messages
  FOR UPDATE USING (
    sender_id = auth.uid()::text OR has_role(auth.uid(), 'admin')
  );

-- LIVE_CHAT_TYPING POLICIES
CREATE POLICY "Anyone can view typing status" ON live_chat_typing
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own typing" ON live_chat_typing
  FOR ALL USING (user_id = auth.uid()::text OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert typing" ON live_chat_typing
  FOR INSERT WITH CHECK (true);

-- LIVE_CHAT_NOTES POLICIES (Admin only)
CREATE POLICY "Admins only for notes" ON live_chat_notes
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at for rooms
CREATE TRIGGER update_live_chat_rooms_updated_at
  BEFORE UPDATE ON live_chat_rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-update updated_at for notes
CREATE TRIGGER update_live_chat_notes_updated_at
  BEFORE UPDATE ON live_chat_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE live_chat_typing;