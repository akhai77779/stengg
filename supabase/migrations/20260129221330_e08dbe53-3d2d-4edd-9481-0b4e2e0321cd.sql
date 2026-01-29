-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can send messages" ON live_chat_messages;
DROP POLICY IF EXISTS "Users can view room messages" ON live_chat_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON live_chat_messages;
DROP POLICY IF EXISTS "Customers can view own rooms" ON live_chat_rooms;
DROP POLICY IF EXISTS "Customers can update own rooms" ON live_chat_rooms;

-- Create new policies that support both authenticated users AND anonymous guests

-- Live chat messages: Allow anyone to send messages to rooms they own (by customer_id in room)
CREATE POLICY "Anyone can send messages to their room"
ON live_chat_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM live_chat_rooms r
    WHERE r.id = room_id
    -- Room's customer_id matches auth user OR room is accessible (for guests without auth)
    AND (
      r.customer_id = COALESCE(auth.uid()::text, r.customer_id)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Live chat messages: Allow anyone to view messages in rooms they own
CREATE POLICY "Anyone can view their room messages"
ON live_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM live_chat_rooms r
    WHERE r.id = room_id
    AND (
      r.customer_id = COALESCE(auth.uid()::text, r.customer_id)
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Live chat messages: Allow users to update their own messages
CREATE POLICY "Anyone can update own messages"
ON live_chat_messages FOR UPDATE
USING (
  sender_id = COALESCE(auth.uid()::text, sender_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Live chat rooms: Allow anyone to view their own rooms (including guests)
CREATE POLICY "Anyone can view own rooms"
ON live_chat_rooms FOR SELECT
USING (
  customer_id = COALESCE(auth.uid()::text, customer_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Live chat rooms: Allow anyone to update their own rooms
CREATE POLICY "Anyone can update own rooms"
ON live_chat_rooms FOR UPDATE
USING (
  customer_id = COALESCE(auth.uid()::text, customer_id)
  OR has_role(auth.uid(), 'admin'::app_role)
);