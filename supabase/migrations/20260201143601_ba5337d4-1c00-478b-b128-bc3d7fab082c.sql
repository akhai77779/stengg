-- Add DELETE policy for admins on live_chat_messages
CREATE POLICY "Admins can delete all messages"
ON public.live_chat_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));