
-- Drop overly permissive policies on live_chat_typing
DROP POLICY IF EXISTS "Anyone can view typing status" ON public.live_chat_typing;
DROP POLICY IF EXISTS "Anyone can insert typing" ON public.live_chat_typing;
DROP POLICY IF EXISTS "Users can manage own typing" ON public.live_chat_typing;

-- Create secure policies for live_chat_typing
-- Admin full access
CREATE POLICY "Admins can manage all typing" ON public.live_chat_typing
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users: can only see/manage typing in rooms they own
CREATE POLICY "Authenticated users view own room typing" ON public.live_chat_typing
FOR SELECT USING (
  auth.uid() IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM live_chat_rooms r 
    WHERE r.id = live_chat_typing.room_id 
    AND r.customer_id = auth.uid()::text
  )
);

CREATE POLICY "Authenticated users insert own typing" ON public.live_chat_typing
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM live_chat_rooms r 
    WHERE r.id = room_id 
    AND r.customer_id = auth.uid()::text
  )
);

CREATE POLICY "Authenticated users update own typing" ON public.live_chat_typing
FOR UPDATE USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()::text
);

CREATE POLICY "Authenticated users delete own typing" ON public.live_chat_typing
FOR DELETE USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()::text
);

-- Guest users: can only see/manage typing in guest rooms they created
CREATE POLICY "Guests view own room typing" ON public.live_chat_typing
FOR SELECT USING (
  auth.uid() IS NULL 
  AND EXISTS (
    SELECT 1 FROM live_chat_rooms r 
    WHERE r.id = live_chat_typing.room_id 
    AND r.customer_id LIKE 'guest_%'
  )
);

CREATE POLICY "Guests insert own typing" ON public.live_chat_typing
FOR INSERT WITH CHECK (
  auth.uid() IS NULL 
  AND user_id LIKE 'guest_%'
  AND EXISTS (
    SELECT 1 FROM live_chat_rooms r 
    WHERE r.id = room_id 
    AND r.customer_id LIKE 'guest_%'
  )
);

CREATE POLICY "Guests update own typing" ON public.live_chat_typing
FOR UPDATE USING (
  auth.uid() IS NULL 
  AND user_id LIKE 'guest_%'
);

CREATE POLICY "Guests delete own typing" ON public.live_chat_typing
FOR DELETE USING (
  auth.uid() IS NULL 
  AND user_id LIKE 'guest_%'
);
