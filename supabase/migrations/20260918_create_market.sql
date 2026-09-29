-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 3.6: MERCADO
-- Migration definitiva
--
-- Tabelas:
--   1. public.shopping_lists
--   2. public.shopping_list_items
-- ==============================================================================


-- ==============================================================================
-- 1. LISTAS DE COMPRAS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    space_id UUID NOT NULL
        REFERENCES public.spaces(id)
        ON DELETE CASCADE,

    created_by UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    name TEXT NOT NULL
        CHECK (char_length(btrim(name)) > 0),

    shopping_date DATE,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'archived')),

    notes TEXT,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT timezone('utc'::text, now()),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_shopping_lists_id_space
        UNIQUE (id, space_id)
);


-- ==============================================================================
-- 2. ITENS DAS LISTAS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    shopping_list_id UUID NOT NULL,

    space_id UUID NOT NULL
        REFERENCES public.spaces(id)
        ON DELETE CASCADE,

    created_by UUID
        REFERENCES auth.users(id)
        ON DELETE SET NULL,

    name TEXT NOT NULL
        CHECK (char_length(btrim(name)) > 0),

    quantity NUMERIC(10,2) NOT NULL DEFAULT 1
        CHECK (quantity > 0),

    unit TEXT NOT NULL DEFAULT 'un'
        CHECK (char_length(btrim(unit)) > 0),

    category TEXT NOT NULL DEFAULT 'Geral'
        CHECK (char_length(btrim(category)) > 0),

    estimated_unit_price NUMERIC(12,2)
        CHECK (
            estimated_unit_price IS NULL
            OR estimated_unit_price >= 0
        ),

    actual_unit_price NUMERIC(12,2)
        CHECK (
            actual_unit_price IS NULL
            OR actual_unit_price >= 0
        ),

    is_checked BOOLEAN NOT NULL DEFAULT false,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT timezone('utc'::text, now()),

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT timezone('utc'::text, now()),

    CONSTRAINT fk_shopping_list_items_list_space
        FOREIGN KEY (shopping_list_id, space_id)
        REFERENCES public.shopping_lists(id, space_id)
        ON DELETE CASCADE
);


-- ==============================================================================
-- 3. ÍNDICES
-- ==============================================================================

-- Atende:
-- WHERE space_id = ?
-- WHERE space_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_shopping_lists_space_status
    ON public.shopping_lists(space_id, status);

-- Atende carregamento dos itens pertencentes a uma lista dentro do espaço.
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_space_list
    ON public.shopping_list_items(space_id, shopping_list_id);


-- ==============================================================================
-- 4. UPDATED_AT + IMUTABILIDADE DE CREATED_BY
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.set_shopping_lists_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());

    -- A autoria original nunca pode ser alterada por UPDATE.
    NEW.created_by = OLD.created_by;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_lists_updated_at
    ON public.shopping_lists;

CREATE TRIGGER trg_shopping_lists_updated_at
    BEFORE UPDATE ON public.shopping_lists
    FOR EACH ROW
    EXECUTE FUNCTION public.set_shopping_lists_updated_at();


CREATE OR REPLACE FUNCTION public.set_shopping_list_items_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());

    -- A autoria original nunca pode ser alterada por UPDATE.
    NEW.created_by = OLD.created_by;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopping_list_items_updated_at
    ON public.shopping_list_items;

CREATE TRIGGER trg_shopping_list_items_updated_at
    BEFORE UPDATE ON public.shopping_list_items
    FOR EACH ROW
    EXECUTE FUNCTION public.set_shopping_list_items_updated_at();


-- ==============================================================================
-- 5. ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE public.shopping_lists
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shopping_list_items
    ENABLE ROW LEVEL SECURITY;


-- ==============================================================================
-- 6. RLS — SHOPPING_LISTS
-- ==============================================================================

DROP POLICY IF EXISTS "Membros podem visualizar listas do espaço"
    ON public.shopping_lists;

CREATE POLICY "Membros podem visualizar listas do espaço"
ON public.shopping_lists
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.space_members sm
        WHERE sm.space_id = shopping_lists.space_id
          AND sm.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1
        FROM public.spaces s
        WHERE s.id = shopping_lists.space_id
          AND s.owner_id = auth.uid()
    )
);


DROP POLICY IF EXISTS "Membros autorizados podem criar listas no espaço"
    ON public.shopping_lists;

CREATE POLICY "Membros autorizados podem criar listas no espaço"
ON public.shopping_lists
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1
            FROM public.space_members sm
            WHERE sm.space_id = shopping_lists.space_id
              AND sm.user_id = auth.uid()
              AND sm.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1
            FROM public.spaces s
            WHERE s.id = shopping_lists.space_id
              AND s.owner_id = auth.uid()
        )
    )
);


DROP POLICY IF EXISTS "Membros autorizados podem atualizar listas do espaço"
    ON public.shopping_lists;

