// ==============================================================================
// POUPAGAIO FINANCE — ETAPA 3.5.2: LISTA DE DESEJOS (SQL MIGRATION SCRIPT)
// ==============================================================================

export const WISHLIST_MIGRATION_SQL = `-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.5.2: LISTA DE DESEJOS (MIGRATION)
-- Criação da tabela:
--   1. public.wishlist_items (Itens da lista de desejos / sonhos de consumo)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    estimated_amount NUMERIC(12, 2) NOT NULL CHECK (estimated_amount > 0),
    category TEXT NOT NULL DEFAULT 'Geral',
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    desired_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'purchased', 'archived')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_space_id ON public.wishlist_items(space_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_space_status ON public.wishlist_items(space_id, status);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_space_priority ON public.wishlist_items(space_id, priority);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_created_by ON public.wishlist_items(created_by);

CREATE OR REPLACE FUNCTION public.handle_wishlist_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wishlist_items_updated_at ON public.wishlist_items;
CREATE TRIGGER trg_wishlist_items_updated_at
    BEFORE UPDATE ON public.wishlist_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_wishlist_items_updated_at();

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar desejos do espaço" ON public.wishlist_items;
CREATE POLICY "Membros podem visualizar desejos do espaço"
ON public.wishlist_items FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = wishlist_items.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = wishlist_items.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar desejos no espaço" ON public.wishlist_items;
CREATE POLICY "Membros autorizados podem criar desejos no espaço"
ON public.wishlist_items FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = wishlist_items.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = wishlist_items.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar desejos do espaço" ON public.wishlist_items;
CREATE POLICY "Membros autorizados podem atualizar desejos do espaço"
ON public.wishlist_items FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = wishlist_items.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = wishlist_items.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = wishlist_items.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = wishlist_items.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir desejos do espaço" ON public.wishlist_items;
CREATE POLICY "Membros autorizados podem excluir desejos do espaço"
ON public.wishlist_items FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = wishlist_items.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = wishlist_items.space_id
          AND spaces.owner_id = auth.uid()
    )
);

REVOKE ALL ON TABLE public.wishlist_items FROM PUBLIC;
REVOKE ALL ON TABLE public.wishlist_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wishlist_items TO authenticated;
`;
