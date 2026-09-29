-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.4: COMPRAS PARCELADAS E PARCELAS (MIGRATION)
-- Criação das tabelas:
--   1. public.installment_purchases (Definição da compra/obrigação parcelada)
--   2. public.installments (Parcelas individuais vinculadas à compra e ao mesmo espaço)
--   3. RPC transacional: public.create_installment_purchase(...)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE COMPRAS PARCELADAS (public.installment_purchases)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.installment_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    installment_count INTEGER NOT NULL CHECK (installment_count >= 2 AND installment_count <= 120),
    first_due_date DATE NOT NULL,
    category TEXT NOT NULL DEFAULT 'Outros',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Garantia de unicidade composta para viabilizar chave estrangeira composta de integridade
    CONSTRAINT uq_installment_purchases_id_space UNIQUE (id, space_id)
);

-- Índices de performance para installment_purchases
CREATE INDEX IF NOT EXISTS idx_installment_purchases_space_id ON public.installment_purchases(space_id);
CREATE INDEX IF NOT EXISTS idx_installment_purchases_first_due_date ON public.installment_purchases(first_due_date);
CREATE INDEX IF NOT EXISTS idx_installment_purchases_created_by ON public.installment_purchases(created_by);

-- Trigger de updated_at para installment_purchases (SECURITY INVOKER - menor privilégio)
CREATE OR REPLACE FUNCTION public.handle_installment_purchases_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installment_purchases_updated_at ON public.installment_purchases;
CREATE TRIGGER trg_installment_purchases_updated_at
    BEFORE UPDATE ON public.installment_purchases
    FOR EACH ROW EXECUTE FUNCTION public.handle_installment_purchases_updated_at();

-- Habilitação de RLS para installment_purchases
ALTER TABLE public.installment_purchases ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para installment_purchases (SELECT, INSERT, UPDATE com USING+WITH CHECK, DELETE)
DROP POLICY IF EXISTS "Membros podem visualizar compras parceladas do espaço" ON public.installment_purchases;
CREATE POLICY "Membros podem visualizar compras parceladas do espaço"
ON public.installment_purchases FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installment_purchases.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installment_purchases.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem criar compras parceladas no espaço" ON public.installment_purchases;
CREATE POLICY "Membros autorizados podem criar compras parceladas no espaço"
ON public.installment_purchases FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installment_purchases.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installment_purchases.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar compras parceladas do espaço" ON public.installment_purchases;
CREATE POLICY "Membros autorizados podem atualizar compras parceladas do espaço"
ON public.installment_purchases FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installment_purchases.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installment_purchases.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installment_purchases.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installment_purchases.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir compras parceladas do espaço" ON public.installment_purchases;
CREATE POLICY "Membros autorizados podem excluir compras parceladas do espaço"
ON public.installment_purchases FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installment_purchases.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installment_purchases.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE PARCELAS VINCULADAS (public.installments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL CHECK (installment_number >= 1),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_at DATE,
    paid_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    -- Integridade relacional estrita: impede parcela com space_id divergente da compra
    CONSTRAINT fk_installments_purchase_space
        FOREIGN KEY (purchase_id, space_id)
        REFERENCES public.installment_purchases (id, space_id)
        ON DELETE CASCADE,
    -- Unicidade estrita: impede duas parcelas com o mesmo número na mesma compra
    CONSTRAINT uq_installments_purchase_number
        UNIQUE (purchase_id, installment_number),
    -- Consistência do status de pagamento: status 'paid' exige paid_at; 'pending' exige paid_at NULL
    CONSTRAINT chk_installments_payment_status
        CHECK (
            (status = 'pending' AND paid_at IS NULL) OR
            (status = 'paid' AND paid_at IS NOT NULL)
        )
);

