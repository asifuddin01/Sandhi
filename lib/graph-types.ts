export type GraphNodeKind =
  "theme" | "area" | "project" | "person" | "publication";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  description: string;
  href: string;
  themeSlugs: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship:
    | "contains"
    | "studies"
    | "works-on"
    | "researches"
    | "authored"
    | "produced";
}

export interface GraphThemeFilter {
  slug: string;
  name: string;
}

export interface PublicGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  themes: GraphThemeFilter[];
  summary: string;
  sparse: boolean;
}
