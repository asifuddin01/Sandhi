import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ThemeDetail } from "@/components/entries/ThemeDetail";
import { getThemeBySlug } from "@/lib/public-research";

export const dynamic = "force-dynamic";

interface ThemePageProps {
  params: Promise<{ theme: string }>;
}

export async function generateMetadata({
  params,
}: ThemePageProps): Promise<Metadata> {
  const { theme: slug } = await params;
  const theme = await getThemeBySlug(slug);

  if (!theme) return { title: "Research theme not found" };

  return {
    title: theme.name,
    description: theme.gloss,
    alternates: { canonical: `/research/${theme.slug}` },
  };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const { theme: slug } = await params;
  const theme = await getThemeBySlug(slug);
  if (!theme) notFound();

  return <ThemeDetail theme={theme} />;
}
