-- 0002 pointed primary_provider at a provider that has since been withdrawn: measurement
-- showed the alternative failed for exactly the small accounts a developer event attracts,
-- and carried no eligibility indicators. See docs/SPEC.md and the C3 brief.
--
-- 0002 is already applied, so this corrects the value forward rather than editing it.
update settings
set value = '"brightdata"'::jsonb, updated_at = now()
where key = 'primary_provider' and value <> '"brightdata"'::jsonb;
