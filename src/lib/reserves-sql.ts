// ==============================================================================
// POUPAGAIO FINANCE — MÓDULO DE RESERVAS FINANCEIRAS / CAIXINHAS (SQL MIGRATION)
// REVISÃO DE INTEGRIDADE, CONCORRÊNCIA, IDEMPOTÊNCIA E RPCs TRANSACIONAIS
// ==============================================================================

export const RESERVES_MIGRATION_SQL = `-- ==============================================================================
-- POUPAGAIO FINANCE — MÓDULO DE RESERVAS FINANCEIRAS / CAIXINHAS (MIGRATION HARDENED)
-- Estrutura:
--   1. public.reserves (Definição, saldo, arquivamento e integridade)
--   2. public.reserve_transactions (Histórico/extrato com operation_id e FKs compostas)
--   3. public.expense_payment_sources (Origens de pagamento estritas com FKs compostas)
--   4. Índices únicos, constraints e regras de concorrência / idempotência
--   5. RPCs transacionais com bloqueio pessimista (SELECT ... FOR UPDATE)
-- ==============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABELA DE RESERVAS (public.reserves)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reserves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount >= 0),
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
    billing_cycle TEXT NOT NULL,
    category TEXT,
    icon TEXT DEFAULT '💰',
    color TEXT DEFAULT '#16A66A',
    renew_monthly BOOLEAN NOT NULL DEFAULT true,
    is_preferred BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Integridade composta: chave única para FKs compostas por espaço
    CONSTRAINT uq_reserves_id_space UNIQUE (id, space_id),
    -- Formato estrito de competência YYYY-MM
    CONSTRAINT chk_reserves_billing_cycle CHECK (billing_cycle ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

-- Índices de consulta e integridade
CREATE INDEX IF NOT EXISTS idx_reserves_space_id ON public.reserves(space_id);
CREATE INDEX IF NOT EXISTS idx_reserves_billing_cycle ON public.reserves(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_reserves_category ON public.reserves(category);
CREATE INDEX IF NOT EXISTS idx_reserves_space_cycle ON public.reserves(space_id, billing_cycle);
CREATE INDEX IF NOT EXISTS idx_reserves_archived ON public.reserves(is_archived);

-- Unicidade de Reserva Preferencial por categoria dentro da mesma competência e espaço
CREATE UNIQUE INDEX IF NOT EXISTS uq_reserves_preferred_category 
ON public.reserves (space_id, billing_cycle, category) 
WHERE is_preferred = true AND is_archived = false AND category IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_reserves_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserves_updated_at ON public.reserves;
CREATE TRIGGER trg_reserves_updated_at
    BEFORE UPDATE ON public.reserves
    FOR EACH ROW EXECUTE FUNCTION public.handle_reserves_updated_at();

-- Habilitação de RLS
ALTER TABLE public.reserves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar reservas do espaco" ON public.reserves;
CREATE POLICY "Membros podem visualizar reservas do espaco"
ON public.reserves FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = reserves.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = reserves.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar reservas no espaco" ON public.reserves;
CREATE POLICY "Membros autorizados podem criar reservas no espaco"
ON public.reserves FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = reserves.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = reserves.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar reservas do espaco" ON public.reserves;
CREATE POLICY "Membros autorizados podem atualizar reservas do espaco"
ON public.reserves FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = reserves.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = reserves.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir reservas do espaco" ON public.reserves;
CREATE POLICY "Membros autorizados podem excluir reservas do espaco"
ON public.reserves FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = reserves.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = reserves.space_id
          AND spaces.owner_id = auth.uid()
    )
);


-- ------------------------------------------------------------------------------
-- 2. TABELA DE TRANSAÇÕES DE RESERVAS (public.reserve_transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reserve_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    reserve_id UUID NOT NULL,
    space_id UUID NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('initial_allocation', 'deposit', 'withdraw', 'expense_payment', 'transfer_in', 'transfer_out', 'refund')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    previous_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (previous_balance >= 0),
    new_balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (new_balance >= 0),
    source_description TEXT NOT NULL,
    related_expense_type TEXT CHECK (related_expense_type IN ('fixed', 'variable', 'installment')),
    related_expense_id UUID,
    related_reserve_id UUID,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Integridade referencial estrita entre espaços: FK composta
    CONSTRAINT fk_rt_reserve_space FOREIGN KEY (reserve_id, space_id)
        REFERENCES public.reserves(id, space_id) ON DELETE RESTRICT,
    CONSTRAINT fk_rt_related_reserve_space FOREIGN KEY (related_reserve_id, space_id)
        REFERENCES public.reserves(id, space_id) ON DELETE RESTRICT,
    -- Idempotência: impede registro duplicado da mesma operação e tipo na mesma reserva
    CONSTRAINT uq_rt_operation_reserve_type UNIQUE (operation_id, reserve_id, type)
);

CREATE INDEX IF NOT EXISTS idx_reserve_transactions_operation_id ON public.reserve_transactions(operation_id);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_reserve_id ON public.reserve_transactions(reserve_id);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_space_id ON public.reserve_transactions(space_id);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_date ON public.reserve_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_type ON public.reserve_transactions(type);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_expense ON public.reserve_transactions(related_expense_type, related_expense_id);

ALTER TABLE public.reserve_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar transacoes de reservas" ON public.reserve_transactions;
CREATE POLICY "Membros podem visualizar transacoes de reservas"
ON public.reserve_transactions FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = reserve_transactions.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = reserve_transactions.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar transacoes de reservas" ON public.reserve_transactions;
CREATE POLICY "Membros autorizados podem criar transacoes de reservas"
ON public.reserve_transactions FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = reserve_transactions.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = reserve_transactions.space_id
          AND spaces.owner_id = auth.uid()
    )
);


-- ------------------------------------------------------------------------------
-- 3. TABELA DE ORIGEM DE PAGAMENTO DE DESPESAS (public.expense_payment_sources)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_payment_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL,
    expense_type TEXT NOT NULL CHECK (expense_type IN ('fixed', 'variable', 'installment')),
    expense_id UUID NOT NULL,
    payment_id UUID,
    reserve_id UUID,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    is_free_balance BOOLEAN NOT NULL DEFAULT false,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Integridade referencial estrita por espaço: FK composta
    CONSTRAINT fk_eps_reserve_space FOREIGN KEY (reserve_id, space_id)
        REFERENCES public.reserves(id, space_id) ON DELETE RESTRICT,
    -- Origem estrita: exatamente UMA origem (Saldo Livre OU Reserva)
    CONSTRAINT chk_eps_single_origin CHECK (
        (is_free_balance = true AND reserve_id IS NULL)
        OR
        (is_free_balance = false AND reserve_id IS NOT NULL)
    )
);

-- Índice único para idempotência de origens de pagamento
CREATE UNIQUE INDEX IF NOT EXISTS uq_eps_operation_source 
ON public.expense_payment_sources(operation_id, is_free_balance, COALESCE(reserve_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_expense_payment_sources_operation ON public.expense_payment_sources(operation_id);
CREATE INDEX IF NOT EXISTS idx_expense_payment_sources_space ON public.expense_payment_sources(space_id);
CREATE INDEX IF NOT EXISTS idx_expense_payment_sources_expense ON public.expense_payment_sources(expense_id, expense_type);
CREATE INDEX IF NOT EXISTS idx_expense_payment_sources_reserve ON public.expense_payment_sources(reserve_id);

ALTER TABLE public.expense_payment_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar origens de pagamento" ON public.expense_payment_sources;
CREATE POLICY "Membros podem visualizar origens de pagamento"
ON public.expense_payment_sources FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = expense_payment_sources.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = expense_payment_sources.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem inserir origens de pagamento" ON public.expense_payment_sources;
CREATE POLICY "Membros autorizados podem inserir origens de pagamento"
ON public.expense_payment_sources FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = expense_payment_sources.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = expense_payment_sources.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem deletar origens de pagamento" ON public.expense_payment_sources;
CREATE POLICY "Membros autorizados podem deletar origens de pagamento"
ON public.expense_payment_sources FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = expense_payment_sources.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = expense_payment_sources.space_id
          AND spaces.owner_id = auth.uid()
    )
);


-- ==============================================================================
-- 4. FUNÇÕES DE SEGURANÇA E AUTORIZAÇÃO AUXILIARES PARA RPCs
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_user_space_permission(p_space_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = p_space_id
          AND user_id = p_user_id
          AND role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE id = p_space_id
          AND owner_id = p_user_id
    );
END;
$$;


-- ==============================================================================
-- 5. RPC: CRIAR RESERVA (create_reserve)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_create_reserve(
    p_space_id UUID,
    p_name TEXT,
    p_allocated_amount NUMERIC,
    p_billing_cycle TEXT,
    p_category TEXT DEFAULT NULL,
    p_icon TEXT DEFAULT '💰',
    p_color TEXT DEFAULT '#16A66A',
    p_renew_monthly BOOLEAN DEFAULT true,
    p_is_preferred BOOLEAN DEFAULT false,
    p_notes TEXT DEFAULT NULL,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reserve public.reserves%ROWTYPE;
    v_existing_tx public.reserve_transactions%ROWTYPE;
BEGIN
    -- 1. Autorização
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    -- 2. Idempotência: verificar se operation_id já foi executado
    SELECT * INTO v_existing_tx FROM public.reserve_transactions 
    WHERE operation_id = p_operation_id AND type = 'initial_allocation'
    LIMIT 1;

    IF FOUND THEN
        SELECT * INTO v_reserve FROM public.reserves WHERE id = v_existing_tx.reserve_id;
        RETURN to_jsonb(v_reserve);
    END IF;

    -- 3. Inserção da Reserva
    INSERT INTO public.reserves (
        space_id,
        created_by,
        name,
        allocated_amount,
        current_balance,
        billing_cycle,
        category,
        icon,
        color,
        renew_monthly,
        is_preferred,
        notes
    ) VALUES (
        p_space_id,
        v_user_id,
        TRIM(p_name),
        p_allocated_amount,
        p_allocated_amount,
        p_billing_cycle,
        p_category,
        p_icon,
        p_color,
        p_renew_monthly,
        p_is_preferred,
        TRIM(p_notes)
    ) RETURNING * INTO v_reserve;

    -- 4. Registro da transação inicial vinculada ao operation_id
    INSERT INTO public.reserve_transactions (
        operation_id,
        reserve_id,
        space_id,
        created_by,
        type,
        amount,
        previous_balance,
        new_balance,
        source_description,
        transaction_date
    ) VALUES (
        p_operation_id,
        v_reserve.id,
        v_reserve.space_id,
        v_user_id,
        'initial_allocation',
        p_allocated_amount,
        0,
        p_allocated_amount,
        'Criação da Reserva / Valor Inicial',
        CURRENT_DATE
    );

    RETURN to_jsonb(v_reserve);
END;
$$;


-- ==============================================================================
-- 6. RPC: APORTE / ADICIONAR DINHEIRO (deposit_to_reserve)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_deposit_to_reserve(
    p_reserve_id UUID,
    p_space_id UUID,
    p_amount NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reserve public.reserves%ROWTYPE;
    v_prev_bal NUMERIC;
    v_new_bal NUMERIC;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor do aporte deve ser maior que zero.';
    END IF;

    -- Idempotência
    IF EXISTS (SELECT 1 FROM public.reserve_transactions WHERE operation_id = p_operation_id AND type = 'deposit') THEN
        SELECT * INTO v_reserve FROM public.reserves WHERE id = p_reserve_id AND space_id = p_space_id;
        RETURN to_jsonb(v_reserve);
    END IF;

    -- Bloqueio pessimista de linha (FOR UPDATE)
    SELECT * INTO v_reserve FROM public.reserves
    WHERE id = p_reserve_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reserva não encontrada no espaço informado.';
    END IF;

    IF v_reserve.is_archived THEN
        RAISE EXCEPTION 'Não é permitido realizar aportes em reservas arquivadas.';
    END IF;

    v_prev_bal := v_reserve.current_balance;
    v_new_bal := v_prev_bal + p_amount;

    -- Atualiza saldo da reserva
    UPDATE public.reserves
    SET current_balance = v_new_bal,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_reserve_id AND space_id = p_space_id
    RETURNING * INTO v_reserve;

    -- Registra transação
    INSERT INTO public.reserve_transactions (
        operation_id,
        reserve_id,
        space_id,
        created_by,
        type,
        amount,
        previous_balance,
        new_balance,
        source_description,
        transaction_date,
        notes
    ) VALUES (
        p_operation_id,
        p_reserve_id,
        p_space_id,
        v_user_id,
        'deposit',
        p_amount,
        v_prev_bal,
        v_new_bal,
        'Aporte de Saldo Livre',
        p_date,
        TRIM(p_notes)
    );

    RETURN to_jsonb(v_reserve);
END;
$$;


-- ==============================================================================
-- 7. RPC: RETIRADA / DEVOLVER PARA SALDO LIVRE (withdraw_from_reserve)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_withdraw_from_reserve(
    p_reserve_id UUID,
    p_space_id UUID,
    p_amount NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reserve public.reserves%ROWTYPE;
    v_prev_bal NUMERIC;
    v_new_bal NUMERIC;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor de retirada deve ser maior que zero.';
    END IF;

    -- Idempotência
    IF EXISTS (SELECT 1 FROM public.reserve_transactions WHERE operation_id = p_operation_id AND type = 'withdraw') THEN
        SELECT * INTO v_reserve FROM public.reserves WHERE id = p_reserve_id AND space_id = p_space_id;
        RETURN to_jsonb(v_reserve);
    END IF;

    -- Bloqueio pessimista de linha (FOR UPDATE)
    SELECT * INTO v_reserve FROM public.reserves
    WHERE id = p_reserve_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reserva não encontrada no espaço informado.';
    END IF;

    v_prev_bal := v_reserve.current_balance;
    IF p_amount > v_prev_bal THEN
        RAISE EXCEPTION 'Saldo insuficiente na reserva. Saldo atual: R$ %', v_prev_bal;
    END IF;

    v_new_bal := v_prev_bal - p_amount;

    -- Atualiza saldo da reserva
    UPDATE public.reserves
    SET current_balance = v_new_bal,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_reserve_id AND space_id = p_space_id
    RETURNING * INTO v_reserve;

    -- Registra transação
    INSERT INTO public.reserve_transactions (
        operation_id,
        reserve_id,
        space_id,
        created_by,
        type,
        amount,
        previous_balance,
        new_balance,
        source_description,
        transaction_date,
        notes
    ) VALUES (
        p_operation_id,
        p_reserve_id,
        p_space_id,
        v_user_id,
        'withdraw',
        p_amount,
        v_prev_bal,
        v_new_bal,
        'Retirada para Saldo Livre',
        p_date,
        TRIM(p_notes)
    );

    RETURN to_jsonb(v_reserve);
END;
$$;


-- ==============================================================================
-- 8. RPC: TRANSFERÊNCIA ENTRE RESERVAS (transfer_between_reserves)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_transfer_between_reserves(
    p_from_reserve_id UUID,
    p_to_reserve_id UUID,
    p_space_id UUID,
    p_amount NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_from_res public.reserves%ROWTYPE;
    v_to_res public.reserves%ROWTYPE;
    v_from_prev NUMERIC;
    v_from_new NUMERIC;
    v_to_prev NUMERIC;
    v_to_new NUMERIC;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    IF p_from_reserve_id = p_to_reserve_id THEN
        RAISE EXCEPTION 'A reserva de origem e de destino devem ser distintas.';
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor da transferência deve ser maior que zero.';
    END IF;

    -- Idempotência
    IF EXISTS (SELECT 1 FROM public.reserve_transactions WHERE operation_id = p_operation_id) THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    -- Bloqueio ordenado por UUID para evitar deadlocks
    IF p_from_reserve_id < p_to_reserve_id THEN
        SELECT * INTO v_from_res FROM public.reserves WHERE id = p_from_reserve_id AND space_id = p_space_id FOR UPDATE;
        SELECT * INTO v_to_res FROM public.reserves WHERE id = p_to_reserve_id AND space_id = p_space_id FOR UPDATE;
    ELSE
        SELECT * INTO v_to_res FROM public.reserves WHERE id = p_to_reserve_id AND space_id = p_space_id FOR UPDATE;
        SELECT * INTO v_from_res FROM public.reserves WHERE id = p_from_reserve_id AND space_id = p_space_id FOR UPDATE;
    END IF;

    IF v_from_res.id IS NULL OR v_to_res.id IS NULL THEN
        RAISE EXCEPTION 'Uma ou ambas as reservas não foram localizadas no espaço.';
    END IF;

    IF v_from_res.is_archived OR v_to_res.is_archived THEN
        RAISE EXCEPTION 'Não é permitido realizar transferências com reservas arquivadas.';
    END IF;

    v_from_prev := v_from_res.current_balance;
    IF p_amount > v_from_prev THEN
        RAISE EXCEPTION 'Saldo insuficiente na reserva de origem "%". Disponível: R$ %', v_from_res.name, v_from_prev;
    END IF;

    v_from_new := v_from_prev - p_amount;
    v_to_prev := v_to_res.current_balance;
    v_to_new := v_to_prev + p_amount;

    -- Atualiza ambas as reservas
    UPDATE public.reserves SET current_balance = v_from_new, updated_at = timezone('utc'::text, now()) WHERE id = v_from_res.id;
    UPDATE public.reserves SET current_balance = v_to_new, updated_at = timezone('utc'::text, now()) WHERE id = v_to_res.id;

    -- Transação Débito (transfer_out)
    INSERT INTO public.reserve_transactions (
        operation_id,
        reserve_id,
        space_id,
        created_by,
        type,
        amount,
        previous_balance,
        new_balance,
        source_description,
        related_reserve_id,
        transaction_date,
        notes
    ) VALUES (
        p_operation_id,
        v_from_res.id,
        p_space_id,
        v_user_id,
        'transfer_out',
        p_amount,
        v_from_prev,
        v_from_new,
        'Transferência enviada para "' || v_to_res.name || '"',
        v_to_res.id,
        p_date,
        TRIM(p_notes)
    );

    -- Transação Crédito (transfer_in)
    INSERT INTO public.reserve_transactions (
        operation_id,
        reserve_id,
        space_id,
        created_by,
        type,
        amount,
        previous_balance,
        new_balance,
        source_description,
        related_reserve_id,
        transaction_date,
        notes
    ) VALUES (
        p_operation_id,
        v_to_res.id,
        p_space_id,
        v_user_id,
        'transfer_in',
        p_amount,
        v_to_prev,
        v_to_new,
        'Transferência recebida de "' || v_from_res.name || '"',
        v_from_res.id,
        p_date,
        TRIM(p_notes)
    );

    RETURN jsonb_build_object(
        'success', true,
        'from_reserve_balance', v_from_new,
        'to_reserve_balance', v_to_new
    );
END;
$$;


-- ==============================================================================
-- 9. RPC: PAGAMENTO DE DESPESA A PARTIR DE ORIGENS (pay_expense_from_sources)
-- Suporta: Saldo Livre, Reserva única ou Pagamento Dividido (Split)
-- Executa atomicamente validação, bloqueio, débitos, fontes e confirmação da despesa
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_pay_expense_from_sources(
    p_space_id UUID,
    p_expense_type TEXT,
    p_expense_id UUID,
    p_total_amount NUMERIC,
    p_payment_date DATE,
    p_sources JSONB,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_src JSONB;
    v_src_reserve_id UUID;
    v_src_amount NUMERIC;
    v_src_is_free BOOLEAN;
    v_sum_sources NUMERIC := 0;
    v_reserve public.reserves%ROWTYPE;
    v_prev_bal NUMERIC;
    v_new_bal NUMERIC;
    v_billing_cycle TEXT;
    v_desc TEXT;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    IF p_total_amount <= 0 THEN
        RAISE EXCEPTION 'O valor da despesa deve ser maior que zero.';
    END IF;

    -- Idempotência: verificar se este operation_id já foi liquidado
    IF EXISTS (SELECT 1 FROM public.expense_payment_sources WHERE operation_id = p_operation_id) THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true);
    END IF;

    -- 1. Validação da soma das origens fornecidas no JSON
    FOR v_src IN SELECT * FROM jsonb_array_elements(p_sources)
    LOOP
        v_src_amount := (v_src->>'amount')::NUMERIC;
        IF v_src_amount <= 0 THEN
            RAISE EXCEPTION 'Valor de origem inválido no pagamento (deve ser positivo).';
        END IF;
        v_sum_sources := v_sum_sources + v_src_amount;
    END LOOP;

    IF ABS(v_sum_sources - p_total_amount) > 0.009 THEN
        RAISE EXCEPTION 'A soma das origens (R$ %) não corresponde ao valor da despesa (R$ %).', v_sum_sources, p_total_amount;
    END IF;

    -- 2. Processamento das origens
    FOR v_src IN SELECT * FROM jsonb_array_elements(p_sources)
    LOOP
        v_src_is_free := COALESCE((v_src->>'is_free_balance')::BOOLEAN, false);
        v_src_amount := (v_src->>'amount')::NUMERIC;
        
        IF v_src->>'reserve_id' IS NOT NULL AND TRIM(v_src->>'reserve_id') <> '' THEN
            v_src_reserve_id := (v_src->>'reserve_id')::UUID;
        ELSE
            v_src_reserve_id := NULL;
        END IF;

        IF v_src_is_free THEN
            -- Saldo Livre: Registra fonte de pagamento
            INSERT INTO public.expense_payment_sources (
                operation_id,
                space_id,
                expense_type,
                expense_id,
                reserve_id,
                amount,
                is_free_balance,
                payment_date
            ) VALUES (
                p_operation_id,
                p_space_id,
                p_expense_type,
                p_expense_id,
                NULL,
                v_src_amount,
                true,
                p_payment_date
            );
        ELSE
            IF v_src_reserve_id IS NULL THEN
                RAISE EXCEPTION 'ID da reserva não informado para origem que não é Saldo Livre.';
            END IF;

            -- Bloqueio pessimista da reserva
            SELECT * INTO v_reserve FROM public.reserves
            WHERE id = v_src_reserve_id AND space_id = p_space_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Reserva selecionada não encontrada no espaço.';
            END IF;

            IF v_reserve.is_archived THEN
                RAISE EXCEPTION 'Não é permitido pagar despesas com reserva arquivada.';
            END IF;

            v_prev_bal := v_reserve.current_balance;
            IF v_src_amount > v_prev_bal THEN
                RAISE EXCEPTION 'Saldo insuficiente na reserva "%". Disponível: R$ %, Necessário: R$ %',
                    v_reserve.name, v_prev_bal, v_src_amount;
            END IF;

            v_new_bal := v_prev_bal - v_src_amount;

            -- Deduz saldo da reserva
            UPDATE public.reserves
            SET current_balance = v_new_bal,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_src_reserve_id;

            -- Registra extrato na reserva
            INSERT INTO public.reserve_transactions (
                operation_id,
                reserve_id,
                space_id,
                created_by,
                type,
                amount,
                previous_balance,
                new_balance,
                source_description,
                related_expense_type,
                related_expense_id,
                transaction_date
            ) VALUES (
                p_operation_id,
                v_src_reserve_id,
                p_space_id,
                v_user_id,
                'expense_payment',
                v_src_amount,
                v_prev_bal,
                v_new_bal,
                'Pagamento de despesa (' || p_expense_type || ')',
                p_expense_type,
                p_expense_id,
                p_payment_date
            );

            -- Registra fonte de pagamento
            INSERT INTO public.expense_payment_sources (
                operation_id,
                space_id,
                expense_type,
                expense_id,
                reserve_id,
                amount,
                is_free_balance,
                payment_date
            ) VALUES (
                p_operation_id,
                p_space_id,
                p_expense_type,
                p_expense_id,
                v_src_reserve_id,
                v_src_amount,
                false,
                p_payment_date
            );
        END IF;
    END LOOP;

    -- 3. Confirmação do pagamento na tabela da despesa correspondente
    v_billing_cycle := to_char(p_payment_date, 'YYYY-MM');

    IF p_expense_type = 'fixed' THEN
        INSERT INTO public.fixed_expense_payments (
            fixed_expense_id,
            space_id,
            billing_cycle,
            paid_at,
            amount_paid,
            created_by
        ) VALUES (
            p_expense_id,
            p_space_id,
            v_billing_cycle,
            p_payment_date,
            p_total_amount,
            v_user_id
        )
        ON CONFLICT (fixed_expense_id, billing_cycle) 
        DO UPDATE SET paid_at = EXCLUDED.paid_at, amount_paid = EXCLUDED.amount_paid;

    ELSIF p_expense_type = 'variable' THEN
        UPDATE public.variable_expenses
        SET status = 'paid',
            date = p_payment_date,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_expense_id AND space_id = p_space_id;

    ELSIF p_expense_type = 'installment' THEN
        UPDATE public.installments
        SET status = 'paid',
            paid_at = p_payment_date,
            paid_by = v_user_id,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_expense_id AND space_id = p_space_id;
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;


-- ==============================================================================
-- 10. RPC: ESTORNO TOTAL DE PAGAMENTO (refund_expense_payment)
-- Devolve dinheiro para as reservas utilizadas e desmarca status de pago da despesa
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_refund_expense_payment(
    p_expense_type TEXT,
    p_expense_id UUID,
    p_space_id UUID,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_src RECORD;
    v_reserve public.reserves%ROWTYPE;
    v_prev_bal NUMERIC;
    v_new_bal NUMERIC;
    v_total_refunded NUMERIC := 0;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    -- Localiza todas as origens vinculadas a esta despesa
    FOR v_src IN 
        SELECT * FROM public.expense_payment_sources
        WHERE expense_type = p_expense_type
          AND expense_id = p_expense_id
          AND space_id = p_space_id
    LOOP
        IF NOT v_src.is_free_balance AND v_src.reserve_id IS NOT NULL THEN
            -- Bloqueia a reserva para devolver o saldo
            SELECT * INTO v_reserve FROM public.reserves
            WHERE id = v_src.reserve_id AND space_id = p_space_id
            FOR UPDATE;

            IF FOUND THEN
                v_prev_bal := v_reserve.current_balance;
                v_new_bal := v_prev_bal + v_src.amount;

                UPDATE public.reserves
                SET current_balance = v_new_bal,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_reserve.id;

                -- Registra transação de estorno auditável
                INSERT INTO public.reserve_transactions (
                    operation_id,
                    reserve_id,
                    space_id,
                    created_by,
                    type,
                    amount,
                    previous_balance,
                    new_balance,
                    source_description,
                    related_expense_type,
                    related_expense_id,
                    transaction_date
                ) VALUES (
                    p_operation_id,
                    v_reserve.id,
                    p_space_id,
                    v_user_id,
                    'refund',
                    v_src.amount,
                    v_prev_bal,
                    v_new_bal,
                    'Estorno por cancelamento/desmarcação de pagamento',
                    p_expense_type,
                    p_expense_id,
                    CURRENT_DATE
                );

                v_total_refunded := v_total_refunded + v_src.amount;
            END IF;
        END IF;
    END LOOP;

    -- Remove os registros de fontes de pagamento
    DELETE FROM public.expense_payment_sources
    WHERE expense_type = p_expense_type
      AND expense_id = p_expense_id
      AND space_id = p_space_id;

    -- Desmarca o pagamento na respectiva tabela da despesa
    IF p_expense_type = 'fixed' THEN
        DELETE FROM public.fixed_expense_payments
        WHERE fixed_expense_id = p_expense_id
          AND space_id = p_space_id;

    ELSIF p_expense_type = 'variable' THEN
        UPDATE public.variable_expenses
        SET status = 'pending',
            updated_at = timezone('utc'::text, now())
        WHERE id = p_expense_id AND space_id = p_space_id;

    ELSIF p_expense_type = 'installment' THEN
        UPDATE public.installments
        SET status = 'pending',
            paid_at = NULL,
            paid_by = NULL,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_expense_id AND space_id = p_space_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'refunded_amount', v_total_refunded);
END;
$$;


-- ==============================================================================
-- 11. RPC: EDIÇÃO DE VALOR DE DESPESA PAGA (adjust_expense_payment_amount)
-- Ajusta incrementalmente: se aumentou, debita a diferença; se diminuiu, devolve
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_adjust_expense_payment_amount(
    p_expense_type TEXT,
    p_expense_id UUID,
    p_space_id UUID,
    p_new_total_amount NUMERIC,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_current_sources_sum NUMERIC;
    v_diff NUMERIC;
    v_primary_src public.expense_payment_sources%ROWTYPE;
    v_reserve public.reserves%ROWTYPE;
    v_prev_bal NUMERIC;
    v_new_bal NUMERIC;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    SELECT SUM(amount) INTO v_current_sources_sum
    FROM public.expense_payment_sources
    WHERE expense_type = p_expense_type AND expense_id = p_expense_id AND space_id = p_space_id;

    IF v_current_sources_sum IS NULL OR v_current_sources_sum <= 0 THEN
        RAISE EXCEPTION 'Nenhuma origem de pagamento ativa encontrada para esta despesa.';
    END IF;

    v_diff := p_new_total_amount - v_current_sources_sum;

    IF ABS(v_diff) < 0.001 THEN
        RETURN jsonb_build_object('success', true, 'difference', 0);
    END IF;

    -- Localiza a fonte primária para ajustar o saldo
    SELECT * INTO v_primary_src
    FROM public.expense_payment_sources
    WHERE expense_type = p_expense_type AND expense_id = p_expense_id AND space_id = p_space_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_primary_src.is_free_balance THEN
        -- Origem Saldo Livre: apenas ajusta o montante na fonte
        UPDATE public.expense_payment_sources
        SET amount = amount + v_diff
        WHERE id = v_primary_src.id;
    ELSE
        -- Origem Reserva: Bloqueia e atualiza
        SELECT * INTO v_reserve FROM public.reserves
        WHERE id = v_primary_src.reserve_id AND space_id = p_space_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Reserva da origem não encontrada.';
        END IF;

        v_prev_bal := v_reserve.current_balance;

        IF v_diff > 0 THEN
            -- Aumento de despesa: débito adicional
            IF v_diff > v_prev_bal THEN
                RAISE EXCEPTION 'Saldo insuficiente na reserva "%" para o ajuste (+R$ %). Disponível: R$ %',
                    v_reserve.name, v_diff, v_prev_bal;
            END IF;
            v_new_bal := v_prev_bal - v_diff;

            UPDATE public.reserves SET current_balance = v_new_bal, updated_at = timezone('utc'::text, now()) WHERE id = v_reserve.id;

            INSERT INTO public.reserve_transactions (
                operation_id,
                reserve_id,
                space_id,
                created_by,
                type,
                amount,
                previous_balance,
                new_balance,
                source_description,
                related_expense_type,
                related_expense_id,
                transaction_date
            ) VALUES (
                p_operation_id,
                v_reserve.id,
                p_space_id,
                v_user_id,
                'expense_payment',
                v_diff,
                v_prev_bal,
                v_new_bal,
                'Ajuste de valor de despesa (+)',
                p_expense_type,
                p_expense_id,
                CURRENT_DATE
            );
        ELSE
            -- Redução de despesa: estorno da diferença (v_diff é negativo)
            v_new_bal := v_prev_bal + ABS(v_diff);

            UPDATE public.reserves SET current_balance = v_new_bal, updated_at = timezone('utc'::text, now()) WHERE id = v_reserve.id;

            INSERT INTO public.reserve_transactions (
                operation_id,
                reserve_id,
                space_id,
                created_by,
                type,
                amount,
                previous_balance,
                new_balance,
                source_description,
                related_expense_type,
                related_expense_id,
                transaction_date
            ) VALUES (
                p_operation_id,
                v_reserve.id,
                p_space_id,
                v_user_id,
                'refund',
                ABS(v_diff),
                v_prev_bal,
                v_new_bal,
                'Ajuste de valor de despesa (-)',
                p_expense_type,
                p_expense_id,
                CURRENT_DATE
            );
        END IF;

        UPDATE public.expense_payment_sources
        SET amount = amount + v_diff
        WHERE id = v_primary_src.id;
    END IF;

    -- Atualiza montante na tabela da despesa
    IF p_expense_type = 'fixed' THEN
        UPDATE public.fixed_expense_payments
        SET amount_paid = p_new_total_amount
        WHERE fixed_expense_id = p_expense_id AND space_id = p_space_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'difference', v_diff);
END;
$$;


-- ==============================================================================
-- 12. RPC: TROCA DE ORIGEM DE DESPESA PAGA (change_expense_payment_origin)
-- Estorna a origem anterior e aplica a nova origem atomicamente
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_change_expense_payment_origin(
    p_expense_type TEXT,
    p_expense_id UUID,
    p_space_id UUID,
    p_total_amount NUMERIC,
    p_payment_date DATE,
    p_new_sources JSONB,
    p_operation_id UUID DEFAULT gen_random_uuid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    -- 1. Estorna a origem anterior
    PERFORM public.rpc_refund_expense_payment(
        p_expense_type,
        p_expense_id,
        p_space_id,
        p_operation_id
    );

    -- 2. Paga com a nova origem
    RETURN public.rpc_pay_expense_from_sources(
        p_space_id,
        p_expense_type,
        p_expense_id,
        p_total_amount,
        p_payment_date,
        p_new_sources,
        p_operation_id
    );
END;
$$;


-- ==============================================================================
-- 13. RPC: ARQUIVAMENTO OU EXCLUSÃO DE RESERVA (archive_or_delete_reserve)
-- Se tiver transações, arquiva mantendo histórico; se não tiver, exclui
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_archive_or_delete_reserve(
    p_reserve_id UUID,
    p_space_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_reserve public.reserves%ROWTYPE;
    v_has_tx BOOLEAN;
BEGIN
    IF NOT public.check_user_space_permission(p_space_id, v_user_id) THEN
        RAISE EXCEPTION 'Acesso não autorizado ao espaço financeiro.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_reserve FROM public.reserves
    WHERE id = p_reserve_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reserva não encontrada.';
    END IF;

    -- Verifica se possui histórico de transações além da alocação inicial ou se foi movimentada
    SELECT EXISTS (
        SELECT 1 FROM public.reserve_transactions 
        WHERE reserve_id = p_reserve_id AND type NOT IN ('initial_allocation')
    ) OR EXISTS (
        SELECT 1 FROM public.expense_payment_sources
        WHERE reserve_id = p_reserve_id
    ) INTO v_has_tx;

    IF v_has_tx THEN
        -- Arquivamento lógico para preservar integridade contábil e extrato
        UPDATE public.reserves
        SET is_archived = true,
            archived_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = p_reserve_id;

        RETURN jsonb_build_object('success', true, 'action', 'archived');
    ELSE
        -- Sem histórico ativo de movimentações: remoção segura
        DELETE FROM public.reserve_transactions WHERE reserve_id = p_reserve_id;
        DELETE FROM public.reserves WHERE id = p_reserve_id;

        RETURN jsonb_build_object('success', true, 'action', 'deleted');
    END IF;
END;
$$;
`;
