// ==============================================================================
// POUPAGAIO FINANCE — ETAPA 3.5.1: MÓDULO METAS (SQL MIGRATION SCRIPT)
// ==============================================================================

export const GOALS_MIGRATION_SQL = `-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.5.1: MÓDULO METAS (MIGRATION)
-- Criação das tabelas:
--   1. public.goals (Definição da meta/objetivo financeiro)
--   2. public.goal_contributions (Histórico de aportes da meta)
-- Integridade estrita por chave estrangeira composta (goal_id, space_id)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE METAS (public.goals)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
    target_date DATE,
    category TEXT NOT NULL DEFAULT 'Geral',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_goals_id_space UNIQUE (id, space_id)
);

CREATE INDEX IF NOT EXISTS idx_goals_space_id ON public.goals(space_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON public.goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_created_by ON public.goals(created_by);
CREATE INDEX IF NOT EXISTS idx_goals_target_date ON public.goals(target_date);
CREATE INDEX IF NOT EXISTS idx_goals_space_status ON public.goals(space_id, status);

CREATE OR REPLACE FUNCTION public.handle_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goals_updated_at ON public.goals;
CREATE TRIGGER trg_goals_updated_at
    BEFORE UPDATE ON public.goals
    FOR EACH ROW EXECUTE FUNCTION public.handle_goals_updated_at();

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar metas do espaço" ON public.goals;
CREATE POLICY "Membros podem visualizar metas do espaço"
ON public.goals FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goals.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goals.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar metas no espaço" ON public.goals;
CREATE POLICY "Membros autorizados podem criar metas no espaço"
ON public.goals FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = goals.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = goals.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar metas do espaço" ON public.goals;
CREATE POLICY "Membros autorizados podem atualizar metas do espaço"
ON public.goals FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goals.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goals.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goals.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goals.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir metas do espaço" ON public.goals;
CREATE POLICY "Membros autorizados podem excluir metas do espaço"
ON public.goals FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goals.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goals.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE APORTES DE METAS (public.goal_contributions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.goal_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    contribution_date DATE NOT NULL,
    origin_type TEXT NOT NULL DEFAULT 'free_balance' CHECK (origin_type IN ('free_balance', 'reserve')),
    reserve_id UUID REFERENCES public.reserves(id) ON DELETE SET NULL,
    reserve_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_goal_contributions_goal_space
        FOREIGN KEY (goal_id, space_id)
        REFERENCES public.goals (id, space_id)
        ON DELETE CASCADE
);

-- Suporte retroativo caso a tabela já exista sem as colunas
ALTER TABLE public.goal_contributions ADD COLUMN IF NOT EXISTS origin_type TEXT DEFAULT 'free_balance';
ALTER TABLE public.goal_contributions ADD COLUMN IF NOT EXISTS reserve_id UUID REFERENCES public.reserves(id) ON DELETE SET NULL;
ALTER TABLE public.goal_contributions ADD COLUMN IF NOT EXISTS reserve_name TEXT;

CREATE INDEX IF NOT EXISTS idx_goal_contributions_space_id ON public.goal_contributions(space_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_id ON public.goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_date ON public.goal_contributions(contribution_date);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_space_date ON public.goal_contributions(space_id, contribution_date);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_created_by ON public.goal_contributions(created_by);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_origin ON public.goal_contributions(origin_type);

CREATE OR REPLACE FUNCTION public.handle_goal_contributions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goal_contributions_updated_at ON public.goal_contributions;
CREATE TRIGGER trg_goal_contributions_updated_at
    BEFORE UPDATE ON public.goal_contributions
    FOR EACH ROW EXECUTE FUNCTION public.handle_goal_contributions_updated_at();

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar aportes do espaço" ON public.goal_contributions;
CREATE POLICY "Membros podem visualizar aportes do espaço"
ON public.goal_contributions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goal_contributions.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goal_contributions.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem inserir aportes no espaço" ON public.goal_contributions;
CREATE POLICY "Membros autorizados podem inserir aportes no espaço"
ON public.goal_contributions FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = goal_contributions.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = goal_contributions.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar aportes do espaço" ON public.goal_contributions;
CREATE POLICY "Membros autorizados podem atualizar aportes do espaço"
ON public.goal_contributions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goal_contributions.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goal_contributions.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goal_contributions.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goal_contributions.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir aportes do espaço" ON public.goal_contributions;
CREATE POLICY "Membros autorizados podem excluir aportes do espaço"
ON public.goal_contributions FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = goal_contributions.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = goal_contributions.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 3. PERMISSÕES EXPLÍCITAS DAS TABELAS (MENOR PRIVILÉGIO)
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.goals FROM PUBLIC;
REVOKE ALL ON TABLE public.goals FROM anon;

REVOKE ALL ON TABLE public.goal_contributions FROM PUBLIC;
REVOKE ALL ON TABLE public.goal_contributions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.goal_contributions TO authenticated;
`;
