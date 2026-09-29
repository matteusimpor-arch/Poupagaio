// POUPAGAIO FINANCE — ETAPA 1 SQL SCHEMA (REVISÃO DE SEGURANÇA FINAL CONSOLIDADA)
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================================
-- POUPAGAIO FINANCE — ETAPA 1: SCHEMA INICIAL CONSOLIDADO & HARDENED (VERSÃO FINAL)
-- "Organize hoje. Voe mais longe."
--
-- REVISÃO DE SEGURANÇA E INTEGRIDADE:
-- 1. Remoção de autoinclusão em space_members (somente owner/admin).
-- 2. Índice único parcial (uq_spaces_owner_personal) impedindo múltiplos spaces pessoais por owner.
-- 3. Trigger BEFORE UPDATE em spaces impedindo categoricamente alteração de owner_id.
-- 4. Índice único parcial (uq_space_members_single_owner) garantindo exatamente um owner por espaço.
-- 5. Trigger em space_members garantindo que apenas spaces.owner_id pode ser owner (sem transferência de propriedade).
-- 6. Proteção estrita contra escalada de privilégios: somente owner concede/revoga admin; admins gerenciam member e viewer.
-- 7. Funções de trigger com search_path seguro e EXECUTE concedido apenas a postgres e service_role (não expostas a authenticated).
-- 8. Funções auxiliares de RLS com search_path restrito concedidas a authenticated e service_role.
-- 9. Trigger automático no spaces para inserção imediata do proprietário em space_members.
-- 10. Trigger idempotente em auth.users para perfil + 1 space personal + membro owner.
-- 11. Backfill idempotente para usuários já cadastrados no auth.users.
-- ==============================================================================

-- Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. TABELA DE PERFIS (public.profiles)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 2. TABELA DE ESPAÇOS (public.spaces)
-- Desacopla dados do user_id direto, suportando Pessoal, Casal, Família e Empresa
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.spaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('personal', 'couple', 'family', 'business')),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ------------------------------------------------------------------------------
-- 3. TABELA DE MEMBROS DO ESPAÇO (public.space_members)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.space_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_space_member UNIQUE (space_id, user_id)
);

-- ------------------------------------------------------------------------------
-- 4. ÍNDICES DE INTEGRIDADE E DESEMPENHO
-- ------------------------------------------------------------------------------

-- PROTEÇÃO ESTRITA: Garante no máximo 1 espaço 'personal' por owner_id (inclusive sob concorrência)
CREATE UNIQUE INDEX IF NOT EXISTS uq_spaces_owner_personal
ON public.spaces(owner_id)
WHERE type = 'personal';

-- PROTEÇÃO ESTRITA: Garante no máximo 1 proprietário (role = 'owner') por espaço
CREATE UNIQUE INDEX IF NOT EXISTS uq_space_members_single_owner
ON public.space_members(space_id)
WHERE role = 'owner';

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_spaces_owner_id ON public.spaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_spaces_type ON public.spaces(type);
CREATE INDEX IF NOT EXISTS idx_space_members_user_id ON public.space_members(user_id);
CREATE INDEX IF NOT EXISTS idx_space_members_space_id ON public.space_members(space_id);

-- ------------------------------------------------------------------------------
-- 5. FUNÇÕES AUXILIARES DE SEGURANÇA PARA POLÍTICAS RLS
-- Funções STABLE com search_path restrito; necessárias para avaliação de RLS por authenticated
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_space_member(lookup_space_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = lookup_space_id AND user_id = lookup_user_id
    );
$$;

