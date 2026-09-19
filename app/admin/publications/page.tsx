import type { Metadata } from "next";

import {
  ContentIndex,
  formatAdminTime,
  StatusCell,
} from "@/components/admin/ContentIndex";
import { getPublicationsIndex } from "@/lib/admin/publications";
import { requireCapability } from "@/lib/authz";
import type { PublicationType } from "@/lib/bibtex";
import { publishStateLabels, unscheduledStates } from "@/lib/content-state";
import {
  PUBLICATION_STAGES,
  publicationStageLabels,
  publicationTypeLabels,
} from "@/lib/publications";

import { bulkPublicationsAction } from "./actions";

export const metadata: Metadata = { title: "Publications" };

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function PublicationsAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCapability("publications:publish", "/admin/publications");
  const params = await searchParams;
  const query = single(params.q);
  const state = single(params.state);
  const stage = single(params.stage);
  const { publications, total, page, pages, inReview } =
    await getPublicationsIndex({
      query,
      state,
      stage,
      page: Number(single(params.page)) || 1,
    });

  return (
    <ContentIndex
      heading="Publications"
      intro={
        inReview > 0
          ? `${inReview} ${inReview === 1 ? "publication is" : "publications are"} in internal review. Filter by stage to read them.`
          : "Record papers, preprints, datasets, and benchmarks, and move each one along its stage."
      }
      newHref="/admin/publications/new"
      newLabel="New publication"
      basePath="/admin/publications"
      query={query}
      filters={[
        {
          name: "stage",
          label: "Stage",
          value: stage,
          anyLabel: "Any stage",
          options: PUBLICATION_STAGES.map((value) => ({
            value,
            label: publicationStageLabels[value],
          })),
        },
        {
          name: "state",
          label: "State",
          value: state,
          anyLabel: "Any state",
          options: unscheduledStates.map((value) => ({
            value,
            label: publishStateLabels[value],
          })),
        },
      ]}
      columns={["Type", "Stage", "Status", "Updated"]}
      rows={publications.map((publication) => ({
        id: publication.id,
        title: publication.title,
        href: `/admin/publications/${publication.id}`,
        secondary: [
          publication.venueShort ?? publication.venueName,
          publication.year,
        ]
          .filter(Boolean)
          .join(" · "),
        cells: [
          publicationTypeLabels[publication.type as PublicationType],
          publicationStageLabels[
            publication.stage as keyof typeof publicationStageLabels
          ],
          // A published record can still be invisible: an accepted paper is
          // public, a submitted one is not, whatever its state says.
          publication.public ? (
            <StatusCell key="status" state="PUBLISHED" publishAt={null} />
          ) : (
            <span key="status">Not public</span>
          ),
          <time key="updated" dateTime={publication.updatedAt.toISOString()}>
            {formatAdminTime(publication.updatedAt)}
          </time>,
        ],
      }))}
      bulkAction={bulkPublicationsAction}
      noun={{ one: "publication", many: "publications" }}
      emptyText="No publications yet. Add the first one, or import it by DOI."
      page={page}
      pages={pages}
      total={total}
    />
  );
}
