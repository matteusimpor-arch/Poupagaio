-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.5: FECHAMENTO DO MÊS (MIGRATION FINAL)
-- Tabela e RPC transacional estritamente autoritativa no servidor:
--   1. public.monthly_closures (Registro imutável do snapshot de fechamento)
--   2. public.fn_close_month (RPC transacional atômica com cálculo 100% no servidor)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE FECHAMENTOS MENSAIS (public.monthly_closures)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    billing_cycle VARCHAR(7) NOT NULL CHECK (billing_cycle ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    total_income NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_income >= 0),
    total_fixed_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_fixed_expenses >= 0),
    total_variable_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_variable_expenses >= 0),
    total_installments NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_installments >= 0),
    total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_expenses >= 0),
    final_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_space_billing_cycle UNIQUE (space_id, billing_cycle)
);

-- Habilitação de RLS
ALTER TABLE public.monthly_closures ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para monthly_closures

-- 1. SELECT: Membros e Proprietário direto do espaço podem visualizar fechamentos
DROP POLICY IF EXISTS "Membros podem visualizar fechamentos do espaço" ON public.monthly_closures;
CREATE POLICY "Membros podem visualizar fechamentos do espaço"
ON public.monthly_closures FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = monthly_closures.space_id
          AND space_members.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = monthly_closures.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- 2. INSERT: Somente membros autorizados do espaço
DROP POLICY IF EXISTS "Membros autorizados podem fechar meses no espaço" ON public.monthly_closures;
CREATE POLICY "Membros autorizados podem fechar meses no espaço"
ON public.monthly_closures FOR INSERT
TO authenticated
WITH CHECK (
    closed_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.space_members
            WHERE space_members.space_id = monthly_closures.space_id
              AND space_members.user_id = auth.uid()
              AND space_members.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1 FROM public.spaces
            WHERE spaces.id = monthly_closures.space_id
              AND spaces.owner_id = auth.uid()
        )
    )
);

-- 3. UPDATE: PROIBIDO (Sem política de UPDATE)
DROP POLICY IF EXISTS "Membros autorizados podem atualizar fechamento do espaço" ON public.monthly_closures;

-- 4. DELETE: Somente proprietários ou administradores do espaço
DROP POLICY IF EXISTS "Apenas administradores podem excluir fechamento" ON public.monthly_closures;
CREATE POLICY "Apenas administradores podem excluir fechamento"
ON public.monthly_closures FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_members.space_id = monthly_closures.space_id
          AND space_members.user_id = auth.uid()
          AND space_members.role IN ('owner', 'admin')
    )
    OR EXISTS (
        SELECT 1 FROM public.spaces
        WHERE spaces.id = monthly_closures.space_id
          AND spaces.owner_id = auth.uid()
    )
);

-- Permissões de Tabela: UPDATE revogado para garantir imutabilidade absoluta
REVOKE ALL ON TABLE public.monthly_closures FROM PUBLIC;
REVOKE ALL ON TABLE public.monthly_closures FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.monthly_closures TO authenticated;


-- ------------------------------------------------------------------------------
-- 2. RPC TRANSACIONAL ATÔMICA E AUTORITATIVA DE FECHAMENTO (public.fn_close_month)
--    Assinatura estrita: (p_space_id UUID, p_billing_cycle VARCHAR(7)).
--    Cálculo 100% no servidor diretamente das tabelas oficiais, sem exceções mascaradas.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_close_month(
    p_space_id UUID,
    p_billing_cycle VARCHAR(7)
)
RETURNS public.monthly_closures
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_closed_by UUID;
    v_month INT;
    v_cycle_date DATE;
    
    v_calc_income NUMERIC(12, 2) := 0.00;
    v_calc_fixed NUMERIC(12, 2) := 0.00;
    v_calc_variable NUMERIC(12, 2) := 0.00;
    v_calc_installments NUMERIC(12, 2) := 0.00;
    v_total_expenses NUMERIC(12, 2) := 0.00;
    v_final_balance NUMERIC(12, 2) := 0.00;
    
    v_result public.monthly_closures;
