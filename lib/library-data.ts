import { getCatalogSupabase } from "@/lib/catalog";
import type { LandingData } from "@/components/Landing";

/**
 * Data for the landing page, read with the read-only (publishable
 * key) catalogue client. It mirrors what the public site shows: published
 * components, their stats, templates and sections. Every read fails soft, so a
 * missing key or an unreachable database yields an empty section, never an error.
 */

type Row = Record<string, any>;

const FREE_LIMIT = 36;
const PRO_LIMIT = 8;
const TRENDING_BADGES = 3;
const VIDEO = /\.(mp4|webm|mov)(\?|#|$)/i;
const SMALL = new Set(["to", "of", "and", "for", "in", "the", "a"]);

/** "call-to-action" -> "Call to action". */
function label(id: string): string {
  const words = id.split(/[-_\s]+/).filter(Boolean);
  return words.map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
}

const TECH: Record<string, string> = { react: "React", next: "Next.JS", vue: "Vue", nuxt: "Nuxt", svelte: "Svelte", astro: "Astro", remix: "Remix", angular: "Angular", vite: "Vite", typescript: "TypeScript" };

const COMPONENT_COLUMNS = "slug,display_name,kind,category,paid,thumbnail_url,gallery_media_url,gallery_poster_url,parent_id,variation_key";
const COMPONENT_COLUMNS_LEGACY = "slug,display_name,kind,category,thumbnail_url,gallery_media_url,gallery_poster_url";

async function publishedComponents(): Promise<Row[]> {
  const sb = getCatalogSupabase();
  if (!sb) return [];
  const run = (cols: string) =>
    sb.from("components").select(cols).eq("status", "published").or("kind.is.null,kind.neq.section");
  let res = await run(COMPONENT_COLUMNS);
  // A database that predates the paid / variation columns: retry without them.
  if (res.error?.code === "42703") res = await run(COMPONENT_COLUMNS_LEGACY);
  if (res.error || !res.data) return [];
  // The public site's totals include variations, so the counts here do too. They are only
  // left out of the featured picks (see isVariation).
  return res.data as unknown as Row[];
}

async function stats(): Promise<Map<string, { views: number; copies: number }>> {
  const out = new Map<string, { views: number; copies: number }>();
  const sb = getCatalogSupabase();
  if (!sb) return out;
  const { data, error } = await sb.from("component_stats").select("slug, views, copies");
  if (error || !data) return out;
  for (const r of data as Row[]) out.set(String(r.slug), { views: Number(r.views) || 0, copies: Number(r.copies) || 0 });
  return out;
}

async function loadAnimation(): Promise<LandingData["animation"]> {
  const rows = await publishedComponents();
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(String(r.category), (counts.get(String(r.category)) ?? 0) + 1);
  const categories = [...counts]
    .map(([id, count]) => ({ id, label: label(id), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const st = await stats();
  const score = (slug: string) => {
    const s = st.get(slug);
    return s ? s.views + s.copies * 5 : 0;
  };
  let copiesTotal = 0;
  for (const s of st.values()) copiesTotal += s.copies;

  const isVariation = (r: Row) => Boolean(r.parent_id && r.variation_key);
  const eligible = rows
    .filter((r) => !isVariation(r) && (r.gallery_poster_url || r.thumbnail_url))
    .sort((a, b) => score(String(b.slug)) - score(String(a.slug)));
  const free = eligible.filter((r) => !r.paid).slice(0, FREE_LIMIT);
  const pro = eligible.filter((r) => r.paid).slice(0, PRO_LIMIT);
  const ranked = [...free, ...pro].sort((a, b) => score(String(b.slug)) - score(String(a.slug)));

  const items = ranked.map((r, i) => {
    const slug = String(r.slug);
    const media = typeof r.gallery_media_url === "string" ? r.gallery_media_url : "";
    return {
      name: slug,
      displayName: String(r.display_name || slug),
      categoryId: String(r.category),
      category: label(String(r.category)),
      image: String(r.gallery_poster_url || r.thumbnail_url),
      video: media && VIDEO.test(media) ? media : undefined,
      views: st.get(slug)?.views ?? 0,
      copies: st.get(slug)?.copies ?? 0,
      paid: Boolean(r.paid),
      trending: !r.paid && i < TRENDING_BADGES && score(slug) > 0,
    };
  });

  return { total: rows.length, paidTotal: rows.filter((r) => r.paid).length, copiesTotal, categories, items };
}

async function loadPages(): Promise<LandingData["pages"]> {
  const out: LandingData["pages"] = {
    templates: { total: 0, paid: 0, items: [] },
    sections: { total: 0, paid: 0, categories: [] },
  };
  const sb = getCatalogSupabase();
  if (!sb) return out;

  const t = await sb
    .from("templates")
    .select("slug,name,pages,tech_stack,card_image_url,paid,featured,position,created_at")
    .eq("status", "published")
    .order("position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (!t.error && t.data) {
    const rows = t.data as Row[];
    out.templates.total = rows.length;
    out.templates.paid = rows.filter((r) => r.paid).length;
    out.templates.items = [...rows]
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
      .filter((r) => r.card_image_url)
      .slice(0, 8)
      .map((r) => ({
        slug: String(r.slug),
        name: String(r.name),
        image: String(r.card_image_url),
        pages: Number(r.pages) || 0,
        tech: (Array.isArray(r.tech_stack) ? (r.tech_stack as string[]) : []).slice(0, 3).map((id) => TECH[id] ?? label(id)),
        paid: Boolean(r.paid),
      }));
  }

  const s = await sb.from("sections").select("slug,category,paid").eq("status", "published");
  if (!s.error && s.data) {
    const rows = s.data as Row[];
    out.sections.total = rows.length;
    out.sections.paid = rows.filter((r) => r.paid).length;
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(String(r.category), (counts.get(String(r.category)) ?? 0) + 1);
    out.sections.categories = [...counts]
      .map(([id, count]) => ({ id, label: label(id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }
  return out;
}

const EMPTY: { animation: LandingData["animation"]; pages: LandingData["pages"] } = {
  animation: { total: 0, paidTotal: 0, copiesTotal: 0, categories: [], items: [] },
  pages: { templates: { total: 0, paid: 0, items: [] }, sections: { total: 0, paid: 0, categories: [] } },
};

let cache: { at: number; value: typeof EMPTY } | null = null;
const TTL_MS = 5 * 60_000;

export async function loadLibraryData(): Promise<typeof EMPTY> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const [animation, pages] = await Promise.all([loadAnimation(), loadPages()]);
    cache = { at: Date.now(), value: { animation, pages } };
    return cache.value;
  } catch {
    return cache?.value ?? EMPTY;
  }
}
