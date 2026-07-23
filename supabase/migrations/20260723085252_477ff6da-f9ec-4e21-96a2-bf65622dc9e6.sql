
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT USING (true);

CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL DEFAULT '',
  cover_image TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Editor',
  published BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_public_read" ON public.posts FOR SELECT USING (published = true);
CREATE INDEX posts_published_at_idx ON public.posts (published_at DESC);
CREATE INDEX posts_category_idx ON public.posts (category_id);

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.comments TO anon, authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON public.comments FOR SELECT USING (approved = true);
CREATE POLICY "comments_public_insert" ON public.comments FOR INSERT WITH CHECK (
  length(author_name) BETWEEN 1 AND 50 AND
  length(content) BETWEEN 1 AND 2000
);
CREATE INDEX comments_post_idx ON public.comments (post_id, created_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed
INSERT INTO public.categories (slug, name, description) VALUES
  ('travel', 'Travel', 'Destinations & journeys'),
  ('stories', 'Stories', 'Personal essays and adventures'),
  ('guides', 'Guides', 'Practical how-tos'),
  ('reviews', 'Reviews', 'Places, gear, and experiences');

INSERT INTO public.posts (slug, title, excerpt, content, category_id, author_name, published_at) VALUES
  ('welcome-to-mysextrip', 'Welcome to mysextrip', 'A new home for uncensored travel stories, honest reviews, and the routes worth taking.',
   E'We started mysextrip because the best travel writing had gotten too polite.\n\nExpect long-form essays, city guides you can actually use, and reviews that don''t take themselves too seriously. Pull up a chair.',
   (SELECT id FROM public.categories WHERE slug='stories'), 'Editor', now() - interval '1 day'),
  ('bangkok-after-midnight', 'Bangkok After Midnight', 'The city changes shape once the last skytrain shuts down. Here''s where to actually go.',
   E'The tuk-tuks slow down around 1am — that''s when you know you''ve found the right neighborhood.\n\nStart on Soi 11, drift toward Thonglor, and end up somewhere you can''t remember the name of. That''s the rule.',
   (SELECT id FROM public.categories WHERE slug='travel'), 'Editor', now() - interval '3 days'),
  ('lisbon-on-a-shoestring', 'Lisbon On A Shoestring', 'You don''t need a fat wallet to eat well, sleep decently, and see the good stuff in Lisbon.',
   E'The pastel de nata at Manteigaria is €1.30. That should tell you everything.\n\nRent a room in Graça, not Chiado. Ride the 28 tram at 7am before the tourists wake up. Say yes to the ginjinha.',
   (SELECT id FROM public.categories WHERE slug='guides'), 'Editor', now() - interval '7 days');