BEGIN
    -- 1. Validar autenticação do usuário
    v_closed_by := auth.uid();
    IF v_closed_by IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- 2. Validar formato estrito da competência (YYYY-MM)
    IF p_billing_cycle IS NULL OR p_billing_cycle !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Competência inválida. Formato esperado: YYYY-MM (ex: 2026-09).';
    END IF;

    -- Extrair mês numérico para despesas anuais e converter para data no dia 1
    v_month := split_part(p_billing_cycle, '-', 2)::integer;
    v_cycle_date := to_date(p_billing_cycle || '-01', 'YYYY-MM-DD');

    -- 3. Bloquear fechamento de competências futuras (Permite apenas mês atual ou anteriores)
    IF v_cycle_date > date_trunc('month', CURRENT_DATE) THEN
        RAISE EXCEPTION 'Não é permitido realizar o fechamento de competências futuras (%).', p_billing_cycle;
    END IF;

    -- 4. Validar autorização do usuário no espaço financeiro
    IF NOT EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = p_space_id
          AND user_id = v_closed_by
          AND role IN ('owner', 'admin', 'member')
    ) AND NOT EXISTS (
        SELECT 1 FROM public.spaces
        WHERE id = p_space_id
          AND owner_id = v_closed_by
    ) THEN
        RAISE EXCEPTION 'Acesso negado: Você não possui autorização para fechar a competência neste espaço.';
    END IF;

    -- 5. Validar prévia de fechamento duplicado (Constraint UNIQUE garante concorrência)
    IF EXISTS (
        SELECT 1 FROM public.monthly_closures
        WHERE space_id = p_space_id AND billing_cycle = p_billing_cycle
    ) THEN
        RAISE EXCEPTION 'Esta competência (%) já se encontra fechada para este espaço.', p_billing_cycle;
    END IF;

    -- 6. CÁLCULOS AUTORITATIVOS DIRETAMENTE DAS TABELAS OFICIAIS (SEM TRATAMENTO SILENCIOSO DE ERRO)

    -- A) ENTRADAS (public.entries): Soma de todas as receitas lançadas para o mês
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_calc_income
    FROM public.entries
    WHERE space_id = p_space_id
      AND to_char(date, 'YYYY-MM') = p_billing_cycle;

    -- B) GASTOS FIXOS (public.fixed_expenses): Regra V1
    -- Nota: O fechamento utiliza a configuração de gastos fixos existente no momento em que a competência é fechada.
    -- O snapshot gravado em monthly_closures preserva esse resultado e não muda posteriormente.
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_calc_fixed
    FROM public.fixed_expenses
    WHERE space_id = p_space_id
      AND (recurrence = 'monthly' OR (recurrence = 'yearly' AND due_month = v_month));

    -- C) GASTOS VARIÁVEIS (public.variable_expenses): Soma de todos os gastos variáveis lançados na competência
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_calc_variable
    FROM public.variable_expenses
    WHERE space_id = p_space_id
      AND to_char(date, 'YYYY-MM') = p_billing_cycle;

    -- D) PARCELAMENTOS (public.installments): Soma das parcelas cujas datas de vencimento pertencem à competência
    SELECT COALESCE(SUM(amount), 0.00)
    INTO v_calc_installments
    FROM public.installments
    WHERE space_id = p_space_id
      AND to_char(due_date, 'YYYY-MM') = p_billing_cycle;

    -- Totais Consolidados Transacionais
    v_total_expenses := ROUND(v_calc_fixed + v_calc_variable + v_calc_installments, 2);
    v_final_balance := ROUND(v_calc_income - v_total_expenses, 2);

    -- 7. Inserção atômica do snapshot de fechamento no banco
    INSERT INTO public.monthly_closures (
        space_id,
        billing_cycle,
        total_income,
        total_fixed_expenses,
        total_variable_expenses,
        total_installments,
        total_expenses,
        final_balance,
        closed_at,
        closed_by
    )
    VALUES (
        p_space_id,
        p_billing_cycle,
        v_calc_income,
        v_calc_fixed,
        v_calc_variable,
        v_calc_installments,
        v_total_expenses,
        v_final_balance,
        now(),
        v_closed_by
    )
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$;

-- Permissões na RPC
REVOKE ALL ON FUNCTION public.fn_close_month(UUID, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_close_month(UUID, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_close_month(UUID, VARCHAR) TO authenticated;
