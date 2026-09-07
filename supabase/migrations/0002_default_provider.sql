-- 0001 seeded 'brightdata' as the default provider. Measurement showed that provider
-- returns no post content, and twitterapi.io replaced it (see docs/SPEC.md). 0001 is
-- already applied, so this corrects the seeded value forward rather than editing it.
update settings
set value = '"twitterapi"'::jsonb, updated_at = now()
where key = 'primary_provider' and value = '"brightdata"'::jsonb;
