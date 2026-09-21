-- Migration Phase 2/3 corrigée : version additive et RLS.
-- Cette version corrige le trigger et les parenthèses SQL.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_role' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_role AS ENUM ('particulier', 'entreprise');
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = 'particulier'
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = 'user_role' AND n.nspname = 'public' AND e.enumlabel = 'entreprise'
    ) THEN
      RAISE EXCEPTION 'public.user_role existe mais ne contient pas les valeurs requises';
    END IF;
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'particulier';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $function$
DECLARE
  v_role public.user_role;
BEGIN
  BEGIN
    v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'particulier')::public.user_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'particulier'::public.user_role;
  END;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> ''
        THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    role = COALESCE(public.profiles.role, EXCLUDED.role),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

ALTER TABLE public.renovation_projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.renovation_projects ADD COLUMN IF NOT EXISTS completion_percentage INT NOT NULL DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100);
ALTER TABLE public.renovation_projects ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2) CHECK (budget >= 0);
ALTER TABLE public.renovation_projects ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS public.project_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.renovation_projects(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  surface NUMERIC(8, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.room_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.project_rooms(id) ON DELETE CASCADE,
  trade_category TEXT NOT NULL,
  description TEXT NOT NULL,
  is_ai_suggested BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.consultation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.renovation_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_renovation_projects_user_id ON public.renovation_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_rooms_project_id ON public.project_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_room_work_items_room_id ON public.room_work_items(room_id);
CREATE INDEX IF NOT EXISTS idx_consultation_documents_project_id ON public.consultation_documents(project_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renovation_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phase2_profiles_select ON public.profiles;
CREATE POLICY phase2_profiles_select ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS phase2_profiles_update ON public.profiles;
CREATE POLICY phase2_profiles_update ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS phase2_projects_select ON public.renovation_projects;
CREATE POLICY phase2_projects_select ON public.renovation_projects FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS phase2_projects_insert ON public.renovation_projects;
CREATE POLICY phase2_projects_insert ON public.renovation_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS phase2_projects_update ON public.renovation_projects;
CREATE POLICY phase2_projects_update ON public.renovation_projects FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS phase2_projects_delete ON public.renovation_projects;
CREATE POLICY phase2_projects_delete ON public.renovation_projects FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS phase2_rooms_select ON public.project_rooms;
CREATE POLICY phase2_rooms_select ON public.project_rooms FOR SELECT USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = project_rooms.project_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_rooms_insert ON public.project_rooms;
CREATE POLICY phase2_rooms_insert ON public.project_rooms FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = project_rooms.project_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_rooms_update ON public.project_rooms;
CREATE POLICY phase2_rooms_update ON public.project_rooms FOR UPDATE USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = project_rooms.project_id AND rp.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = project_rooms.project_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_rooms_delete ON public.project_rooms;
CREATE POLICY phase2_rooms_delete ON public.project_rooms FOR DELETE USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = project_rooms.project_id AND rp.user_id = auth.uid()));

DROP POLICY IF EXISTS phase2_work_items_select ON public.room_work_items;
CREATE POLICY phase2_work_items_select ON public.room_work_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.project_rooms pr JOIN public.renovation_projects rp ON pr.project_id = rp.id WHERE pr.id = room_work_items.room_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_work_items_insert ON public.room_work_items;
CREATE POLICY phase2_work_items_insert ON public.room_work_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.project_rooms pr JOIN public.renovation_projects rp ON pr.project_id = rp.id WHERE pr.id = room_work_items.room_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_work_items_update ON public.room_work_items;
CREATE POLICY phase2_work_items_update ON public.room_work_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.project_rooms pr JOIN public.renovation_projects rp ON pr.project_id = rp.id WHERE pr.id = room_work_items.room_id AND rp.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.project_rooms pr JOIN public.renovation_projects rp ON pr.project_id = rp.id WHERE pr.id = room_work_items.room_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_work_items_delete ON public.room_work_items;
CREATE POLICY phase2_work_items_delete ON public.room_work_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.project_rooms pr JOIN public.renovation_projects rp ON pr.project_id = rp.id WHERE pr.id = room_work_items.room_id AND rp.user_id = auth.uid()));

DROP POLICY IF EXISTS phase2_documents_select ON public.consultation_documents;
CREATE POLICY phase2_documents_select ON public.consultation_documents FOR SELECT USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = consultation_documents.project_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_documents_insert ON public.consultation_documents;
CREATE POLICY phase2_documents_insert ON public.consultation_documents FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = consultation_documents.project_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_documents_update ON public.consultation_documents;
CREATE POLICY phase2_documents_update ON public.consultation_documents FOR UPDATE USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = consultation_documents.project_id AND rp.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = consultation_documents.project_id AND rp.user_id = auth.uid()));
DROP POLICY IF EXISTS phase2_documents_delete ON public.consultation_documents;
CREATE POLICY phase2_documents_delete ON public.consultation_documents FOR DELETE USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = consultation_documents.project_id AND rp.user_id = auth.uid()));