CREATE POLICY "Membros autorizados podem atualizar listas do espaço"
ON public.shopping_lists
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.space_members sm
        WHERE sm.space_id = shopping_lists.space_id
          AND sm.user_id = auth.uid()
          AND sm.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1
        FROM public.spaces s
        WHERE s.id = shopping_lists.space_id
          AND s.owner_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.space_members sm
        WHERE sm.space_id = shopping_lists.space_id
          AND sm.user_id = auth.uid()
          AND sm.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1
        FROM public.spaces s
        WHERE s.id = shopping_lists.space_id
          AND s.owner_id = auth.uid()
    )
);


DROP POLICY IF EXISTS "Membros autorizados podem excluir listas do espaço"
    ON public.shopping_lists;

CREATE POLICY "Membros autorizados podem excluir listas do espaço"
ON public.shopping_lists
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.space_members sm
        WHERE sm.space_id = shopping_lists.space_id
          AND sm.user_id = auth.uid()
          AND sm.role IN ('owner', 'admin', 'member')
    )
    OR EXISTS (
        SELECT 1
        FROM public.spaces s
        WHERE s.id = shopping_lists.space_id
          AND s.owner_id = auth.uid()
    )
);


-- ==============================================================================
-- 7. RLS — SHOPPING_LIST_ITEMS
-- ==============================================================================

DROP POLICY IF EXISTS "Membros podem visualizar itens da lista do espaço"
    ON public.shopping_list_items;

CREATE POLICY "Membros podem visualizar itens da lista do espaço"
ON public.shopping_list_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = shopping_list_items.shopping_list_id
          AND sl.space_id = shopping_list_items.space_id
    )
    AND (
        EXISTS (
            SELECT 1
            FROM public.space_members sm
            WHERE sm.space_id = shopping_list_items.space_id
              AND sm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1
            FROM public.spaces s
            WHERE s.id = shopping_list_items.space_id
              AND s.owner_id = auth.uid()
        )
    )
);


DROP POLICY IF EXISTS "Membros autorizados podem criar itens na lista do espaço"
    ON public.shopping_list_items;

CREATE POLICY "Membros autorizados podem criar itens na lista do espaço"
ON public.shopping_list_items
FOR INSERT
TO authenticated
WITH CHECK (
    created_by = auth.uid()

    AND EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = shopping_list_items.shopping_list_id
          AND sl.space_id = shopping_list_items.space_id
    )

    AND (
        EXISTS (
            SELECT 1
            FROM public.space_members sm
            WHERE sm.space_id = shopping_list_items.space_id
              AND sm.user_id = auth.uid()
              AND sm.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1
            FROM public.spaces s
            WHERE s.id = shopping_list_items.space_id
              AND s.owner_id = auth.uid()
        )
    )
);


DROP POLICY IF EXISTS "Membros autorizados podem atualizar itens da lista do espaço"
    ON public.shopping_list_items;

CREATE POLICY "Membros autorizados podem atualizar itens da lista do espaço"
ON public.shopping_list_items
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = shopping_list_items.shopping_list_id
          AND sl.space_id = shopping_list_items.space_id
    )
    AND (
        EXISTS (
            SELECT 1
            FROM public.space_members sm
            WHERE sm.space_id = shopping_list_items.space_id
              AND sm.user_id = auth.uid()
              AND sm.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1
            FROM public.spaces s
            WHERE s.id = shopping_list_items.space_id
              AND s.owner_id = auth.uid()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = shopping_list_items.shopping_list_id
          AND sl.space_id = shopping_list_items.space_id
    )
    AND (
        EXISTS (
            SELECT 1
            FROM public.space_members sm
            WHERE sm.space_id = shopping_list_items.space_id
              AND sm.user_id = auth.uid()
              AND sm.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1
            FROM public.spaces s
            WHERE s.id = shopping_list_items.space_id
              AND s.owner_id = auth.uid()
        )
    )
);


DROP POLICY IF EXISTS "Membros autorizados podem excluir itens da lista do espaço"
    ON public.shopping_list_items;

CREATE POLICY "Membros autorizados podem excluir itens da lista do espaço"
ON public.shopping_list_items
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.shopping_lists sl
        WHERE sl.id = shopping_list_items.shopping_list_id
          AND sl.space_id = shopping_list_items.space_id
    )
    AND (
        EXISTS (
            SELECT 1
            FROM public.space_members sm
            WHERE sm.space_id = shopping_list_items.space_id
              AND sm.user_id = auth.uid()
              AND sm.role IN ('owner', 'admin', 'member')
        )
        OR EXISTS (
            SELECT 1
            FROM public.spaces s
            WHERE s.id = shopping_list_items.space_id
              AND s.owner_id = auth.uid()
        )
    )
);


-- ==============================================================================
-- 8. PRIVILÉGIOS
-- ==============================================================================

REVOKE ALL ON TABLE public.shopping_lists FROM PUBLIC;
REVOKE ALL ON TABLE public.shopping_lists FROM anon;

REVOKE ALL ON TABLE public.shopping_list_items FROM PUBLIC;
REVOKE ALL ON TABLE public.shopping_list_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.shopping_lists
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.shopping_list_items
TO authenticated;
