-- Centralized PostgreSQL full-text search support for every public entity in
-- the command palette, plus publication author names.

CREATE FUNCTION sandhi_member_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."title", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."bio", '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW."interests", ARRAY[]::text[]), ' ')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE FUNCTION sandhi_project_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."gloss", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."abstract", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW."question", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE FUNCTION sandhi_publication_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."search_authors", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."venueName", '') || ' ' || coalesce(NEW."venueShort", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."abstract", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE FUNCTION sandhi_news_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."excerpt", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."body", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE FUNCTION sandhi_insight_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" := setweight(to_tsvector('english', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."summary", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."body", '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE FUNCTION sandhi_refresh_publication_authors() RETURNS trigger AS $$
DECLARE
  target_publication_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_publication_id := OLD."publicationId";
  ELSE
    target_publication_id := NEW."publicationId";
  END IF;

  UPDATE "Publication"
  SET "search_authors" = coalesce((
    SELECT string_agg(coalesce(m."name", pa."externalName", ''), ' ' ORDER BY pa."position")
    FROM "PublicationAuthor" pa
    LEFT JOIN "Member" m ON m."id" = pa."memberId"
    WHERE pa."publicationId" = target_publication_id
  ), '')
  WHERE "id" = target_publication_id;

  IF TG_OP = 'UPDATE' AND OLD."publicationId" <> NEW."publicationId" THEN
    UPDATE "Publication"
    SET "search_authors" = coalesce((
      SELECT string_agg(coalesce(m."name", pa."externalName", ''), ' ' ORDER BY pa."position")
      FROM "PublicationAuthor" pa
      LEFT JOIN "Member" m ON m."id" = pa."memberId"
      WHERE pa."publicationId" = OLD."publicationId"
    ), '')
    WHERE "id" = OLD."publicationId";
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_search_vector_before_write
BEFORE INSERT OR UPDATE OF "name", "title", "bio", "interests" ON "Member"
FOR EACH ROW EXECUTE FUNCTION sandhi_member_search_vector();

CREATE TRIGGER project_search_vector_before_write
BEFORE INSERT OR UPDATE OF "title", "gloss", "abstract", "question" ON "Project"
FOR EACH ROW EXECUTE FUNCTION sandhi_project_search_vector();

CREATE TRIGGER publication_search_vector_before_write
BEFORE INSERT OR UPDATE OF "title", "abstract", "venueName", "venueShort", "search_authors" ON "Publication"
FOR EACH ROW EXECUTE FUNCTION sandhi_publication_search_vector();

CREATE TRIGGER publication_authors_after_write
AFTER INSERT OR UPDATE OR DELETE ON "PublicationAuthor"
FOR EACH ROW EXECUTE FUNCTION sandhi_refresh_publication_authors();

CREATE TRIGGER news_search_vector_before_write
BEFORE INSERT OR UPDATE OF "title", "excerpt", "body" ON "NewsPost"
FOR EACH ROW EXECUTE FUNCTION sandhi_news_search_vector();

CREATE TRIGGER insight_search_vector_before_write
BEFORE INSERT OR UPDATE OF "title", "summary", "body" ON "Insight"
FOR EACH ROW EXECUTE FUNCTION sandhi_insight_search_vector();

CREATE INDEX member_search_vector_gin ON "Member" USING GIN ("search_vector");
CREATE INDEX project_search_vector_gin ON "Project" USING GIN ("search_vector");
CREATE INDEX publication_search_vector_gin ON "Publication" USING GIN ("search_vector");
CREATE INDEX news_search_vector_gin ON "NewsPost" USING GIN ("search_vector");
CREATE INDEX insight_search_vector_gin ON "Insight" USING GIN ("search_vector");
