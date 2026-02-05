-- Create admin notes table for users
CREATE TABLE public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique constraint so each user has only one note
CREATE UNIQUE INDEX admin_user_notes_user_id_idx ON public.admin_user_notes(user_id);

-- Enable RLS
ALTER TABLE public.admin_user_notes ENABLE ROW LEVEL SECURITY;

-- Only admins can access this table
CREATE POLICY "Admins can view all notes"
ON public.admin_user_notes FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert notes"
ON public.admin_user_notes FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update notes"
ON public.admin_user_notes FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete notes"
ON public.admin_user_notes FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_admin_user_notes_updated_at
BEFORE UPDATE ON public.admin_user_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();