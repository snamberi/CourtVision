-- The quick games' weekly boards: Guess the Player, Higher or Lower and the Bracket Challenge.
-- Run this once in the Supabase SQL editor. Until it runs, those three boards stay empty; everything else keeps working.
alter table public.weekly_scores drop constraint if exists weekly_scores_board_check;
alter table public.weekly_scores add constraint weekly_scores_board_check check (board in ('rebuild', 'career', 'hunt', 'perfect', 'guess', 'hilo', 'bracket'));
