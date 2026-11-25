-- Run in a disposable, empty PostgreSQL database as its administrator.
\set ON_ERROR_STOP on
CREATE TABLE public.shield_fixture_widgets (id integer PRIMARY KEY);
INSERT INTO public.shield_fixture_widgets VALUES (1);
CREATE ROLE shield_fixture_reader NOLOGIN;
GRANT SELECT ON public.shield_fixture_widgets TO shield_fixture_reader;

CREATE FUNCTION public.shield_fixture_write() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog
AS $$ INSERT INTO public.shield_fixture_widgets VALUES (4) $$;
REVOKE ALL ON FUNCTION public.shield_fixture_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shield_fixture_write() TO shield_fixture_reader;
SET ROLE shield_fixture_reader;

BEGIN READ ONLY;
SELECT count(*) = 1 AS read_ok FROM public.shield_fixture_widgets \gset
COMMIT;

\set ON_ERROR_STOP off
BEGIN READ ONLY;
INSERT INTO public.shield_fixture_widgets VALUES (2);
\set direct_state :SQLSTATE
ROLLBACK;

BEGIN READ ONLY;
-- Send both statements to the server in one request.
SELECT 1 \; INSERT INTO public.shield_fixture_widgets VALUES (3);
\set batch_state :SQLSTATE
ROLLBACK;

BEGIN READ ONLY;
SELECT public.shield_fixture_write();
\set function_state :SQLSTATE
ROLLBACK;
\set ON_ERROR_STOP on

SELECT :'read_ok'::boolean AND :'direct_state' = '25006' AND :'batch_state' = '25006'
  AND :'function_state' = '25006' AND array_agg(id ORDER BY id) = ARRAY[1] AS passed
FROM public.shield_fixture_widgets \gset
\if :passed
  \echo Read succeeded and all three write attempts were rejected
\else
  \echo Unexpected SQL states: direct :direct_state batch :batch_state function :function_state
  DO $$ BEGIN RAISE EXCEPTION 'Read-only SQL fixture failed'; END $$;
\endif
