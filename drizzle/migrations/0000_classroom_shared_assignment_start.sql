ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS started_at timestamptz;
GRANT SELECT, INSERT, UPDATE ON public.classrooms TO authenticated;
GRANT SELECT ON public.classroom_teams TO authenticated;
GRANT ALL ON public.classrooms, public.classroom_teams TO service_role;
CREATE OR REPLACE FUNCTION public.begin_classroom_assignment(room_id uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target public.classrooms%ROWTYPE; shared_start timestamptz;
BEGIN
 SELECT * INTO target FROM public.classrooms WHERE id = room_id FOR UPDATE;
 IF target.id IS NULL OR target.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF target.closed THEN RAISE EXCEPTION 'Classroom closed'; END IF;
 IF target.started_at IS NOT NULL THEN RETURN target.started_at; END IF;
 shared_start := clock_timestamp() + interval '2 seconds';
 UPDATE public.classroom_teams SET timings = jsonb_set(COALESCE(timings, '[{},{},{}]'::jsonb), '{0}', jsonb_build_object('started_at', shared_start, 'ended_at', null)), step = 0 WHERE classroom_id = room_id AND submitted_at IS NULL AND (timings->0->>'started_at') IS NULL;
 UPDATE public.classrooms SET started_at = shared_start WHERE id = room_id;
 RETURN shared_start;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_classroom_assignment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_classroom_assignment(uuid) TO authenticated;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='classroom_teams') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.classroom_teams; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='classrooms') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.classrooms; END IF;
END $$;