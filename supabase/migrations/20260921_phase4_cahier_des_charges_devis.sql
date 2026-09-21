-- ==========================================================================
-- MIGRATION PHASE 4 : CAHIER DES CHARGES ET DEVIS STRUCTURES
-- Version finale candidate - aucune execution incluse
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.specification_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.renovation_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brief_contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES public.specification_briefs(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_brief_contractor UNIQUE (brief_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS public.contractor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES public.specification_briefs(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  global_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (global_amount >= 0),
  delay_weeks INT NOT NULL DEFAULT 0 CHECK (delay_weeks >= 0),
  proposal_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_brief_contractor_quote UNIQUE (brief_id, contractor_id)
);

CREATE TABLE IF NOT EXISTS public.contractor_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.contractor_quotes(id) ON DELETE CASCADE,
  room_work_item_id UUID NOT NULL REFERENCES public.room_work_items(id) ON DELETE CASCADE,
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  quantity NUMERIC(8, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_price >= 0),
  item_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uk_quote_work_item UNIQUE (quote_id, room_work_item_id)
);

CREATE INDEX IF NOT EXISTS idx_phase4_briefs_project_id ON public.specification_briefs(project_id);
CREATE INDEX IF NOT EXISTS idx_phase4_brief_contractors_brief_id ON public.brief_contractors(brief_id);
CREATE INDEX IF NOT EXISTS idx_phase4_brief_contractors_contractor_id ON public.brief_contractors(contractor_id);
CREATE INDEX IF NOT EXISTS idx_phase4_quotes_brief_id ON public.contractor_quotes(brief_id);
CREATE INDEX IF NOT EXISTS idx_phase4_quotes_contractor_id ON public.contractor_quotes(contractor_id);
CREATE INDEX IF NOT EXISTS idx_phase4_quote_items_quote_id ON public.contractor_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_phase4_quote_items_work_item_id ON public.contractor_quote_items(room_work_item_id);

CREATE OR REPLACE FUNCTION public.phase4_calculate_quote_item_total()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public, pg_temp LANGUAGE plpgsql AS $$
BEGIN
  NEW.total_price := ROUND(NEW.unit_price * NEW.quantity, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS phase4_calculate_quote_item_total ON public.contractor_quote_items;
CREATE TRIGGER phase4_calculate_quote_item_total BEFORE INSERT OR UPDATE OF unit_price, quantity ON public.contractor_quote_items FOR EACH ROW EXECUTE FUNCTION public.phase4_calculate_quote_item_total();

CREATE OR REPLACE FUNCTION public.phase4_verify_quote_item_project()
RETURNS TRIGGER SECURITY DEFINER SET search_path = public, pg_temp LANGUAGE plpgsql AS $$
DECLARE
  v_brief_project_id UUID;
  v_item_project_id UUID;
BEGIN
  SELECT sb.project_id INTO v_brief_project_id FROM public.contractor_quotes cq JOIN public.specification_briefs sb ON sb.id = cq.brief_id WHERE cq.id = NEW.quote_id;
  SELECT pr.project_id INTO v_item_project_id FROM public.room_work_items rwi JOIN public.project_rooms pr ON pr.id = rwi.room_id WHERE rwi.id = NEW.room_work_item_id;
  IF v_brief_project_id IS NULL OR v_item_project_id IS NULL OR v_brief_project_id <> v_item_project_id THEN
    RAISE EXCEPTION 'Le poste de travail n''appartient pas au projet du cahier des charges';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS phase4_verify_quote_item_project ON public.contractor_quote_items;
CREATE TRIGGER phase4_verify_quote_item_project BEFORE INSERT OR UPDATE OF quote_id, room_work_item_id ON public.contractor_quote_items FOR EACH ROW EXECUTE FUNCTION public.phase4_verify_quote_item_project();

CREATE OR REPLACE FUNCTION public.phase4_respond_to_invitation(p_invitation_id UUID, p_status TEXT)
RETURNS VOID SECURITY INVOKER SET search_path = public, pg_temp LANGUAGE plpgsql AS $$
BEGIN
  IF p_status NOT IN ('accepted', 'declined') THEN RAISE EXCEPTION 'Statut d''invitation invalide'; END IF;
  UPDATE public.brief_contractors SET status = p_status WHERE id = p_invitation_id AND contractor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise');
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation introuvable ou non autorisee'; END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.phase4_respond_to_invitation(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.phase4_respond_to_invitation(UUID, TEXT) TO authenticated;

ALTER TABLE public.specification_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brief_contractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractor_quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS phase4_briefs_owner_select ON public.specification_briefs;
DROP POLICY IF EXISTS phase4_briefs_owner_insert ON public.specification_briefs;
DROP POLICY IF EXISTS phase4_briefs_owner_update ON public.specification_briefs;
DROP POLICY IF EXISTS phase4_briefs_owner_delete ON public.specification_briefs;
DROP POLICY IF EXISTS phase4_briefs_contractor_select ON public.specification_briefs;

CREATE POLICY phase4_briefs_owner_select ON public.specification_briefs FOR SELECT USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = specification_briefs.project_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_briefs_owner_insert ON public.specification_briefs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = specification_briefs.project_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_briefs_owner_update ON public.specification_briefs FOR UPDATE USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = specification_briefs.project_id AND rp.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = specification_briefs.project_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_briefs_owner_delete ON public.specification_briefs FOR DELETE USING (EXISTS (SELECT 1 FROM public.renovation_projects rp WHERE rp.id = specification_briefs.project_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_briefs_contractor_select ON public.specification_briefs FOR SELECT USING (status = 'published' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise') AND EXISTS (SELECT 1 FROM public.brief_contractors bc WHERE bc.brief_id = specification_briefs.id AND bc.contractor_id = auth.uid() AND bc.status IN ('invited', 'accepted')));

DROP POLICY IF EXISTS phase4_bc_owner_select ON public.brief_contractors;
DROP POLICY IF EXISTS phase4_bc_owner_insert ON public.brief_contractors;
DROP POLICY IF EXISTS phase4_bc_owner_update ON public.brief_contractors;
DROP POLICY IF EXISTS phase4_bc_owner_delete ON public.brief_contractors;
DROP POLICY IF EXISTS phase4_bc_contractor_select ON public.brief_contractors;

CREATE POLICY phase4_bc_owner_select ON public.brief_contractors FOR SELECT USING (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = brief_contractors.brief_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_bc_owner_insert ON public.brief_contractors FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = brief_contractors.brief_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_bc_owner_update ON public.brief_contractors FOR UPDATE USING (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = brief_contractors.brief_id AND rp.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = brief_contractors.brief_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_bc_owner_delete ON public.brief_contractors FOR DELETE USING (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = brief_contractors.brief_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_bc_contractor_select ON public.brief_contractors FOR SELECT USING (contractor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise'));

DROP POLICY IF EXISTS phase4_quotes_contractor_select ON public.contractor_quotes;
DROP POLICY IF EXISTS phase4_quotes_contractor_insert ON public.contractor_quotes;
DROP POLICY IF EXISTS phase4_quotes_contractor_update ON public.contractor_quotes;
DROP POLICY IF EXISTS phase4_quotes_contractor_delete ON public.contractor_quotes;
DROP POLICY IF EXISTS phase4_quotes_owner_select ON public.contractor_quotes;
DROP POLICY IF EXISTS phase4_quotes_owner_update ON public.contractor_quotes;

CREATE POLICY phase4_quotes_contractor_select ON public.contractor_quotes FOR SELECT USING (contractor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise'));
CREATE POLICY phase4_quotes_contractor_insert ON public.contractor_quotes FOR INSERT WITH CHECK (contractor_id = auth.uid() AND status = 'draft' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise') AND EXISTS (SELECT 1 FROM public.brief_contractors bc WHERE bc.brief_id = contractor_quotes.brief_id AND bc.contractor_id = auth.uid() AND bc.status = 'accepted'));
CREATE POLICY phase4_quotes_contractor_update ON public.contractor_quotes FOR UPDATE USING (contractor_id = auth.uid() AND status = 'draft') WITH CHECK (contractor_id = auth.uid() AND status IN ('draft', 'submitted'));
CREATE POLICY phase4_quotes_contractor_delete ON public.contractor_quotes FOR DELETE USING (contractor_id = auth.uid() AND status = 'draft');
CREATE POLICY phase4_quotes_owner_select ON public.contractor_quotes FOR SELECT USING (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = contractor_quotes.brief_id AND rp.user_id = auth.uid()));
CREATE POLICY phase4_quotes_owner_update ON public.contractor_quotes FOR UPDATE USING (EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = contractor_quotes.brief_id AND rp.user_id = auth.uid())) WITH CHECK (status IN ('accepted', 'rejected') AND EXISTS (SELECT 1 FROM public.specification_briefs sb JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE sb.id = contractor_quotes.brief_id AND rp.user_id = auth.uid()));

DROP POLICY IF EXISTS phase4_quote_items_contractor_select ON public.contractor_quote_items;
DROP POLICY IF EXISTS phase4_quote_items_contractor_insert ON public.contractor_quote_items;
DROP POLICY IF EXISTS phase4_quote_items_contractor_update ON public.contractor_quote_items;
DROP POLICY IF EXISTS phase4_quote_items_contractor_delete ON public.contractor_quote_items;
DROP POLICY IF EXISTS phase4_quote_items_owner_select ON public.contractor_quote_items;

CREATE POLICY phase4_quote_items_contractor_select ON public.contractor_quote_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.contractor_quotes cq WHERE cq.id = contractor_quote_items.quote_id AND cq.contractor_id = auth.uid() AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise')));
CREATE POLICY phase4_quote_items_contractor_insert ON public.contractor_quote_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.contractor_quotes cq JOIN public.specification_briefs sb ON sb.id = cq.brief_id JOIN public.renovation_projects rp ON rp.id = sb.project_id JOIN public.project_rooms pr ON pr.project_id = rp.id JOIN public.room_work_items rwi ON rwi.room_id = pr.id WHERE cq.id = contractor_quote_items.quote_id AND cq.contractor_id = auth.uid() AND cq.status = 'draft' AND rwi.id = contractor_quote_items.room_work_item_id AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise')));
CREATE POLICY phase4_quote_items_contractor_update ON public.contractor_quote_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.contractor_quotes cq WHERE cq.id = contractor_quote_items.quote_id AND cq.contractor_id = auth.uid() AND cq.status = 'draft')) WITH CHECK (EXISTS (SELECT 1 FROM public.contractor_quotes cq JOIN public.specification_briefs sb ON sb.id = cq.brief_id JOIN public.renovation_projects rp ON rp.id = sb.project_id JOIN public.project_rooms pr ON pr.project_id = rp.id JOIN public.room_work_items rwi ON rwi.room_id = pr.id WHERE cq.id = contractor_quote_items.quote_id AND cq.contractor_id = auth.uid() AND cq.status = 'draft' AND rwi.id = contractor_quote_items.room_work_item_id AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'entreprise')));
CREATE POLICY phase4_quote_items_contractor_delete ON public.contractor_quote_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.contractor_quotes cq WHERE cq.id = contractor_quote_items.quote_id AND cq.contractor_id = auth.uid() AND cq.status = 'draft'));
CREATE POLICY phase4_quote_items_owner_select ON public.contractor_quote_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.contractor_quotes cq JOIN public.specification_briefs sb ON sb.id = cq.brief_id JOIN public.renovation_projects rp ON rp.id = sb.project_id WHERE cq.id = contractor_quote_items.quote_id AND rp.user_id = auth.uid()));