REVOKE ALL ON FUNCTION public.is_space_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_space_member(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_space_admin_or_owner(lookup_space_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.spaces
        WHERE id = lookup_space_id AND owner_id = lookup_user_id
    )
    OR EXISTS (
        SELECT 1 FROM public.space_members
        WHERE space_id = lookup_space_id AND user_id = lookup_user_id AND role IN ('owner', 'admin')
    );
$$;

REVOKE ALL ON FUNCTION public.is_space_admin_or_owner(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_space_admin_or_owner(UUID, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. PROTEÇÃO NO PUBLIC.SPACES: IMPEDIR ALTERAÇÃO DIRETA DE OWNER_ID
-- Não há transferência de propriedade na Etapa 1
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_spaces_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Não é permitida a alteração ou transferência de propriedade do espaço.';
    END IF;
    RETURN NEW;
END;
$$;

-- Função exclusiva de trigger: não expor a authenticated
REVOKE ALL ON FUNCTION public.protect_spaces_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_spaces_owner() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_protect_spaces_owner ON public.spaces;
CREATE TRIGGER trg_protect_spaces_owner
    BEFORE UPDATE ON public.spaces
    FOR EACH ROW EXECUTE FUNCTION public.protect_spaces_owner();

-- ------------------------------------------------------------------------------
-- 7. PROTEÇÃO NO PUBLIC.SPACE_MEMBERS: CONSISTÊNCIA DE OWNER E REGRAS DE CARGOS
-- - Exatamente 1 owner por espaço, sendo obrigatoriamente spaces.owner_id.
-- - Ninguém pode promover outro membro para owner.
-- - O owner original não pode ser rebaixado nem removido.
-- - Somente o proprietário pode conceder ou revogar papel de admin.
-- - Admins podem gerenciar exclusivamente member e viewer.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_space_members_and_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_space_owner_id UUID;
    v_caller_id UUID;
BEGIN
    -- Obtém o proprietário original do espaço
    SELECT owner_id INTO v_space_owner_id
    FROM public.spaces
    WHERE id = COALESCE(OLD.space_id, NEW.space_id);

    v_caller_id := auth.uid();

    -- Chamadas internas do sistema sem contexto de usuário (ex: trigger de criação de espaço)
    IF v_caller_id IS NULL THEN
        IF TG_OP = 'INSERT' AND NEW.role = 'owner' AND NEW.user_id != v_space_owner_id THEN
            RAISE EXCEPTION 'Apenas o proprietário definido no espaço pode ser registrado como owner.';
        END IF;
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- REGRA 1: EXCLUSÃO DE MEMBRO (DELETE)
    IF TG_OP = 'DELETE' THEN
        -- O proprietário original nunca pode ser removido
        IF OLD.user_id = v_space_owner_id THEN
            RAISE EXCEPTION 'Não é permitido remover o proprietário do espaço.';
        END IF;

        -- Se outro usuário estiver removendo (não sendo a própria saída do membro):
        IF v_caller_id != OLD.user_id THEN
            -- Apenas o proprietário pode remover administradores
            IF OLD.role = 'admin' AND v_caller_id != v_space_owner_id THEN
                RAISE EXCEPTION 'Apenas o proprietário do espaço pode remover administradores.';
            END IF;
        END IF;

        RETURN OLD;
    END IF;

    -- REGRA 2: INSERÇÃO DE MEMBRO (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Ninguém pode adicionar outro membro com papel de owner (não há transferência de propriedade)
        IF NEW.role = 'owner' AND NEW.user_id != v_space_owner_id THEN
            RAISE EXCEPTION 'Não é permitido adicionar outro proprietário ao espaço.';
        END IF;

        -- Apenas o proprietário do espaço pode conceder o papel de administrador
        IF NEW.role = 'admin' AND v_caller_id != v_space_owner_id THEN
            RAISE EXCEPTION 'Apenas o proprietário do espaço pode conceder o papel de administrador.';
        END IF;

        RETURN NEW;
    END IF;

    -- REGRA 3: ATUALIZAÇÃO DE MEMBRO (UPDATE)
    IF TG_OP = 'UPDATE' THEN
        -- space_id e user_id são imutáveis
        IF NEW.space_id != OLD.space_id OR NEW.user_id != OLD.user_id THEN
            RAISE EXCEPTION 'Não é permitido alterar o espaço ou o usuário do registro de membro.';
        END IF;

        -- O owner original não pode ser rebaixado de papel
        IF OLD.user_id = v_space_owner_id AND NEW.role != 'owner' THEN
            RAISE EXCEPTION 'O proprietário original do espaço não pode ser rebaixado de papel.';
        END IF;

        -- Se o papel (role) estiver sendo modificado:
        IF NEW.role != OLD.role THEN
            -- Ninguém pode alterar seu próprio nível de permissão (impede auto-promoção)
            IF v_caller_id = OLD.user_id THEN
                RAISE EXCEPTION 'Você não pode alterar seu próprio nível de permissão.';
            END IF;

            -- Ninguém pode promover outro membro para owner (não há transferência de propriedade)
            IF NEW.role = 'owner' THEN
                RAISE EXCEPTION 'Não é permitido promover membros para proprietário.';
            END IF;

            -- Apenas o proprietário pode conceder ou revogar o papel de administrador
            IF (OLD.role = 'admin' OR NEW.role = 'admin') AND v_caller_id != v_space_owner_id THEN
                RAISE EXCEPTION 'Apenas o proprietário do espaço pode conceder ou revogar o papel de administrador.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

-- Função exclusiva de trigger: não expor a authenticated
REVOKE ALL ON FUNCTION public.protect_space_members_and_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_space_members_and_roles() TO postgres, service_role;

DROP TRIGGER IF EXISTS trg_protect_space_members ON public.space_members;
CREATE TRIGGER trg_protect_space_members
    BEFORE INSERT OR UPDATE OR DELETE ON public.space_members
    FOR EACH ROW EXECUTE FUNCTION public.protect_space_members_and_roles();

-- ------------------------------------------------------------------------------
-- 8. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS DE SEGURANÇA (RLS POLICIES)
-- ------------------------------------------------------------------------------

-- Policies: profiles
DROP POLICY IF EXISTS "Usuários podem visualizar o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem visualizar o próprio perfil"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem inserir o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem inserir o próprio perfil"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil" ON public.profiles;
CREATE POLICY "Usuários podem atualizar o próprio perfil"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policies: spaces
DROP POLICY IF EXISTS "Membros podem visualizar seus espaços" ON public.spaces;
CREATE POLICY "Membros podem visualizar seus espaços"
ON public.spaces FOR SELECT
USING (
    owner_id = auth.uid()
    OR public.is_space_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Usuários podem criar seus próprios espaços" ON public.spaces;
CREATE POLICY "Usuários podem criar seus próprios espaços"
ON public.spaces FOR INSERT
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners e admins podem atualizar dados do espaço" ON public.spaces;
CREATE POLICY "Owners e admins podem atualizar dados do espaço"
ON public.spaces FOR UPDATE
USING (
    owner_id = auth.uid()
    OR public.is_space_admin_or_owner(id, auth.uid())
);

DROP POLICY IF EXISTS "Apenas owners podem excluir espaços" ON public.spaces;
CREATE POLICY "Apenas owners podem excluir espaços"
ON public.spaces FOR DELETE
USING (owner_id = auth.uid());

-- Policies: space_members
DROP POLICY IF EXISTS "Membros podem visualizar integrantes de seus espaços" ON public.space_members;
CREATE POLICY "Membros podem visualizar integrantes de seus espaços"
ON public.space_members FOR SELECT
USING (
    user_id = auth.uid()
    OR public.is_space_member(space_id, auth.uid())
);

-- Somente proprietários ou administradores legítimos do espaço podem adicionar membros
DROP POLICY IF EXISTS "Apenas owners e admins podem adicionar membros" ON public.space_members;
CREATE POLICY "Apenas owners e admins podem adicionar membros"
ON public.space_members FOR INSERT
WITH CHECK (
    public.is_space_admin_or_owner(space_id, auth.uid())
);

-- Owners e admins podem atualizar membros (sujeito à validação do trigger)
DROP POLICY IF EXISTS "Owners e admins podem atualizar membros" ON public.space_members;
CREATE POLICY "Owners e admins podem atualizar membros"
ON public.space_members FOR UPDATE
USING (
    public.is_space_admin_or_owner(space_id, auth.uid())
)
WITH CHECK (
    public.is_space_admin_or_owner(space_id, auth.uid())
);

-- Membros podem sair ou administradores remover membros (sujeito à validação do trigger)
DROP POLICY IF EXISTS "Membros podem sair ou administradores remover" ON public.space_members;
CREATE POLICY "Membros podem sair ou administradores remover"
ON public.space_members FOR DELETE
USING (
    user_id = auth.uid()
    OR public.is_space_admin_or_owner(space_id, auth.uid())
);

-- ------------------------------------------------------------------------------
-- 10. AUTOMAÇÃO: VINCULAÇÃO ATÔMICA DO OWNER AO CRIAR UM ESPAÇO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_space_owner_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.space_members (space_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (space_id, user_id) DO UPDATE
    SET role = 'owner';
    RETURN NEW;
END;
$$;

-- Função exclusiva de trigger: não expor a authenticated
REVOKE ALL ON FUNCTION public.handle_space_owner_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_space_owner_setup() TO postgres, service_role;

DROP TRIGGER IF EXISTS on_space_created ON public.spaces;
CREATE TRIGGER on_space_created
    AFTER INSERT ON public.spaces
    FOR EACH ROW EXECUTE FUNCTION public.handle_space_owner_setup();

-- ------------------------------------------------------------------------------
-- 11. AUTOMAÇÃO: TRIGGER ON AUTH.USERS INSERT (Idempotente & À Prova de Concorrência)
-- Cria de forma segura: Perfil + exatamente 1 Espaço Pessoal + Associação Owner
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user_setup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    new_space_id UUID;
    user_name TEXT;
BEGIN
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Usuário');

    -- 1. Criar perfil
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (NEW.id, user_name, NULL)
    ON CONFLICT (id) DO UPDATE
    SET full_name = CASE 
        WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' 
        THEN EXCLUDED.full_name 
        ELSE public.profiles.full_name 
    END;

    -- 2. Criar exatamente 1 espaço pessoal (idempotente com captura de exceção unique_violation)
    BEGIN
        INSERT INTO public.spaces (name, type, owner_id)
        VALUES ('Pessoal', 'personal', NEW.id)
        RETURNING id INTO new_space_id;

        -- 3. Adicionar como owner em space_members
        INSERT INTO public.space_members (space_id, user_id, role)
        VALUES (new_space_id, NEW.id, 'owner')
        ON CONFLICT (space_id, user_id) DO UPDATE
        SET role = 'owner';
    EXCEPTION
        WHEN unique_violation THEN
            -- Já existe devido à concorrência ou ao índice uq_spaces_owner_personal
            SELECT id INTO new_space_id
            FROM public.spaces
            WHERE owner_id = NEW.id AND type = 'personal'
            LIMIT 1;

            IF new_space_id IS NOT NULL THEN
                INSERT INTO public.space_members (space_id, user_id, role)
                VALUES (new_space_id, NEW.id, 'owner')
                ON CONFLICT (space_id, user_id) DO UPDATE
                SET role = 'owner';
            END IF;
    END;

    RETURN NEW;
END;
$$;

-- Função exclusiva de trigger: não expor a authenticated
REVOKE ALL ON FUNCTION public.handle_new_user_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_setup() TO postgres, service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_setup();

-- ------------------------------------------------------------------------------
-- 12. BACKFILL SEGURO PARA USUÁRIOS JÁ EXISTENTES EM AUTH.USERS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    u RECORD;
    v_space_id UUID;
    v_name TEXT;
BEGIN
    FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users LOOP
        v_name := COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), 'Usuário');

        -- Perfil
        INSERT INTO public.profiles (id, full_name, avatar_url)
        VALUES (u.id, v_name, NULL)
        ON CONFLICT (id) DO UPDATE
        SET full_name = CASE 
            WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' 
            THEN EXCLUDED.full_name 
            ELSE public.profiles.full_name 
        END;

        -- Espaço Pessoal único
        SELECT id INTO v_space_id FROM public.spaces WHERE owner_id = u.id AND type = 'personal' LIMIT 1;

        IF v_space_id IS NULL THEN
            INSERT INTO public.spaces (name, type, owner_id)
            VALUES ('Pessoal', 'personal', u.id)
            RETURNING id INTO v_space_id;
        END IF;

        -- Associação Owner garantida
        INSERT INTO public.space_members (space_id, user_id, role)
        VALUES (v_space_id, u.id, 'owner')
        ON CONFLICT (space_id, user_id) DO UPDATE
        SET role = 'owner';
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 13. TABELA DE ENTRADAS / RECEITAS (public.entries)
-- ------------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_entries_space_id ON public.entries(space_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON public.entries(date);
CREATE INDEX IF NOT EXISTS idx_entries_status ON public.entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_space_date ON public.entries(space_id, date);
CREATE INDEX IF NOT EXISTS idx_entries_created_by ON public.entries(created_by);

CREATE OR REPLACE FUNCTION public.handle_entries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entries_updated_at ON public.entries;
CREATE TRIGGER trg_entries_updated_at
    BEFORE UPDATE ON public.entries
    FOR EACH ROW EXECUTE FUNCTION public.handle_entries_updated_at();

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar entradas do espaço" ON public.entries;
CREATE POLICY "Membros podem visualizar entradas do espaço" ON public.entries FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = entries.space_id AND space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = entries.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem criar entradas no espaço" ON public.entries;
CREATE POLICY "Membros autorizados podem criar entradas no espaço" ON public.entries FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = entries.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = entries.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar entradas do espaço" ON public.entries;
CREATE POLICY "Membros autorizados podem atualizar entradas do espaço" ON public.entries FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = entries.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = entries.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir entradas do espaço" ON public.entries;
CREATE POLICY "Membros autorizados podem excluir entradas do espaço" ON public.entries FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = entries.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = entries.space_id AND spaces.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 14. TABELA DE GASTOS FIXOS (public.fixed_expenses)
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
    CONSTRAINT uq_fixed_expenses_id_space UNIQUE (id, space_id),
    CONSTRAINT chk_fixed_expenses_recurrence CHECK (
        (recurrence = 'monthly' AND due_month IS NULL) OR
        (recurrence = 'yearly' AND due_month IS NOT NULL AND due_month >= 1 AND due_month <= 12)
    )
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_space_id ON public.fixed_expenses(space_id);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_due_day ON public.fixed_expenses(due_day);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_due_month ON public.fixed_expenses(due_month);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_created_by ON public.fixed_expenses(created_by);

CREATE OR REPLACE FUNCTION public.handle_fixed_expenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fixed_expenses_updated_at ON public.fixed_expenses;
CREATE TRIGGER trg_fixed_expenses_updated_at
    BEFORE UPDATE ON public.fixed_expenses
    FOR EACH ROW EXECUTE FUNCTION public.handle_fixed_expenses_updated_at();

ALTER TABLE public.fixed_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar gastos fixos do espaço" ON public.fixed_expenses;
CREATE POLICY "Membros podem visualizar gastos fixos do espaço" ON public.fixed_expenses FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expenses.space_id AND space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expenses.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem criar gastos fixos no espaço" ON public.fixed_expenses;
CREATE POLICY "Membros autorizados podem criar gastos fixos no espaço" ON public.fixed_expenses FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expenses.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar gastos fixos do espaço" ON public.fixed_expenses;
CREATE POLICY "Membros autorizados podem atualizar gastos fixos do espaço" ON public.fixed_expenses FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expenses.space_id AND spaces.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expenses.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir gastos fixos do espaço" ON public.fixed_expenses;
CREATE POLICY "Membros autorizados podem excluir gastos fixos do espaço" ON public.fixed_expenses FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expenses.space_id AND spaces.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 15. TABELA DE PAGAMENTOS DE GASTOS FIXOS (public.fixed_expense_payments)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fixed_expense_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixed_expense_id UUID NOT NULL,
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    billing_cycle VARCHAR(7) NOT NULL,
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT fk_fep_fixed_expense_space
        FOREIGN KEY (fixed_expense_id, space_id)
        REFERENCES public.fixed_expenses (id, space_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_fep_billing_cycle_format
        CHECK (billing_cycle ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT uq_fixed_expense_billing_cycle
        UNIQUE (fixed_expense_id, billing_cycle)
);

CREATE INDEX IF NOT EXISTS idx_fep_space_billing ON public.fixed_expense_payments(space_id, billing_cycle);
CREATE INDEX IF NOT EXISTS idx_fep_expense_id ON public.fixed_expense_payments(fixed_expense_id);

CREATE OR REPLACE FUNCTION public.handle_fixed_expense_payments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fixed_expense_payments_updated_at ON public.fixed_expense_payments;
CREATE TRIGGER trg_fixed_expense_payments_updated_at
    BEFORE UPDATE ON public.fixed_expense_payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_fixed_expense_payments_updated_at();

ALTER TABLE public.fixed_expense_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar pagamentos de gastos fixos" ON public.fixed_expense_payments;
CREATE POLICY "Membros podem visualizar pagamentos de gastos fixos" ON public.fixed_expense_payments FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expense_payments.space_id AND space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expense_payments.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem registrar pagamentos de gastos fixos" ON public.fixed_expense_payments;
CREATE POLICY "Membros autorizados podem registrar pagamentos de gastos fixos" ON public.fixed_expense_payments FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expense_payments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expense_payments.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar pagamentos de gastos fixos" ON public.fixed_expense_payments;
CREATE POLICY "Membros autorizados podem atualizar pagamentos de gastos fixos" ON public.fixed_expense_payments FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expense_payments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expense_payments.space_id AND spaces.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expense_payments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expense_payments.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir pagamentos de gastos fixos" ON public.fixed_expense_payments;
CREATE POLICY "Membros autorizados podem excluir pagamentos de gastos fixos" ON public.fixed_expense_payments FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = fixed_expense_payments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = fixed_expense_payments.space_id AND spaces.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 16. TABELA DE GASTOS VARIÁVEIS (public.variable_expenses)
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

CREATE INDEX IF NOT EXISTS idx_variable_expenses_space_date ON public.variable_expenses(space_id, date);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_status ON public.variable_expenses(status);
CREATE INDEX IF NOT EXISTS idx_variable_expenses_created_by ON public.variable_expenses(created_by);

CREATE OR REPLACE FUNCTION public.handle_variable_expenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_variable_expenses_updated_at ON public.variable_expenses;
CREATE TRIGGER trg_variable_expenses_updated_at
    BEFORE UPDATE ON public.variable_expenses
    FOR EACH ROW EXECUTE FUNCTION public.handle_variable_expenses_updated_at();

ALTER TABLE public.variable_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar gastos variáveis do espaço" ON public.variable_expenses;
CREATE POLICY "Membros podem visualizar gastos variáveis do espaço" ON public.variable_expenses FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = variable_expenses.space_id AND space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = variable_expenses.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem criar gastos variáveis no espaço" ON public.variable_expenses;
CREATE POLICY "Membros autorizados podem criar gastos variáveis no espaço" ON public.variable_expenses FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = variable_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = variable_expenses.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar gastos variáveis do espaço" ON public.variable_expenses;
CREATE POLICY "Membros autorizados podem atualizar gastos variáveis do espaço" ON public.variable_expenses FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = variable_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = variable_expenses.space_id AND spaces.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = variable_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = variable_expenses.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir gastos variáveis do espaço" ON public.variable_expenses;
CREATE POLICY "Membros autorizados podem excluir gastos variáveis do espaço" ON public.variable_expenses FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = variable_expenses.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = variable_expenses.space_id AND spaces.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 17. TABELA DE COMPRAS PARCELADAS (public.installment_purchases) — ETAPA 3.4
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
    CONSTRAINT uq_installment_purchases_id_space UNIQUE (id, space_id)
);

CREATE INDEX IF NOT EXISTS idx_installment_purchases_space_id ON public.installment_purchases(space_id);
CREATE INDEX IF NOT EXISTS idx_installment_purchases_first_due_date ON public.installment_purchases(first_due_date);
CREATE INDEX IF NOT EXISTS idx_installment_purchases_created_by ON public.installment_purchases(created_by);

CREATE OR REPLACE FUNCTION public.handle_installment_purchases_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installment_purchases_updated_at ON public.installment_purchases;
CREATE TRIGGER trg_installment_purchases_updated_at
    BEFORE UPDATE ON public.installment_purchases
    FOR EACH ROW EXECUTE FUNCTION public.handle_installment_purchases_updated_at();

ALTER TABLE public.installment_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar compras parceladas do espaço" ON public.installment_purchases;
CREATE POLICY "Membros podem visualizar compras parceladas do espaço" ON public.installment_purchases FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installment_purchases.space_id AND space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installment_purchases.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem criar compras parceladas no espaço" ON public.installment_purchases;
CREATE POLICY "Membros autorizados podem criar compras parceladas no espaço" ON public.installment_purchases FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installment_purchases.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installment_purchases.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar compras parceladas do espaço" ON public.installment_purchases;
CREATE POLICY "Membros autorizados podem atualizar compras parceladas do espaço" ON public.installment_purchases FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installment_purchases.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installment_purchases.space_id AND spaces.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installment_purchases.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installment_purchases.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir compras parceladas do espaço" ON public.installment_purchases;
CREATE POLICY "Membros autorizados podem excluir compras parceladas do espaço" ON public.installment_purchases FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installment_purchases.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installment_purchases.space_id AND spaces.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 18. TABELA DE PARCELAS VINCULADAS (public.installments) — ETAPA 3.4
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
    CONSTRAINT fk_installments_purchase_space
        FOREIGN KEY (purchase_id, space_id)
        REFERENCES public.installment_purchases (id, space_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_installments_purchase_number
        UNIQUE (purchase_id, installment_number),
    CONSTRAINT chk_installments_payment_status
        CHECK (
            (status = 'pending' AND paid_at IS NULL) OR
            (status = 'paid' AND paid_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_installments_space_id ON public.installments(space_id);
CREATE INDEX IF NOT EXISTS idx_installments_purchase_id ON public.installments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON public.installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_space_due_date ON public.installments(space_id, due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON public.installments(status);
CREATE INDEX IF NOT EXISTS idx_installments_paid_by ON public.installments(paid_by);

CREATE OR REPLACE FUNCTION public.handle_installments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installments_updated_at ON public.installments;
CREATE TRIGGER trg_installments_updated_at
    BEFORE UPDATE ON public.installments
    FOR EACH ROW EXECUTE FUNCTION public.handle_installments_updated_at();

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Membros podem visualizar parcelas do espaço" ON public.installments;
CREATE POLICY "Membros podem visualizar parcelas do espaço" ON public.installments FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installments.space_id AND space_members.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installments.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem inserir parcelas no espaço" ON public.installments;
CREATE POLICY "Membros autorizados podem inserir parcelas no espaço" ON public.installments FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installments.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem atualizar parcelas do espaço" ON public.installments;
CREATE POLICY "Membros autorizados podem atualizar parcelas do espaço" ON public.installments FOR UPDATE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installments.space_id AND spaces.owner_id = auth.uid())
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installments.space_id AND spaces.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Membros autorizados podem excluir parcelas do espaço" ON public.installments;
CREATE POLICY "Membros autorizados podem excluir parcelas do espaço" ON public.installments FOR DELETE TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.space_members WHERE space_members.space_id = installments.space_id AND space_members.user_id = auth.uid() AND space_members.role IN ('owner', 'admin', 'member'))
    OR EXISTS (SELECT 1 FROM public.spaces WHERE spaces.id = installments.space_id AND spaces.owner_id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 19. RPC TRANSACIONAL: public.create_installment_purchase — ETAPA 3.4
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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

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

    IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
        RAISE EXCEPTION 'A descrição da compra é obrigatória.';
    END IF;

    IF p_total_amount IS NULL THEN
        RAISE EXCEPTION 'O valor total da compra é obrigatório.';
    END IF;

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

    v_total_cents := round(v_normalized_total * 100)::BIGINT;
    v_base_cents := v_total_cents / p_installment_count;
    v_remainder_cents := v_total_cents - (v_base_cents * p_installment_count);

    v_first_year := EXTRACT(YEAR FROM p_first_due_date)::INTEGER;
    v_first_month := EXTRACT(MONTH FROM p_first_due_date)::INTEGER;
    v_first_day := EXTRACT(DAY FROM p_first_due_date)::INTEGER;

    FOR i IN 1..p_installment_count LOOP
        IF i = p_installment_count THEN
            v_installment_cents := v_base_cents + v_remainder_cents;
        ELSE
            v_installment_cents := v_base_cents;
        END IF;

        v_amount := (v_installment_cents::NUMERIC / 100.0)::NUMERIC(12, 2);

        v_month_idx := (v_first_month - 1) + (i - 1);
        v_target_year := v_first_year + (v_month_idx / 12);
        v_target_month := (v_month_idx % 12) + 1;

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

REVOKE ALL ON FUNCTION public.create_installment_purchase(
    UUID, TEXT, NUMERIC, INTEGER, DATE, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_installment_purchase(
    UUID, TEXT, NUMERIC, INTEGER, DATE, TEXT, TEXT
) TO authenticated;
`;
