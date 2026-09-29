// POUPAGAIO FINANCE — ETAPA 3.3 SQL MIGRATION FOR FIXED & VARIABLE EXPENSES
export const SUPABASE_EXPENSES_MIGRATION_SQL = `-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.3: GASTOS FIXOS E GASTOS VARIÁVEIS (MIGRATION)
-- Criação das tabelas:
--   1. public.fixed_expenses (Definição dos gastos fixos recorrentes)
--   2. public.fixed_expense_payments (Pagamentos por competência mensal)
--   3. public.variable_expenses (Gastos variáveis pontuais)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE GASTOS FIXOS (public.fixed_expenses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixed_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
    due_month INTEGER, -- NULL para mensal; 1 a 12 para anual
    category TEXT NOT NULL DEFAULT 'Outros',
    recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'yearly')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Garantia de unicidade composta para possibilitar chave estrangeira composta de integridade
    CONSTRAINT uq_fixed_expenses_id_space UNIQUE (id, space_id),
    -- Regra de consistência para recorrência mensal/anual
    CONSTRAINT chk_fixed_expenses_recurrence CHECK (
        (recurrence = 'monthly' AND due_month IS NULL) OR
        (recurrence = 'yearly' AND due_month IS NOT NULL AND due_month >= 1 AND due_month <= 12)
    )
);

-- Índices de performance para fixed_expenses
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_space_id ON public.fixed_expenses(space_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_due_day ON public.fixed_expenses(due_day);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_due_month ON public.fixed_expenses(due_month);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_created_by ON public.fixed_expenses(created_by);

-- Trigger de updated_at para fixed_expenses (SECURITY INVOKER - menor privilégio)
CREATE OR REPLACE FUNCTION public.handle_fixed_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fixed_expenses_updated_at ON public.fixed_expenses;
CREATE TRIGGER trg_fixed_expenses_updated_at
    BEFORE UPDATE ON public.fixed_expenses
    FOR EACH ROW EXECUTE FUNCTION public.handle_fixed_expenses_updated_at();

-- Habilitação de RLS para fixed_expenses
ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fixed_expenses (baseadas em EXISTS direto em space_members e spaces)
DROP POLICY IF EXISTS "Membros podem visualizar gastos fixos do espaço" ON public.fixed_expenses;
CREATE POLICY "Membros podem visualizar gastos fixos do espaço"
ON public.fixed_expenses FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expenses.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar gastos fixos no espaço" ON public.fixed_expenses;
CREATE POLICY "Membros autorizados podem criar gastos fixos no espaço"
ON public.fixed_expenses FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar gastos fixos do espaço" ON public.fixed_expenses;
CREATE POLICY "Membros autorizados podem atualizar gastos fixos do espaço"
ON public.fixed_expenses FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir gastos fixos do espaço" ON public.fixed_expenses;
CREATE POLICY "Membros autorizados podem excluir gastos fixos do espaço"
ON public.fixed_expenses FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE PAGAMENTOS DE GASTOS FIXOS POR COMPETÊNCIA (public.fixed_expense_payments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixed_expense_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_expense_id UUID NOT NULL,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    billing_cycle VARCHAR(7) NOT NULL, -- Exemplo: '2026-09'
    paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Integridade relacional estrita: impede fixed_expense_id de um espaço com space_id de outro
    CONSTRAINT fk_fep_fixed_expense_space
        FOREIGN KEY (fixed_expense_id, space_id)
        REFERENCES public.fixed_expenses (id, space_id)
        ON DELETE CASCADE,
    -- Validação de formato da competência: estritamente YYYY-MM (01 a 12)
    CONSTRAINT chk_fep_billing_cycle_format
        CHECK (billing_cycle ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    -- Impede pagamento duplicado da mesma despesa na mesma competência
    CONSTRAINT uq_fixed_expense_billing_cycle
        UNIQUE (fixed_expense_id, billing_cycle)
);

-- Índices de performance para fixed_expense_payments
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_space_id ON public.fixed_expense_payments(space_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_fixed_expense_id ON public.fixed_expense_payments(fixed_expense_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_billing_cycle ON public.fixed_expense_payments(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_fixed_expense_payments_space_cycle ON public.fixed_expense_payments(space_id, billing_cycle);

-- Trigger de updated_at para fixed_expense_payments (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.handle_fixed_expense_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fixed_expense_payments_updated_at ON public.fixed_expense_payments;
CREATE TRIGGER trg_fixed_expense_payments_updated_at
    BEFORE UPDATE ON public.fixed_expense_payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_fixed_expense_payments_updated_at();

-- Habilitação de RLS para fixed_expense_payments
ALTER TABLE public.fixed_expense_payments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fixed_expense_payments
DROP POLICY IF EXISTS "Membros podem visualizar pagamentos de gastos fixos do espaço" ON public.fixed_expense_payments;
CREATE POLICY "Membros podem visualizar pagamentos de gastos fixos do espaço"
ON public.fixed_expense_payments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expense_payments.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expense_payments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem registrar pagamento de gasto fixo" ON public.fixed_expense_payments;
CREATE POLICY "Membros autorizados podem registrar pagamento de gasto fixo"
ON public.fixed_expense_payments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expense_payments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expense_payments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar pagamento de gasto fixo" ON public.fixed_expense_payments;
CREATE POLICY "Membros autorizados podem atualizar pagamento de gasto fixo"
ON public.fixed_expense_payments FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expense_payments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expense_payments.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expense_payments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expense_payments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem remover pagamento de gasto fixo" ON public.fixed_expense_payments;
CREATE POLICY "Membros autorizados podem remover pagamento de gasto fixo"
ON public.fixed_expense_payments FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = fixed_expense_payments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = fixed_expense_payments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 3. TABELA DE GASTOS VARIÁVEIS (public.variable_expenses)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.variable_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL DEFAULT 'Outros',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de performance para variable_expenses
CREATE INDEX IF NOT EXISTS idx_variable_expenses_space_id ON public.variable_expenses(space_id);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_date ON public.variable_expenses(date);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_status ON public.variable_expenses(status);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_space_date ON public.variable_expenses(space_id, date);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_created_by ON public.variable_expenses(created_by);

-- Trigger de updated_at para variable_expenses (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.handle_variable_expenses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variable_expenses_updated_at ON public.variable_expenses;
CREATE TRIGGER trg_variable_expenses_updated_at
    BEFORE UPDATE ON public.variable_expenses
    FOR EACH ROW EXECUTE FUNCTION public.handle_variable_expenses_updated_at();

-- Habilitação de RLS para variable_expenses
ALTER TABLE public.variable_expenses ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para variable_expenses
DROP POLICY IF EXISTS "Membros podem visualizar gastos variáveis do espaço" ON public.variable_expenses;
CREATE POLICY "Membros podem visualizar gastos variáveis do espaço"
ON public.variable_expenses FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = variable_expenses.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = variable_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar gastos variáveis no espaço" ON public.variable_expenses;
CREATE POLICY "Membros autorizados podem criar gastos variáveis no espaço"
ON public.variable_expenses FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = variable_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = variable_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar gastos variáveis do espaço" ON public.variable_expenses;
CREATE POLICY "Membros autorizados podem atualizar gastos variáveis do espaço"
ON public.variable_expenses FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = variable_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = variable_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = variable_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = variable_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir gastos variáveis do espaço" ON public.variable_expenses;
CREATE POLICY "Membros autorizados podem excluir gastos variáveis do espaço"
ON public.variable_expenses FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = variable_expenses.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = variable_expenses.space_id
          AND spaces.owner_id = auth.uid()
    )
);
`;
