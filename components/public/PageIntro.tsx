import styles from "@/components/public/ResearchPages.module.css";

interface PageIntroProps {
  title: string;
  lead?: string;
}

export function PageIntro({ title, lead }: PageIntroProps) {
  return (
    <header className={styles.intro}>
      <h1>{title}</h1>
      {lead ? <p className={styles.lead}>{lead}</p> : null}
    </header>
  );
}
