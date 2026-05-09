-- Alpha seed: Oregon Blockchain only
INSERT INTO chapters (name, school_name, location, voting_method, quorum_percentage, voting_duration_hours)
VALUES ('Oregon Blockchain', 'University of Oregon', 'Eugene, OR', 'QUORUM_MAJORITY', 50, 168)
ON CONFLICT DO NOTHING;

INSERT INTO chapter_domains (chapter_id, email_domain)
SELECT id, 'uoregon.edu' FROM chapters WHERE name = 'Oregon Blockchain'
ON CONFLICT DO NOTHING;
