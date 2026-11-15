-- The Support Shop (Paddle passes and bundles) was removed from Court Vision on 2026-11-12.
-- Run this once in the Supabase SQL editor to delete its table. It held which accounts had bought a pass or bundle.
-- Paddle, as merchant of record, keeps its own order records; download anything you need from Paddle first.
drop table if exists public.entitlements;
