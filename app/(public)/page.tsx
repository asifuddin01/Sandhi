import Link from "next/link";

import { SandhiFieldPoster } from "@/components/field/SandhiFieldPoster";
import { MarginThread } from "@/components/motion/MarginThread";
import { SequenceSteps } from "@/components/motion/SequenceSteps";
import { ThreadDivider } from "@/components/motion/ThreadDivider";
import { homeCopy, researchThemes, siteIdentity } from "@/content/strings";

export default function HomePage() {
  return (
    <div className="home-page">
      <MarginThread />

      <section className="home-hero" aria-labelledby="home-title">
        <SandhiFieldPoster />
        <div className="home-hero__veil" aria-hidden="true" />
        <div className="home-hero__content">
          <h1 id="home-title">{homeCopy.hero.title}</h1>
          <p className="home-hero__tagline">{homeCopy.hero.tagline}</p>
          <p className="home-hero__lead">{homeCopy.hero.lead}</p>
          <div className="home-hero__actions">
            <Link className="button button-primary" href="/research">
              {homeCopy.hero.primaryAction}
            </Link>
            <Link className="text-link" href="/join">
              {homeCopy.hero.secondaryAction}
            </Link>
          </div>
          <p className="home-hero__origin">
            <span lang="sa">{siteIdentity.devanagari}</span>
            <span aria-hidden="true"> · </span>
            <span>
              {siteIdentity.transliteration}: the place where two things join.
            </span>
          </p>
        </div>
      </section>

      <div className="page-shell">
        <ThreadDivider />

        <section className="home-idea" aria-labelledby="home-idea-title">
          <h2 id="home-idea-title">{homeCopy.idea.heading}</h2>
          <p>{homeCopy.idea.body}</p>
          <Link className="text-link" href="/about">
            {homeCopy.idea.action}
          </Link>
        </section>

        <section className="home-philosophy" aria-labelledby="philosophy-title">
          <h2 className="visually-hidden" id="philosophy-title">
            Our research philosophy
          </h2>
          <SequenceSteps
            steps={homeCopy.philosophy}
            ariaLabel="SANDHI research philosophy"
          />
        </section>

        <ThreadDivider />

        <section className="home-themes" aria-labelledby="themes-title">
          <div className="section-heading">
            <h2 id="themes-title">{homeCopy.themesHeading}</h2>
            <Link className="text-link" href="/research">
              {homeCopy.themesAction}
            </Link>
          </div>
          <ol className="theme-list">
            {researchThemes.map((theme) => (
              <li key={theme.name} data-center={theme.name === "Junction"}>
                <span className="theme-list__thread" aria-hidden="true">
                  <span />
                </span>
                <h3>{theme.name}</h3>
                <p className="theme-list__gloss">{theme.gloss}</p>
                <p className="theme-list__areas">{theme.areas.join(", ")}</p>
              </li>
            ))}
          </ol>
        </section>

        <ThreadDivider />

        <section className="home-closing" aria-labelledby="closing-title">
          <h2 id="closing-title">{homeCopy.closing.heading}</h2>
          <p>{homeCopy.closing.body}</p>
          <Link className="button button-primary" href="/join">
            {homeCopy.closing.action}
          </Link>
        </section>
      </div>
    </div>
  );
}
