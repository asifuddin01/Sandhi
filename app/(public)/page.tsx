import Link from "next/link";

import { SandhiFieldPoster } from "@/components/field/SandhiFieldPoster";
import { MarginThread } from "@/components/motion/MarginThread";
import { SequenceSteps } from "@/components/motion/SequenceSteps";
import { ThreadDivider } from "@/components/motion/ThreadDivider";
import { EmptyState } from "@/components/ui/EmptyState";
import { homeCopy, researchThemes, siteIdentity } from "@/content/strings";
import { getHomeData } from "@/lib/public-home";

function humanize(value: string) {
  const words = value.toLocaleLowerCase().replaceAll("_", " ");
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
}

function ExternalOrInternalLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return href.startsWith("/") ? (
    <Link href={href}>{children}</Link>
  ) : (
    <a href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  );
}

export default async function HomePage() {
  const data = await getHomeData();

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
            <span aria-hidden="true"> — </span>
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

        <section className="home-projects" aria-labelledby="projects-title">
          <div className="section-heading">
            <h2 id="projects-title">Featured projects</h2>
            <Link className="text-link" href="/projects">
              All projects
            </Link>
          </div>
          {data.projects.length > 0 ? (
            <div className="home-projects__list">
              {data.projects.map((project) => (
                <article key={project.slug}>
                  <div className="entry-meta">
                    <span className="status-label" data-status={project.status}>
                      {humanize(project.status)}
                    </span>
                    {project.startYear ? (
                      <span>{project.startYear}</span>
                    ) : null}
                  </div>
                  <h3>
                    <Link href={`/projects/${project.slug}`}>
                      {project.title}
                    </Link>
                  </h3>
                  <p className="home-projects__gloss">{project.gloss}</p>
                  {project.areas.length > 0 ? (
                    <ul className="entry-links" aria-label="Research areas">
                      {project.areas.map((area) => (
                        <li key={area.slug}>
                          <Link href={`/research/areas/${area.slug}`}>
                            {area.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {project.researchers.length > 0 ? (
                    <p className="home-projects__people">
                      {project.researchers.map((researcher, index) => (
                        <span key={researcher.slug}>
                          {index > 0 ? ", " : null}
                          <Link href={`/people/${researcher.slug}`}>
                            {researcher.name}
                          </Link>
                        </span>
                      ))}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="Our first projects will be published here soon." />
          )}
        </section>

        <ThreadDivider />

        <section
          className="home-publications"
          aria-labelledby="publications-title"
        >
          <div className="section-heading">
            <h2 id="publications-title">Recent publications</h2>
            <Link className="text-link" href="/publications">
              All publications
            </Link>
          </div>
          {data.publications.length > 0 ? (
            <ol className="home-publications__list">
              {data.publications.map((publication) => (
                <li key={publication.slug}>
                  <article>
                    <p className="entry-meta">
                      <span>{humanize(publication.type)}</span>
                      {publication.venueName ? (
                        <span>{publication.venueName}</span>
                      ) : null}
                      {publication.year ? (
                        <span>{publication.year}</span>
                      ) : null}
                    </p>
                    <h3>
                      <Link href={`/publications/${publication.slug}`}>
                        {publication.title}
                      </Link>
                    </h3>
                    {publication.authors.length > 0 ? (
                      <p className="home-publications__authors">
                        {publication.authors.map((author, index) => (
                          <span key={`${author.name}-${index}`}>
                            {index > 0 ? ", " : null}
                            {author.slug ? (
                              <Link href={`/people/${author.slug}`}>
                                {author.name}
                              </Link>
                            ) : (
                              author.name
                            )}
                          </span>
                        ))}
                      </p>
                    ) : null}
                    {publication.links.length > 0 ? (
                      <ul
                        className="entry-links"
                        aria-label="Publication links"
                      >
                        {publication.links.map((link) => (
                          <li key={`${link.label}-${link.href}`}>
                            <ExternalOrInternalLink href={link.href}>
                              {link.label}
                            </ExternalOrInternalLink>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState message="Our first papers are in progress." />
          )}
        </section>

        <ThreadDivider />

        <section className="home-news" aria-labelledby="news-title">
          <div className="section-heading">
            <h2 id="news-title">From the lab</h2>
            <Link className="text-link" href="/news">
              All news
            </Link>
          </div>
          {data.news.length > 0 ? (
            <ol className="home-news__list">
              {data.news.map((post) => (
                <li key={post.slug}>
                  <article>
                    <p className="entry-meta">
                      <time dateTime={post.date.toISOString()}>
                        {post.date.toLocaleDateString("en", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          timeZone: "UTC",
                        })}
                      </time>
                      <span>{humanize(post.category)}</span>
                    </p>
                    <h3>
                      <Link href={`/news/${post.slug}`}>{post.title}</Link>
                    </h3>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState message="News from the lab will appear here." />
          )}
        </section>

        {data.metrics.visible ? (
          <>
            <ThreadDivider />
            <section className="home-metrics" aria-labelledby="metrics-title">
              <h2 className="visually-hidden" id="metrics-title">
                SANDHI in numbers
              </h2>
              <dl>
                <div>
                  <dt>Researchers</dt>
                  <dd>{data.metrics.researchers}</dd>
                </div>
                <div>
                  <dt>Public projects</dt>
                  <dd>{data.metrics.projects}</dd>
                </div>
                <div>
                  <dt>Publications</dt>
                  <dd>{data.metrics.publications}</dd>
                </div>
                <div>
                  <dt>Research areas</dt>
                  <dd>{data.metrics.areas}</dd>
                </div>
              </dl>
            </section>
          </>
        ) : null}

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
