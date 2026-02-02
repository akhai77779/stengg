-- Add typing_preview column to store what user is typing
ALTER TABLE public.live_chat_typing 
ADD COLUMN IF NOT EXISTS typing_preview text DEFAULT '';