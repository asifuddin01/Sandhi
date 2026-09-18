/**
 * Cache tags for public data. Admin mutations expire the tags they affect;
 * cached public queries carry the same tags.
 */
export const cacheTags = {
  settings: "settings",
  members: "members",
  research: "research",
  projects: "projects",
  publications: "publications",
  news: "news",
  events: "events",
  opportunities: "opportunities",
  resources: "resources",
  insights: "insights",
  partners: "partners",
} as const;

export type CacheTag = (typeof cacheTags)[keyof typeof cacheTags];
