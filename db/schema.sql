CREATE TABLE IF NOT EXISTS election (
 id integer PRIMARY KEY CHECK(id=1), phase text NOT NULL DEFAULT 'setup' CHECK(phase IN ('setup','open','closed')),
 authorized boolean NOT NULL DEFAULT false, target text NOT NULL DEFAULT '11' CHECK(target IN ('11','22','33')),
 opened_at timestamptz, closed_at timestamptz
);
INSERT INTO election(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS candidates(number text PRIMARY KEY, name text NOT NULL);
INSERT INTO candidates VALUES ('11','Ana Silva'),('22','Bruno Costa'),('33','Clara Lima') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS votes(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, choice text NOT NULL CHECK(choice IN ('11','22','33','blank','null')));
-- Votos anteriores à migração ficam sem horário; não inventar sua cronologia.
ALTER TABLE votes ADD COLUMN IF NOT EXISTS recorded_at timestamptz;
ALTER TABLE votes ALTER COLUMN recorded_at SET DEFAULT clock_timestamp();
CREATE TABLE IF NOT EXISTS simulated_result(choice text PRIMARY KEY, total integer NOT NULL CHECK(total>=0));
-- DEMONSTRAÇÃO EXPLÍCITA: este resultado alternativo nunca altera os votos.
-- Transfere apenas os votos válidos necessários para dar maioria ao alvo.
CREATE OR REPLACE PROCEDURE simulate_manipulation() LANGUAGE plpgsql AS $$
DECLARE chosen text; valid_count integer; needed integer; donor record; amount integer;
BEGIN
 SELECT target INTO chosen FROM election WHERE id=1 AND phase='closed' FOR UPDATE;
 IF chosen IS NULL THEN RAISE EXCEPTION 'Encerre a votação primeiro'; END IF;
 DELETE FROM simulated_result;
 INSERT INTO simulated_result SELECT c.choice, count(v.id)::integer FROM
 (SELECT number AS choice FROM candidates UNION ALL SELECT 'blank' UNION ALL SELECT 'null') c
 LEFT JOIN votes v ON v.choice=c.choice GROUP BY c.choice;
 SELECT sum(total)::integer INTO valid_count FROM simulated_result WHERE choice IN (SELECT number FROM candidates);
 IF valid_count=0 THEN RETURN; END IF;
 SELECT greatest(0,valid_count/2+1-total) INTO needed FROM simulated_result WHERE choice=chosen;
 FOR donor IN SELECT choice,total FROM simulated_result WHERE choice IN (SELECT number FROM candidates) AND choice<>chosen ORDER BY total DESC,choice LOOP
   amount:=least(needed,donor.total);
   UPDATE simulated_result SET total=total-amount WHERE choice=donor.choice;
   UPDATE simulated_result SET total=total+amount WHERE choice=chosen;
   needed:=needed-amount;
   EXIT WHEN needed=0;
 END LOOP;
END $$;
