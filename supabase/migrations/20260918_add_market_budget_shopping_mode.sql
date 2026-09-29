-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.6: INCREMENTAL (ORÇAMENTO + MODO COMPRA)
-- ==============================================================================

-- 1. Adicionar coluna budget_amount na tabela shopping_lists
ALTER TABLE public.shopping_lists
ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(12,2)
CHECK (budget_amount IS NULL OR budget_amount >= 0);

-- 2. Atualizar a constraint de status para incluir 'shopping'
ALTER TABLE public.shopping_lists
DROP CONSTRAINT IF EXISTS shopping_lists_status_check;

ALTER TABLE public.shopping_lists
ADD CONSTRAINT shopping_lists_status_check
CHECK (status IN ('active', 'shopping', 'completed', 'archived'));
