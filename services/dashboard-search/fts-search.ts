import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma-client";
import { DashboardSearchGroup, DashboardSearchItem, DashboardSearchResult, DashboardSearchSection } from "@/types";

type FtsRow = {
  id: string;
  entity_type: string;
  title: string;
  description: string;
  href: string;
  metadata: Record<string, string> | null;
  rank: number;
};

const SECTION_LABELS: Record<DashboardSearchSection, string> = {
  insights: "Insights",
  learners: "Learners",
  batches: "Batches",
  trainers: "Trainers",
  programs: "Programs",
  courses: "Courses",
  assessments: "Assessments",
  curriculum: "Curriculum",
  centres: "Training Centres",
  course_content: "Course Content",
  users: "Users",
  learning_resources: "Learning Resources",
  language_lab: "Language Lab",
};

/**
 * Check whether the search_index materialized view exists.
 * Returns false if the view hasn't been created yet (graceful degradation).
 */
async function isFtsAvailable(): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_matviews WHERE matviewname = 'search_index'
      ) AS exists
    `;
    return result[0]?.exists ?? false;
  } catch {
    return false;
  }
}

/**
 * Full-text search across all entity types using the materialized view.
 * Combines tsvector ranking with trigram similarity for fuzzy matching.
 */
export async function ftsSearchService(
  query: string,
  limitPerGroup: number = 5,
): Promise<DashboardSearchResult | null> {
  const available = await isFtsAvailable();
  if (!available) return null;

  const sanitized = query.trim();
  if (sanitized.length < 2) {
    return { query: sanitized, total: 0, groups: [] };
  }

  try {
    const rows = await prisma.$queryRaw<FtsRow[]>`
      SELECT
        id,
        entity_type,
        title,
        description,
        href,
        metadata,
        (
          TS_RANK_CD(search_vector, plainto_tsquery('english', ${sanitized})) * 2.0 +
          SIMILARITY(title, ${sanitized})
        ) AS rank
      FROM search_index
      WHERE
        search_vector @@ plainto_tsquery('english', ${sanitized})
        OR SIMILARITY(title, ${sanitized}) > 0.15
      ORDER BY rank DESC, sort_title ASC
      LIMIT ${limitPerGroup * 13}
    `;

    // Group results by entity_type and limit per group
    const grouped = new Map<string, DashboardSearchItem[]>();

    for (const row of rows) {
      const section = row.entity_type as DashboardSearchSection;
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      const items = grouped.get(section)!;
      if (items.length >= limitPerGroup) continue;

      items.push({
        id: row.id,
        section,
        title: row.title,
        description: row.description,
        href: row.href,
        metadata: row.metadata ?? undefined,
      });
    }

    const sectionOrder: DashboardSearchSection[] = [
      "learners", "batches", "trainers", "courses", "programs",
      "assessments", "curriculum", "centres", "course_content",
      "users", "learning_resources", "language_lab",
    ];

    const groups: DashboardSearchGroup[] = sectionOrder
      .filter((section) => grouped.has(section) && grouped.get(section)!.length > 0)
      .map((section) => ({
        key: section,
        label: SECTION_LABELS[section],
        items: grouped.get(section)!,
      }));

    return {
      query: sanitized,
      total: groups.reduce((sum, g) => sum + g.items.length, 0),
      groups,
    };
  } catch (error) {
    console.warn("FTS search failed, returning null for fallback", error);
    return null;
  }
}

/**
 * Refresh the search_index materialized view.
 * Call this after CRUD mutations on searchable entities.
 */
export async function refreshSearchIndex(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT refresh_search_index()`;
  } catch (error) {
    console.warn("Failed to refresh search index", error);
  }
}
