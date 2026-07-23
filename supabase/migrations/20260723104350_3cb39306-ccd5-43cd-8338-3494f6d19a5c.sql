
INSERT INTO public.posts (slug, title, excerpt, content, author_name, published, published_at)
SELECT '_about', 'About Me', NULL, COALESCE((SELECT value FROM public.site_settings WHERE key = 'about'), ''), 'Editor', false, now()
WHERE NOT EXISTS (SELECT 1 FROM public.posts WHERE slug = '_about');
