-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.2: MÓDULO ENTRADAS (MIGRATION FINAL REVISADA)
-- Criação da tabela public.entries com RLS autossuficiente e menor privilégio
-- ==============================================================================

-- 1. Criação da tabela de entradas (idempotente)
CREATE TABLE IF NOT EXISTS public.entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL DEFAULT 'Outros',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Índices de performance para consultas por espaço, competência e status
CREATE INDEX IF NOT EXISTS idx_entries_space_id ON public.entries(space_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_status ON public.entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_space_date ON public.entries(space_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_created_by ON public.entries(created_by);

-- 3. Função de atualização de updated_at (SECURITY INVOKER - menor privilégio)
CREATE OR REPLACE FUNCTION public.handle_entries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entries_updated_at ON public.entries;
CREATE TRIGGER trg_entries_updated_at
    BEFORE UPDATE ON public.entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_entries_updated_at();

-- 4. Habilitação de Row Level Security (RLS)
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de Segurança (RLS Policies baseadas em EXISTS direto, sem dependência de funções externas)

-- SELECT: Qualquer membro com acesso ao espaço (incluindo viewer) pode visualizar as entradas
DROP POLICY IF EXISTS "Membros podem visualizar entradas do espaço" ON public.entries;
CREATE POLICY "Membros podem visualizar entradas do espaço"
ON public.entries FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = entries.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = entries.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- INSERT: Somente membros autenticados com papel owner, admin ou member podem inserir
DROP POLICY IF EXISTS "Membros autorizados podem criar entradas no espaço" ON public.entries;
CREATE POLICY "Membros autorizados podem criar entradas no espaço"
ON public.entries FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = entries.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = entries.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- UPDATE: Somente membros com papel owner, admin ou member podem atualizar.
-- USING garante autorização no espaço atual; WITH CHECK impede mover para espaço sem permissão.
DROP POLICY IF EXISTS "Membros autorizados podem atualizar entradas do espaço" ON public.entries;
CREATE POLICY "Membros autorizados podem atualizar entradas do espaço"
ON public.entries FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = entries.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = entries.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = entries.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = entries.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- DELETE: Somente membros com papel owner, admin ou member podem excluir entradas
DROP POLICY IF EXISTS "Membros autorizados podem excluir entradas do espaço" ON public.entries;
CREATE POLICY "Membros autorizados podem excluir entradas do espaço"
ON public.entries FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = entries.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = entries.space_id
          AND spaces.owner_id = auth.uid()
    )
);
