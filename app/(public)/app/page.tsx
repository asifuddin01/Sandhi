import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/public/EmptyState";
import { PageIntro } from "@/components/public/PageIntro";
import styles from "@/components/public/ResearchPages.module.css";
import { formatBytes, IOS_DISTRIBUTIONS } from "@/lib/mobile-app";
import { getSiteSettings } from "@/lib/site-settings";

import page from "./AppPage.module.css";
import homeScreen from "./screens/home.png";
import personScreen from "./screens/person.png";
import researchScreen from "./screens/research.png";
import signInScreen from "./screens/sign-in.png";

export const metadata: Metadata = {
  title: "SANDHI app",
  description:
    "Install the SANDHI app for Android. Follow the lab's research, projects, papers, and news; members sign in with the same account as the website.",
  alternates: { canonical: "/app" },
};

/** Taken from the app itself, reading this site. Refresh them when the screens change. */
const screens: Array<{ image: StaticImageData; caption: string; alt: string }> =
  [
    {
      image: homeScreen,
      caption: "Home: the lab at a glance, with news and project updates.",
      alt: "The app's home screen: SANDHI Research Lab, its tagline, and sections for research, projects, papers, and news.",
    },
    {
      image: researchScreen,
      caption: "The research map: each theme and the areas beneath it.",
      alt: "The research screen listing the lab's themes, such as Perception and Language, with their areas.",
    },
    {
      image: personScreen,
      caption: "People: every public profile, with interests and links.",
      alt: "A researcher's profile in the app, with photo, role, research interests, and biography.",
    },
    {
      image: signInScreen,
      caption: "Members sign in with their SANDHI account.",
      alt: "The sign-in screen, asking for an email address and password.",
    },
  ];

const distributionLabel = (key: string) =>
  IOS_DISTRIBUTIONS.find((item) => item.key === key)?.label ?? "Private";

export default async function AppDownloadPage() {
  const { mobileApp } = await getSiteSettings();
  // Nothing to install and nothing to say: the page does not exist yet.
  if (!mobileApp.enabled) notFound();

  const { android, ios } = mobileApp;

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <PageIntro
        title="SANDHI app"
        lead="Follow the lab's research, projects, papers, and news on your phone. Members sign in with their SANDHI account to see their projects, announcements, and documents, the same as on the website."
      />

      <section className={styles.section} aria-labelledby="install">
        <div className={styles.sectionHeader}>
          <h2 id="install">Install</h2>
        </div>

        <div className={page.platforms}>
          {android ? (
            <article className={page.platform} aria-labelledby="android">
              <div className={page.platformHeader}>
                <h3 id="android">Android</h3>
                <p className={page.version}>Version {android.version}</p>
              </div>

              <dl className={page.facts}>
                <dt>Download</dt>
                <dd>Signed APK, from this site</dd>
                {android.sizeBytes ? (
                  <>
                    <dt>Size</dt>
                    <dd>{formatBytes(android.sizeBytes)}</dd>
                  </>
                ) : null}
                {android.minimumOsVersion ? (
                  <>
                    <dt>Requires</dt>
                    <dd>Android {android.minimumOsVersion} or later</dd>
                  </>
                ) : null}
                {android.sha256 ? (
                  <>
                    <dt>SHA-256</dt>
                    <dd className={page.checksum}>{android.sha256}</dd>
                  </>
                ) : null}
              </dl>

              <div className={page.actions}>
                <a className="button button-primary" href="/download/android">
                  Download the APK
                </a>
              </div>

              <ol className={page.steps}>
                <li>
                  Download the file, then open it. Android will ask once for
                  permission to install apps from your browser.
                </li>
                {android.sha256 ? (
                  <li>
                    Before installing, you can check the file with{" "}
                    <code>sha256sum</code> (or <code>shasum -a 256</code>) and
                    compare it with the checksum above.
                  </li>
                ) : null}
                <li>
                  Open the app. Members can sign in with their SANDHI email
                  address and password.
                </li>
              </ol>

              {android.notes ? (
                <div className={styles.prose}>
                  <p>{android.notes}</p>
                </div>
              ) : null}
            </article>
          ) : null}

          {ios ? (
            <article className={page.platform} aria-labelledby="ios">
              <div className={page.platformHeader}>
                <h3 id="ios">iOS</h3>
                <p className={page.version}>Version {ios.version}</p>
              </div>

              <dl className={page.facts}>
                <dt>Distribution</dt>
                <dd>{distributionLabel(ios.distribution)}</dd>
                {ios.minimumOsVersion ? (
                  <>
                    <dt>Requires</dt>
                    <dd>iOS {ios.minimumOsVersion} or later</dd>
                  </>
                ) : null}
              </dl>

              <div className={page.actions}>
                <a
                  className="button button-primary"
                  href={ios.installUrl}
                  rel="noreferrer"
                >
                  Open the invitation
                </a>
              </div>

              <ol className={page.steps}>
                <li>
                  Open the invitation on the iPhone or iPad you want to install
                  on, and accept it with your SANDHI email address.
                </li>
                <li>Install the app when the invitation offers it.</li>
                <li>
                  Open the app and sign in with your SANDHI email address and
                  password.
                </li>
              </ol>

              {ios.notes ? (
                <div className={styles.prose}>
                  <p>{ios.notes}</p>
                </div>
              ) : null}
            </article>
          ) : (
            // Until an iOS release is published in settings, say where it stands.
            <article className={page.platform} aria-labelledby="ios">
              <div className={page.platformHeader}>
                <h3 id="ios">iPhone and iPad</h3>
                <p className={page.version}>After funding</p>
              </div>
              <div className={styles.prose}>
                <p>
                  The iOS app is built and tested on iPhone. It will be released
                  on the App Store after funding. Until then, this website works
                  in any iPhone browser.
                </p>
              </div>
            </article>
          )}
        </div>

        {!android && !ios ? (
          <EmptyState>The app will be available here soon.</EmptyState>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="screens">
        <div className={styles.sectionHeader}>
          <h2 id="screens">Inside the app</h2>
        </div>
        <ul className={page.screens}>
          {screens.map((screen) => (
            <li key={screen.caption}>
              <figure className={page.screen}>
                <div className={page.phone}>
                  <Image
                    src={screen.image}
                    alt={screen.alt}
                    sizes="(width < 34rem) 45vw, 10rem"
                  />
                </div>
                <figcaption>{screen.caption}</figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="accounts">
        <div className={styles.sectionHeader}>
          <h2 id="accounts">Accounts and access</h2>
        </div>
        <div className={styles.prose}>
          <p>
            The app uses your existing SANDHI account. Accounts are created by
            invitation only, so install the app first and sign in with the
            address your invitation was sent to.
          </p>
          <p>
            If two-factor authentication is set up on your account, the app asks
            for a code after your password, exactly as the website does. Staff
            accounts require it.
          </p>
          <p>
            Signing out in the app ends only that device&rsquo;s session. You
            can see and end every session under{" "}
            <a href="/portal/security">Account security</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
