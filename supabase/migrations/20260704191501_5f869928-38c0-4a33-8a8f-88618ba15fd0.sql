
-- =========================================================
-- Profiles table (linked to auth.users)
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nombre_completo TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  unidad_organizacional TEXT NOT NULL DEFAULT '',
  iniciales TEXT NOT NULL DEFAULT '',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  rol TEXT NOT NULL DEFAULT 'user' CHECK (rol IN ('user','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper to avoid recursive policy evaluation on profiles.
CREATE OR REPLACE FUNCTION public.is_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND rol = 'admin'
  );
$$;

-- Policies
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- Document history
-- =========================================================
CREATE TABLE public.document_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cite TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX document_history_user_id_created_at_idx
  ON public.document_history (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_history TO authenticated;
GRANT ALL ON public.document_history TO service_role;

ALTER TABLE public.document_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own document history" ON public.document_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Users insert own document history" ON public.document_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
