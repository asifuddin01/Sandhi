export const siteIdentity = {
  name: "SANDHI Research Lab",
  shortName: "SANDHI",
  domain: "sandhiresearch.org",
  url: "https://sandhiresearch.org",
  devanagari: "सन्धि",
  transliteration: "sandhi",
  meaning: "joining, connection, union, junction",
  tagline: "Where ideas meet, discovery begins.",
  founded: 2026,
} as const;

export const primaryNavigation = [
  { label: "Research", href: "/research" },
  { label: "Projects", href: "/projects" },
  { label: "Publications", href: "/publications" },
  { label: "People", href: "/people" },
  { label: "News", href: "/news" },
  { label: "About", href: "/about" },
] as const;

export const moreNavigation = [
  { label: "Events", href: "/events" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Resources", href: "/resources" },
  { label: "Insights", href: "/insights" },
  { label: "Open science", href: "/open-science" },
  { label: "Partners", href: "/partners" },
  { label: "Contact", href: "/contact" },
] as const;

export const commandNavigation = [
  ...primaryNavigation,
  ...moreNavigation,
  { label: "Join SANDHI", href: "/join" },
] as const;

export const homeCopy = {
  hero: {
    title: siteIdentity.name,
    tagline: siteIdentity.tagline,
    lead: "An independent research lab exploring artificial intelligence and computational science. We investigate difficult problems across vision, language, multimodal AI, and AI for science.",
    primaryAction: "Explore our research",
    secondaryAction: "Join SANDHI",
    origin: "सन्धि  ·  sandhi: the place where two things join.",
  },
  idea: {
    heading: "At the boundary, both sides change.",
    body: "In Sanskrit grammar, sandhi describes what happens where two words meet. Sounds shift, merge, and settle into something that reads as one. We think research works the same way. The most useful ideas rarely come from a single field. They form at the junctions, where methods, disciplines, and people meet and are changed by the meeting.",
    action: "Read about SANDHI",
  },
  philosophy: [
    {
      title: "Connect",
      description:
        "We bring together ideas, methods, and people from different fields.",
    },
    {
      title: "Investigate",
      description: "We pursue questions where existing methods fall short.",
    },
    {
      title: "Understand",
      description:
        "We test rigorously, so that results explain rather than merely impress.",
    },
    {
      title: "Contribute",
      description:
        "We publish, release code and data, and add knowledge others can build on.",
    },
  ],
  themesHeading: "What we study",
  themesAction: "See the map of connections",
  closing: {
    heading: "Research with us.",
    body: "We look for people who want to investigate difficult problems carefully and contribute knowledge that lasts.",
    action: "Join SANDHI",
  },
} as const;

export const researchThemes = [
  {
    name: "Perception",
    gloss: "How machines see",
    areas: ["Computer Vision"],
  },
  {
    name: "Language",
    gloss: "How machines read, reason, and speak",
    areas: ["Language Models & NLP"],
  },
  {
    name: "Junction",
    gloss: "Where modalities meet",
    areas: ["Vision-Language Models", "Multimodal AI"],
  },
  {
    name: "Understanding",
    gloss: "What is learned, and why it holds",
    areas: ["Representation Learning", "Causal Inference"],
  },
  {
    name: "Discovery",
    gloss: "Computation in service of science",
    areas: ["AI for Science", "Computational Biology"],
  },
] as const;

export const emptyStateCopy = {
  projects: "Our first projects will be published here soon.",
  publications: "Our first papers are in progress.",
  people: "Team profiles are being prepared.",
  news: "News from the lab will appear here.",
  events: "No events are scheduled. Seminars will be announced here.",
} as const;

export const footerNavigation = [
  {
    heading: "Research",
    links: [
      { label: "Research areas", href: "/research" },
      { label: "Projects", href: "/projects" },
      { label: "Publications", href: "/publications" },
      { label: "Resources", href: "/resources" },
      { label: "Insights", href: "/insights" },
      { label: "Open science", href: "/open-science" },
    ],
  },
  {
    heading: "Organization",
    links: [
      { label: "About", href: "/about" },
      { label: "People", href: "/people" },
      { label: "News", href: "/news" },
      { label: "Events", href: "/events" },
      { label: "Partners", href: "/partners" },
    ],
  },
  {
    heading: "Connect",
    links: [
      { label: "Contact", href: "/contact" },
      { label: "Join SANDHI", href: "/join" },
      { label: "Opportunities", href: "/opportunities" },
      { label: "RSS", href: "/feed.xml" },
    ],
  },
] as const;
