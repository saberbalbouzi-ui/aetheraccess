BEGIN;

DROP FUNCTION IF EXISTS public.phase4_respond_to_invitation(UUID, TEXT);
DROP FUNCTION IF EXISTS public.phase4_verify_quote_item_project();
DROP FUNCTION IF EXISTS public.phase4_calculate_quote_item_total();

DROP TABLE IF EXISTS public.contractor_quote_items CASCADE;
DROP TABLE IF EXISTS public.contractor_quotes CASCADE;
DROP TABLE IF EXISTS public.brief_contractors CASCADE;
DROP TABLE IF EXISTS public.specification_briefs CASCADE;

COMMIT;