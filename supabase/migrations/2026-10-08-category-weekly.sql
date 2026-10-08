-- The Weekly Category Challenge board (Category Draft in the 82-0 Challenge).
-- Run this once in the Supabase SQL editor. Until it runs, that board stays empty; everything else keeps working.
alter table public.weekly_scores drop constraint if exists weekly_scores_board_check;
alter table public.weekly_scores add constraint weekly_scores_board_check check (board in ('rebuild', 'career', 'hunt', 'perfect', 'category', 'guess', 'hilo', 'bracket'));
