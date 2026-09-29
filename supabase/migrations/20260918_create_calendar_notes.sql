-- Migration: Create calendar_notes table for Poupagaio Finance
-- DO NOT EXECUTE AUTOMATICALLY. PRESENTED FOR REVIEW.

CREATE TABLE IF NOT EXISTS public.calendar_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 1000),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying by space and date
CREATE INDEX IF NOT EXISTS idx_calendar_notes_space_date ON public.calendar_notes(space_id, note_date);

-- Enable RLS
ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Membros do space podem ver anotações"
  ON public.calendar_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.space_members
      WHERE space_members.space_id = calendar_notes.space_id
        AND space_members.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.spaces
      WHERE spaces.id = calendar_notes.space_id
        AND spaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Membros autorizados podem inserir anotações"
  ON public.calendar_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.space_members
      WHERE space_members.space_id = calendar_notes.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.spaces
      WHERE spaces.id = calendar_notes.space_id
        AND spaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Membros autorizados podem atualizar anotações"
  ON public.calendar_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.space_members
      WHERE space_members.space_id = calendar_notes.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.spaces
      WHERE spaces.id = calendar_notes.space_id
        AND spaces.owner_id = auth.uid()
    )
  );

CREATE POLICY "Membros autorizados podem deletar anotações"
  ON public.calendar_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.space_members
      WHERE space_members.space_id = calendar_notes.space_id
        AND space_members.user_id = auth.uid()
        AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.spaces
      WHERE spaces.id = calendar_notes.space_id
        AND spaces.owner_id = auth.uid()
    )
  );
