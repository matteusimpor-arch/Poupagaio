-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.7: CORREÇÃO E ATOMICIDADE DE MOVIMENTAÇÕES
-- Migration incremental para criar RPCs transacionais de movimentações de investimento
-- ==============================================================================

-- 1. RPC: Registrar Aporte / Resgate e Atualizar Valor Atual Atomicamente
CREATE OR REPLACE FUNCTION public.fn_create_investment_transaction(
    p_investment_id UUID,
    p_space_id UUID,
    p_type TEXT,
    p_amount NUMERIC,
    p_transaction_date DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_value NUMERIC(14,2);
    v_new_value NUMERIC(14,2);
    v_tx_id UUID;
    v_result JSONB;
BEGIN
    -- Validar autenticação
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Validar dados básicos
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero.';
    END IF;

    IF p_type NOT IN ('contribution', 'withdrawal') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido. Use "contribution" ou "withdrawal".';
    END IF;

    -- Validar permissão de escrita no espaço (owner do espaço ou membro autorizados)
    IF NOT EXISTS (
        SELECT 1 FROM public.spaces WHERE id = p_space_id AND owner_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = p_space_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'member')
    ) THEN
        RAISE EXCEPTION 'Permissão negada. Apenas administradores e membros podem registrar movimentações.';
    END IF;

    -- Bloquear e obter valor atual do investimento no mesmo espaço
    SELECT current_value INTO v_current_value
    FROM public.investments
    WHERE id = p_investment_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investimento não encontrado no espaço informado.';
    END IF;

    -- Regra atômica do current_value
    -- APORTE: current_value = current_value + amount
    -- RESGATE: current_value = current_value - amount
    IF p_type = 'contribution' THEN
        v_new_value := v_current_value + p_amount;
    ELSIF p_type = 'withdrawal' THEN
        IF p_amount > v_current_value THEN
            RAISE EXCEPTION 'O valor do resgate (R$ %) excede o valor atual do investimento (R$ %).', p_amount, v_current_value;
        END IF;
        v_new_value := v_current_value - p_amount;
    END IF;

    -- Inserir movimentação com autoria
    INSERT INTO public.investment_transactions (
        investment_id,
        space_id,
        created_by,
        type,
        amount,
        transaction_date,
        notes
    ) VALUES (
        p_investment_id,
        p_space_id,
        auth.uid(),
        p_type,
        p_amount,
        p_transaction_date,
        p_notes
    )
    RETURNING id INTO v_tx_id;

    -- Atualizar valor atual do investimento na mesma transação
    UPDATE public.investments
    SET current_value = v_new_value
    WHERE id = p_investment_id AND space_id = p_space_id;

    -- Retornar objeto criado
    SELECT to_jsonb(t) INTO v_result
    FROM public.investment_transactions t
    WHERE t.id = v_tx_id;

    RETURN v_result;
END;
$$;

