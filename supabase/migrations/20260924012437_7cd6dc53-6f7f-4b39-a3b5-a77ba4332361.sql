CREATE TABLE public.portal_sections (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'auto',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.portal_sections TO service_role;
ALTER TABLE public.portal_sections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portal_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  session_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.portal_credentials TO service_role;
ALTER TABLE public.portal_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portal_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.portal_settings TO service_role;
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.portal_sections (slug, name, source_url, mode, sort_order) VALUES
  ('games', 'Games', 'https://sites.google.com/view/docsmath/home', 'proxy', 1),
  ('sports', 'Sports Streams', 'https://tvfun.mathfun.workers.dev/', 'frame', 2);

INSERT INTO public.portal_credentials (label, password_hash, permissions) VALUES
  ('Games access', 'pbkdf2$50000$BITo6JMe3nTKqH1pj0YnJg==$8lE/qVjA6AqphQE4jrbdwNhq+REAEI7q9l33siboNLY=', '{games}'),
  ('Sports access', 'pbkdf2$50000$Ty8yY9AI3dRJCZPtLOmoxw==$keLupqN8jTPxl5hySEfDr+XV9aZJ8GzxuYveQR2UqHo=', '{sports}'),
  ('Administrator', 'pbkdf2$50000$TFQNFAkC/dFy9ghAHSI0Aw==$hpghegKpCLYVhAG3FYkWN36bXYTP8hiaeWIzXPhcSVk=', '{admin}');

INSERT INTO public.portal_settings (key, value) VALUES
  ('password_gate_enabled', 'true'::jsonb),
  ('global_session_version', '1'::jsonb);