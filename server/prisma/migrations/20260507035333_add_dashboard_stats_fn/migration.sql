CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  "totalTickets"         BIGINT,
  "openTickets"          BIGINT,
  "aiResolvedCount"      BIGINT,
  "aiResolvedPercentage" NUMERIC,
  "avgResolutionHours"   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*)::BIGINT
      AS "totalTickets",

    COUNT(*) FILTER (WHERE status::text = 'OPEN')::BIGINT
      AS "openTickets",

    COUNT(*) FILTER (
      WHERE status::text IN ('RESOLVED', 'CLOSED')
        AND "aiSuggestedReply" IS NOT NULL
    )::BIGINT
      AS "aiResolvedCount",

    CASE
      WHEN COUNT(*) FILTER (WHERE status::text IN ('RESOLVED', 'CLOSED')) = 0
        THEN 0::NUMERIC
      ELSE ROUND(
        COUNT(*) FILTER (
          WHERE status::text IN ('RESOLVED', 'CLOSED')
            AND "aiSuggestedReply" IS NOT NULL
        )::NUMERIC
        / COUNT(*) FILTER (
            WHERE status::text IN ('RESOLVED', 'CLOSED')
          )::NUMERIC * 100,
        1
      )
    END
      AS "aiResolvedPercentage",

    ROUND(
      EXTRACT(EPOCH FROM
        AVG("updatedAt" - "createdAt")
        FILTER (WHERE status::text IN ('RESOLVED', 'CLOSED'))
      ) / 3600,
      1
    )
      AS "avgResolutionHours"

  FROM "Ticket";
$$;
