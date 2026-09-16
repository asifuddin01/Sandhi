import {
  SharedEntityTitle,
  type EntityKind,
} from "@/components/motion/SharedEntityTitle";
import styles from "@/components/public/ResearchPages.module.css";

interface PageIntroProps {
  title: string;
  lead?: string;
  titleTransition?: { kind: EntityKind; slug: string };
}

export function PageIntro({ title, lead, titleTransition }: PageIntroProps) {
  const heading = <h1>{title}</h1>;

  return (
    <header className={styles.intro}>
      {titleTransition ? (
        <SharedEntityTitle
          kind={titleTransition.kind}
          slug={titleTransition.slug}
        >
          {heading}
        </SharedEntityTitle>
      ) : (
        heading
      )}
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </header>
  );
}
