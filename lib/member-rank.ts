/**
 * What a person is called in the lab, and the order those standings run in.
 * These are titles people hold, so they are set in title case.
 * Kept out of `lib/admin/members.ts` so public components can read it too —
 * the People page and the members manager have to agree about what a rank is
 * called, and two copies of a label map is how they stop agreeing.
 */

export const memberRanks = [
  "DIRECTOR",
  "RESEARCH_LEAD",
  "RESEARCHER",
  "RESEARCH_ASSISTANT",
  "INTERN",
  "COLLABORATOR",
] as const;

export const memberStatuses = [
  "INVITED",
  "ACTIVE",
  "ALUMNI",
  "SUSPENDED",
] as const;

export type MemberRankValue = (typeof memberRanks)[number];
export type MemberStatusValue = (typeof memberStatuses)[number];

export const rankLabels: Record<MemberRankValue, string> = {
  DIRECTOR: "Director",
  RESEARCH_LEAD: "Research Lead",
  RESEARCHER: "Researcher",
  RESEARCH_ASSISTANT: "Research Assistant",
  INTERN: "Research Intern",
  COLLABORATOR: "Collaborator",
};

export const statusLabels: Record<MemberStatusValue, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  ALUMNI: "Alumni",
  SUSPENDED: "Suspended",
};

export function rankLabel(rank: string): string {
  return rankLabels[rank as MemberRankValue] ?? rank;
}

/**
 * How the People page is divided. One heading per standing, in the order the
 * lab reads itself, and an empty one is not drawn at all — a lab of three
 * does not need six headings to say so.
 */
export const PEOPLE_GROUPS: ReadonlyArray<{
  title: string;
  rank: MemberRankValue;
}> = [
  { title: "Direction", rank: "DIRECTOR" },
  { title: "Research Leads", rank: "RESEARCH_LEAD" },
  { title: "Researchers", rank: "RESEARCHER" },
  { title: "Research Assistants", rank: "RESEARCH_ASSISTANT" },
  { title: "Research Interns", rank: "INTERN" },
  { title: "Collaborators", rank: "COLLABORATOR" },
];
