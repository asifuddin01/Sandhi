/**
 * An author list, read from a form.
 *
 * Shared by the administration manager and the member portal, because the
 * rule about what an author is has to be the same in both. Two copies is how
 * one of them quietly starts accepting a shape the other refuses.
 *
 * It throws whatever the caller gives it: the two surfaces report a refusal
 * differently, and neither should have to catch the other's error type.
 */

export const MAX_AUTHORS = 100;
export const MAX_AUTHOR_NAME = 200;

export type AuthorRow = {
  position: number;
  memberId: string | null;
  externalName: string | null;
  externalAffiliation: string | null;
  equalContribution: boolean;
  corresponding: boolean;
};

function strings(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}

/**
 * The author list, in the order it was submitted. Each author is either a
 * member or a name typed in, never both: two records for one person is how
 * an author list starts disagreeing with itself.
 */
export function readAuthorRows(
  formData: FormData,
  refuse: (message: string) => Error,
): AuthorRow[] {
  const memberIds = strings(formData, "authors.memberId");
  const names = strings(formData, "authors.externalName");
  const affiliations = strings(formData, "authors.externalAffiliation");
  const equal = strings(formData, "authors.equalContribution");
  const corresponding = strings(formData, "authors.corresponding");

  if (memberIds.length > MAX_AUTHORS) {
    throw refuse(`List at most ${MAX_AUTHORS} authors.`);
  }

  const seen = new Set<string>();
  return memberIds.map((memberId, position) => {
    const externalName = (names[position] ?? "").trim();
    if (memberId && externalName) {
      throw refuse(
        `Author ${position + 1} is both a member and a typed name. Choose one.`,
      );
    }
    if (!memberId && !externalName) {
      throw refuse(`Choose a member or type a name for author ${position + 1}.`);
    }
    if (memberId) {
      if (seen.has(memberId)) {
        throw refuse("Each member can appear once as an author.");
      }
      seen.add(memberId);
    }
    if (externalName.length > MAX_AUTHOR_NAME) {
      throw refuse(
        `Keep each author name under ${MAX_AUTHOR_NAME} characters.`,
      );
    }
    const affiliation = (affiliations[position] ?? "").trim();
    if (affiliation.length > MAX_AUTHOR_NAME) {
      throw refuse(
        `Keep each affiliation under ${MAX_AUTHOR_NAME} characters.`,
      );
    }

    return {
      position,
      memberId: memberId || null,
      externalName: externalName || null,
      externalAffiliation: affiliation || null,
      equalContribution: equal[position] === "yes",
      corresponding: corresponding[position] === "yes",
    };
  });
}
