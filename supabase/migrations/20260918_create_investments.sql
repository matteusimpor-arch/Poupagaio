-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.7: MÓDULO INVESTIMENTOS (MIGRATION)
-- Criação das tabelas:
--   1. public.investments (Posições da carteira de investimentos)
--   2. public.investment_transactions (Histórico de aportes e resgates)
-- Integridade estrita por chave estrangeira composta (investment_id, space_id)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE INVESTIMENTOS (public.investments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('fixed_income', 'fund', 'stock', 'reit', 'etf', 'crypto', 'pension', 'savings', 'other')),
    institution TEXT NULL,
    ticker TEXT NULL,
    current_value NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (current_value >= 0),
    notes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Chave candidata para permitir integridade relacional composta com movimentações
    CONSTRAINT uq_investments_id_space UNIQUE (id, space_id)
);

-- Índices de performance para public.investments
CREATE INDEX IF NOT EXISTS idx_investments_space_status ON public.investments(space_id, status);

-- Trigger de updated_at e imutabilidade de created_by para public.investments
CREATE OR REPLACE FUNCTION public.handle_investments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    -- Proteção de autoria: created_by é imutável após criação
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_investments_updated_at ON public.investments;
CREATE TRIGGER trg_investments_updated_at
    BEFORE UPDATE ON public.investments
    FOR EACH ROW EXECUTE FUNCTION public.handle_investments_updated_at();

-- Habilitação de RLS para public.investments
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para public.investments
DROP POLICY IF EXISTS "Membros podem visualizar investimentos do espaço" ON public.investments;
CREATE POLICY "Membros podem visualizar investimentos do espaço"
ON public.investments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = investments.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = investments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar investimentos no espaço" ON public.investments;
CREATE POLICY "Membros autorizados podem criar investimentos no espaço"
ON public.investments FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = investments.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = investments.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar investimentos do espaço" ON public.investments;
CREATE POLICY "Membros autorizados podem atualizar investimentos do espaço"
ON public.investments FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = investments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = investments.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = investments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = investments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir investimentos do espaço" ON public.investments;
CREATE POLICY "Membros autorizados podem excluir investimentos do espaço"
ON public.investments FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = investments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = investments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE MOVIMENTAÇÕES DE INVESTIMENTO (public.investment_transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID NOT NULL,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('contribution', 'withdrawal')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    transaction_date DATE NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Chave estrangeira composta impedindo vinculação cross-space entre investimento e movimentação
    CONSTRAINT fk_investment_transactions_investment_space
        FOREIGN KEY (investment_id, space_id)
        REFERENCES public.investments (id, space_id)
        ON DELETE CASCADE
);

-- Índices de performance para public.investment_transactions
CREATE INDEX IF NOT EXISTS idx_investment_transactions_space_investment ON public.investment_transactions(space_id, investment_id);

-- Trigger de updated_at e imutabilidade de created_by para public.investment_transactions
CREATE OR REPLACE FUNCTION public.handle_investment_transactions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    -- Proteção de autoria: created_by é imutável após criação
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_investment_transactions_updated_at ON public.investment_transactions;
CREATE TRIGGER trg_investment_transactions_updated_at
    BEFORE UPDATE ON public.investment_transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_investment_transactions_updated_at();

-- Habilitação de RLS para public.investment_transactions
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para public.investment_transactions
DROP POLICY IF EXISTS "Membros podem visualizar movimentações do espaço" ON public.investment_transactions;
CREATE POLICY "Membros podem visualizar movimentações do espaço"
ON public.investment_transactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.investments i
        WHERE i.id = investment_transactions.investment_id
          AND i.space_id = investment_transactions.space_id
    )
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = investment_transactions.space_id
              AND space_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = investment_transactions.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem inserir movimentações no espaço" ON public.investment_transactions;
CREATE POLICY "Membros autorizados podem inserir movimentações no espaço"
ON public.investment_transactions FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM public.investments i
        WHERE i.id = investment_transactions.investment_id
          AND i.space_id = investment_transactions.space_id
    )
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = investment_transactions.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = investment_transactions.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar movimentações do espaço" ON public.investment_transactions;
CREATE POLICY "Membros autorizados podem atualizar movimentações do espaço"
ON public.investment_transactions FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.investments i
        WHERE i.id = investment_transactions.investment_id
          AND i.space_id = investment_transactions.space_id
    )
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = investment_transactions.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = investment_transactions.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.investments i
        WHERE i.id = investment_transactions.investment_id
          AND i.space_id = investment_transactions.space_id
    )
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = investment_transactions.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = investment_transactions.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir movimentações do espaço" ON public.investment_transactions;
CREATE POLICY "Membros autorizados podem excluir movimentações do espaço"
ON public.investment_transactions FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.investments i
        WHERE i.id = investment_transactions.investment_id
          AND i.space_id = investment_transactions.space_id
    )
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = investment_transactions.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = investment_transactions.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

-- ------------------------------------------------------------------------------
-- 3. PERMISSÕES EXPLÍCITAS DAS TABELAS (MENOR PRIVILÉGIO)
-- ------------------------------------------------------------------------------
REVOKE ALL ON TABLE public.investments FROM PUBLIC;
REVOKE ALL ON TABLE public.investments FROM anon;

REVOKE ALL ON TABLE public.investment_transactions FROM PUBLIC;
REVOKE ALL ON TABLE public.investment_transactions FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.investments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.investment_transactions TO authenticated;
