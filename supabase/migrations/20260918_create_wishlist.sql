-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.5.2: LISTA DE DESEJOS (MIGRATION)
-- Criação da tabela:
--   1. public.wishlist_items (Itens da lista de desejos / sonhos de consumo)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE ITENS DA LISTA DE DESEJOS (public.wishlist_items)
-- ------------------------------------------------------------------------------
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

-- Índices de performance estritos para consultas frequentes do espaço
CREATE INDEX IF NOT EXISTS idx_wishlist_items_space_id ON public.wishlist_items(space_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_space_status ON public.wishlist_items(space_id, status);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_space_priority ON public.wishlist_items(space_id, priority);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_created_by ON public.wishlist_items(created_by);

-- Trigger de updated_at e imutabilidade estrita de created_by (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.handle_wishlist_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    -- Proteção de autoria: created_by é estritamente imutável após a criação
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wishlist_items_updated_at ON public.wishlist_items;
CREATE TRIGGER trg_wishlist_items_updated_at
    BEFORE UPDATE ON public.wishlist_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_wishlist_items_updated_at();

-- Habilitação de RLS para wishlist_items
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para wishlist_items (SELECT, INSERT, UPDATE com USING+WITH CHECK, DELETE)

-- 1. SELECT: Membros e Proprietário direto do espaço podem visualizar (inclusive viewer)
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

-- 2. INSERT: Somente owner, admin ou member; garante autoria real via created_by = auth.uid()
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

-- 3. UPDATE: Somente owner, admin ou member (USING + WITH CHECK para integridade de espaço)
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

-- 4. DELETE: Somente owner, admin ou member
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

-- ------------------------------------------------------------------------------
-- 2. PERMISSÕES EXPLÍCITAS DA TABELA (MENOR PRIVILÉGIO)
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.wishlist_items FROM PUBLIC;
REVOKE ALL ON TABLE public.wishlist_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.wishlist_items TO authenticated;