-- 2. RPC: Atualizar Movimentação e Recalcular Valor Atual Atomicamente
CREATE OR REPLACE FUNCTION public.fn_update_investment_transaction(
    p_transaction_id UUID,
    p_space_id UUID,
    p_type TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_transaction_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old_tx RECORD;
    v_current_value NUMERIC(14,2);
    v_base_value NUMERIC(14,2);
    v_final_value NUMERIC(14,2);
    v_new_type TEXT;
    v_new_amount NUMERIC(14,2);
    v_new_date DATE;
    v_new_notes TEXT;
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Permissão de escrita no espaço
    IF NOT EXISTS (
        SELECT 1 FROM public.spaces WHERE id = p_space_id AND owner_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = p_space_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'member')
    ) THEN
        RAISE EXCEPTION 'Permissão negada.';
    END IF;

    -- Bloquear e obter movimentação existente
    SELECT * INTO v_old_tx
    FROM public.investment_transactions
    WHERE id = p_transaction_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimentação não encontrada.';
    END IF;

    -- Bloquear e obter investimento
    SELECT current_value INTO v_current_value
    FROM public.investments
    WHERE id = v_old_tx.investment_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investimento correspondente não encontrado.';
    END IF;

    -- Reverter o efeito da movimentação antiga para calcular o saldo base
    IF v_old_tx.type = 'contribution' THEN
        v_base_value := v_current_value - v_old_tx.amount;
    ELSE
        v_base_value := v_current_value + v_old_tx.amount;
    END IF;

    IF v_base_value < 0 THEN
        RAISE EXCEPTION 'Não é possível atualizar movimentação pois o saldo base do investimento ficaria negativo.';
    END IF;

    -- Determinar novos valores
    v_new_type := COALESCE(p_type, v_old_tx.type);
    v_new_amount := COALESCE(p_amount, v_old_tx.amount);
    v_new_date := COALESCE(p_transaction_date, v_old_tx.transaction_date);
    v_new_notes := CASE WHEN p_notes IS NOT NULL THEN p_notes ELSE v_old_tx.notes END;

    IF v_new_amount <= 0 THEN
        RAISE EXCEPTION 'O valor da movimentação deve ser maior que zero.';
    END IF;

    IF v_new_type NOT IN ('contribution', 'withdrawal') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido.';
    END IF;

    -- Aplicar a nova movimentação sobre o saldo base
    IF v_new_type = 'contribution' THEN
        v_final_value := v_base_value + v_new_amount;
    ELSIF v_new_type = 'withdrawal' THEN
        IF v_new_amount > v_base_value THEN
            RAISE EXCEPTION 'O valor do resgate (R$ %) excede o valor disponível do investimento (R$ %).', v_new_amount, v_base_value;
        END IF;
        v_final_value := v_base_value - v_new_amount;
    END IF;

    -- Atualizar movimentação
    UPDATE public.investment_transactions
    SET type = v_new_type,
        amount = v_new_amount,
        transaction_date = v_new_date,
        notes = v_new_notes
    WHERE id = p_transaction_id AND space_id = p_space_id;

    -- Atualizar investimento
    UPDATE public.investments
    SET current_value = v_final_value
    WHERE id = v_old_tx.investment_id AND space_id = p_space_id;

    -- Retornar registro atualizado
    SELECT to_jsonb(t) INTO v_result
    FROM public.investment_transactions t
    WHERE t.id = p_transaction_id;

    RETURN v_result;
END;
$$;

-- 3. RPC: Excluir Movimentação e Reajustar Valor Atual Atomicamente
CREATE OR REPLACE FUNCTION public.fn_delete_investment_transaction(
    p_transaction_id UUID,
    p_space_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old_tx RECORD;
    v_current_value NUMERIC(14,2);
    v_new_value NUMERIC(14,2);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Permissão de escrita no espaço
    IF NOT EXISTS (
        SELECT 1 FROM public.spaces WHERE id = p_space_id AND owner_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = p_space_id
          AND user_id = auth.uid()
          AND role IN ('owner', 'admin', 'member')
    ) THEN
        RAISE EXCEPTION 'Permissão negada.';
    END IF;

    -- Bloquear e obter movimentação
    SELECT * INTO v_old_tx
    FROM public.investment_transactions
    WHERE id = p_transaction_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Movimentação não encontrada.';
    END IF;

    -- Bloquear e obter investimento
    SELECT current_value INTO v_current_value
    FROM public.investments
    WHERE id = v_old_tx.investment_id AND space_id = p_space_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Investimento correspondente não encontrado.';
    END IF;

    -- Se excluiu um aporte -> reduz do valor atual
    -- Se excluiu um resgate -> devolve ao valor atual
    IF v_old_tx.type = 'contribution' THEN
        v_new_value := v_current_value - v_old_tx.amount;
        IF v_new_value < 0 THEN
            RAISE EXCEPTION 'Exclusão do aporte cancelada pois o valor do investimento ficaria negativo.';
        END IF;
    ELSIF v_old_tx.type = 'withdrawal' THEN
        v_new_value := v_current_value + v_old_tx.amount;
    END IF;

    -- Excluir movimentação
    DELETE FROM public.investment_transactions
    WHERE id = p_transaction_id AND space_id = p_space_id;

    -- Atualizar valor do investimento
    UPDATE public.investments
    SET current_value = v_new_value
    WHERE id = v_old_tx.investment_id AND space_id = p_space_id;

    RETURN TRUE;
END;
$$;

-- Permissões das RPCs
REVOKE ALL ON FUNCTION public.fn_create_investment_transaction(UUID, UUID, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_create_investment_transaction(UUID, UUID, TEXT, NUMERIC, DATE, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_create_investment_transaction(UUID, UUID, TEXT, NUMERIC, DATE, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_update_investment_transaction(UUID, UUID, TEXT, NUMERIC, DATE, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_update_investment_transaction(UUID, UUID, TEXT, NUMERIC, DATE, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_update_investment_transaction(UUID, UUID, TEXT, NUMERIC, DATE, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_delete_investment_transaction(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_delete_investment_transaction(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_delete_investment_transaction(UUID, UUID) TO authenticated;
