-- Seed chapters based on Phase 0 open questions answers
INSERT INTO chapters (name, school_name, location, voting_method, quorum_percentage, voting_duration_hours)
VALUES
  ('Oregon', 'University of Oregon', 'Eugene, OR', 'QUORUM_MAJORITY', 50, 168),
  ('Cornell', 'Cornell University', 'Ithaca, NY', 'QUORUM_MAJORITY', 50, 168),
  ('Michigan', 'University of Michigan', 'Ann Arbor, MI', 'QUORUM_MAJORITY', 50, 168),
  ('UT Austin', 'University of Texas at Austin', 'Austin, TX', 'QUORUM_MAJORITY', 50, 168),
  ('Illini', 'University of Illinois', 'Urbana, IL', 'QUORUM_MAJORITY', 50, 168),
  ('FranklinDAO', 'Franklin University', 'Columbus, OH', 'QUORUM_MAJORITY', 50, 168),
  ('NYU', 'New York University', 'New York, NY', 'QUORUM_MAJORITY', 50, 168),
  ('Dartmouth', 'Dartmouth College', 'Hanover, NH', 'QUORUM_MAJORITY', 50, 168),
  ('Boiler Blockchain', 'Purdue University', 'West Lafayette, IN', 'QUORUM_MAJORITY', 50, 168),
  ('Vanderbilt', 'Vanderbilt University', 'Nashville, TN', 'QUORUM_MAJORITY', 50, 168),
  ('Columbia', 'Columbia University', 'New York, NY', 'QUORUM_MAJORITY', 50, 168),
  ('UBC', 'University of British Columbia', 'Vancouver, BC', 'QUORUM_MAJORITY', 50, 168),
  ('Waterloo', 'University of Waterloo', 'Waterloo, ON', 'QUORUM_MAJORITY', 50, 168),
  ('Cambridge', 'University of Cambridge', 'Cambridge, UK', 'QUORUM_MAJORITY', 50, 168),
  ('Berkeley', 'UC Berkeley', 'Berkeley, CA', 'QUORUM_MAJORITY', 50, 168),
  ('ImperialDAO', 'Imperial College London', 'London, UK', 'QUORUM_MAJORITY', 50, 168)
ON CONFLICT DO NOTHING;

-- Seed chapter domains for email-based auto-assignment
INSERT INTO chapter_domains (chapter_id, email_domain)
SELECT chapters.id, domain FROM chapters
CROSS JOIN (VALUES
  (1, 'uoregon.edu'),
  (2, 'cornell.edu'),
  (3, 'umich.edu'),
  (4, 'utexas.edu'),
  (5, 'illinois.edu'),
  (6, 'franklin.edu'),
  (7, 'nyu.edu'),
  (8, 'dartmouth.edu'),
  (9, 'purdue.edu'),
  (10, 'vanderbilt.edu'),
  (11, 'columbia.edu'),
  (12, 'ubc.ca'),
  (13, 'uwaterloo.ca'),
  (14, 'cam.ac.uk'),
  (15, 'berkeley.edu'),
  (16, 'imperial.ac.uk')
) AS domains(seq, domain)
WHERE chapters.id = seq
ON CONFLICT DO NOTHING;