-- Índices de performance para installments
CREATE INDEX IF NOT EXISTS idx_installments_space_id ON public.installments(space_id);
CREATE INDEX IF NOT EXISTS idx_installments_purchase_id ON public.installments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_space_due_date ON public.installments(space_id, due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_paid_by ON public.installments(paid_by);

-- Trigger de updated_at para installments (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.handle_installments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installments_updated_at ON public.installments;
CREATE TRIGGER trg_installments_updated_at
    BEFORE UPDATE ON public.installments
    FOR EACH ROW EXECUTE FUNCTION public.handle_installments_updated_at();

-- Habilitação de RLS para installments
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para installments
DROP POLICY IF EXISTS "Membros podem visualizar parcelas do espaço" ON public.installments;
CREATE POLICY "Membros podem visualizar parcelas do espaço"
ON public.installments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installments.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem inserir parcelas no espaço" ON public.installments;
CREATE POLICY "Membros autorizados podem inserir parcelas no espaço"
ON public.installments FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar parcelas do espaço" ON public.installments;
CREATE POLICY "Membros autorizados podem atualizar parcelas do espaço"
ON public.installments FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installments.space_id
          AND spaces.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir parcelas do espaço" ON public.installments;
CREATE POLICY "Membros autorizados podem excluir parcelas do espaço"
ON public.installments FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = installments.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = installments.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO RPC TRANSACIONAL: public.create_installment_purchase
-- Garante criação atômica da compra e de todas as suas parcelas no PostgreSQL.
-- Trata arredondamento exato em centavos e preserva o dia base de vencimento.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_installment_purchase(
    p_space_id UUID,
    p_description TEXT,
    p_total_amount NUMERIC,
    p_installment_count INTEGER,
    p_first_due_date DATE,
    p_category TEXT DEFAULT 'Outros',
    p_notes TEXT DEFAULT NULL
)
RETURNS public.installment_purchases
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_is_authorized BOOLEAN;
    v_purchase public.installment_purchases;
    v_normalized_total NUMERIC(12, 2);
    v_total_cents BIGINT;
    v_base_cents BIGINT;
    v_remainder_cents BIGINT;
    v_installment_cents BIGINT;
    v_amount NUMERIC(12, 2);
    v_first_year INTEGER;
    v_first_month INTEGER;
    v_first_day INTEGER;
    v_month_idx INTEGER;
    v_target_year INTEGER;
    v_target_month INTEGER;
    v_last_day_of_month DATE;
    v_max_days INTEGER;
    v_actual_day INTEGER;
    v_due_date DATE;
    i INTEGER;
BEGIN
    -- 1. Obter usuário autenticado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- 2. Validar autorização no espaço (owner, admin ou member)
    SELECT EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = p_space_id
          AND space_members.user_id = v_user_id
          AND space_members.role IN ('owner', 'admin', 'member')
    ) OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = p_space_id
          AND spaces.owner_id = v_user_id
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Acesso negado: você não possui permissão para registrar compras neste espaço.'
            USING ERRCODE = '42501';
    END IF;

    -- 3. Validações dos parâmetros
    IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
        RAISE EXCEPTION 'A descrição da compra é obrigatória.';
    END IF;

    IF p_total_amount IS NULL THEN
        RAISE EXCEPTION 'O valor total da compra é obrigatório.';
    END IF;

    -- Normalização monetária para duas casas decimais
    v_normalized_total := round(p_total_amount, 2);

    IF v_normalized_total <= 0 THEN
        RAISE EXCEPTION 'O valor total da compra deve ser maior que zero.';
    END IF;

    IF p_installment_count IS NULL OR p_installment_count < 2 OR p_installment_count > 120 THEN
        RAISE EXCEPTION 'A quantidade de parcelas deve estar entre 2 e 120.';
    END IF;

    IF p_first_due_date IS NULL THEN
        RAISE EXCEPTION 'A data do primeiro vencimento é obrigatória.';
    END IF;

    -- 4. Inserir a compra parcelada com o valor normalizado
    INSERT INTO public.installment_purchases (
        space_id,
        created_by,
        description,
        total_amount,
        installment_count,
        first_due_date,
        category,
        notes
    ) VALUES (
        p_space_id,
        v_user_id,
        trim(p_description),
        v_normalized_total,
        p_installment_count,
        p_first_due_date,
        COALESCE(NULLIF(trim(p_category), ''), 'Outros'),
        NULLIF(trim(p_notes), '')
    )
    RETURNING * INTO v_purchase;

    -- 5. Cálculo exato em centavos inteiros a partir do total normalizado
    v_total_cents := round(v_normalized_total * 100)::BIGINT;
    v_base_cents := v_total_cents / p_installment_count;
    v_remainder_cents := v_total_cents - (v_base_cents * p_installment_count);

    -- Extração dos componentes da data do primeiro vencimento
    v_first_year := EXTRACT(YEAR FROM p_first_due_date)::INTEGER;
    v_first_month := EXTRACT(MONTH FROM p_first_due_date)::INTEGER;
    v_first_day := EXTRACT(DAY FROM p_first_due_date)::INTEGER;

    -- 6. Geração atômica das parcelas
    FOR i IN 1..p_installment_count LOOP
        -- A última parcela absorve os centavos restantes para fechar exatamente o total_amount
        IF i = p_installment_count THEN
            v_installment_cents := v_base_cents + v_remainder_cents;
        ELSE
            v_installment_cents := v_base_cents;
        END IF;

        v_amount := (v_installment_cents::NUMERIC / 100.0)::NUMERIC(12, 2);

        -- Cálculo do vencimento preservando o dia de vencimento (ex: 31/01 -> 28/02 -> 31/03)
        v_month_idx := (v_first_month - 1) + (i - 1);
        v_target_year := v_first_year + (v_month_idx / 12);
        v_target_month := (v_month_idx % 12) + 1;

        -- Calcula o último dia do mês alvo
        v_last_day_of_month := (make_date(v_target_year, v_target_month, 1) + interval '1 month' - interval '1 day')::DATE;
        v_max_days := EXTRACT(DAY FROM v_last_day_of_month)::INTEGER;
        v_actual_day := LEAST(v_first_day, v_max_days);

        v_due_date := make_date(v_target_year, v_target_month, v_actual_day);

        INSERT INTO public.installments (
            purchase_id,
            space_id,
            installment_number,
            amount,
            due_date,
            status,
            paid_at,
            paid_by,
            notes
        ) VALUES (
            v_purchase.id,
            p_space_id,
            i,
            v_amount,
            v_due_date,
            'pending',
            NULL,
            NULL,
            NULL
        );
    END LOOP;

    RETURN v_purchase;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. PERMISSÕES DA RPC (MENOR PRIVILÉGIO)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_installment_purchase(
    UUID, TEXT, NUMERIC, INTEGER, DATE, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_installment_purchase(
    UUID, TEXT, NUMERIC, INTEGER, DATE, TEXT, TEXT
) TO authenticated;
