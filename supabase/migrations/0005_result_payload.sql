-- The rendered result is stored whole rather than spread across columns.
--
-- There are now two result shapes - a scored analysis and a profile signal - and they do not
-- share a column set. Storing the payload keeps the poll endpoint a single read and means a
-- change to what the result contains is not a migration.
--
-- The scalar columns above it stay: the board aggregates over them, and a jsonb scan for a
-- leaderboard would be the wrong tool.
alter table analyses add column if not exists result jsonb;
alter table analyses add column if not exists result_kind text;
