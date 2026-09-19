import {
  ExternalServiceError,
  isProductionEnvironment,
  ServiceConfigurationError,
} from "@/lib/forms-services";
import type { ContactSubmission, JoinSubmission } from "@/lib/forms";

type Fetcher = typeof fetch;

type EmailMessage = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

export type EmailDelivery = {
  id: string;
  mode: "resend" | "development-bypass";
};

export function assertEmailConfigured(
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (
    isProductionEnvironment(env) &&
    (!env.RESEND_API_KEY?.trim() || !env.EMAIL_FROM?.trim())
  ) {
    throw new ServiceConfigurationError(
      "Resend",
      "RESEND_API_KEY and EMAIL_FROM are required in production.",
    );
  }
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export async function sendEmail(
  message: EmailMessage,
  dependencies: {
    env?: NodeJS.ProcessEnv;
    fetcher?: Fetcher;
  } = {},
): Promise<EmailDelivery> {
  const env = dependencies.env ?? process.env;
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  assertEmailConfigured(env);

  if (!apiKey || !from) {
    return { id: "development-bypass", mode: "development-bypass" };
  }

  let response: Response;
  try {
    response = await (dependencies.fetcher ?? fetch)(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
          reply_to: message.replyTo,
        }),
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch (error) {
    throw new ExternalServiceError(
      "Resend",
      `Email could not be sent: ${
        error instanceof Error ? error.message : "network error"
      }`,
    );
  }

  if (!response.ok) {
    throw new ExternalServiceError(
      "Resend",
      `Email delivery returned HTTP ${response.status}.`,
    );
  }

  const result = (await response.json()) as { id?: string };
  if (!result.id) {
    throw new ExternalServiceError(
      "Resend",
      "Email delivery returned no message id.",
    );
  }

  return { id: result.id, mode: "resend" };
}

export async function sendApplicationEmails(
  application: JoinSubmission & { id: string },
  adminEmail: string,
  dependencies: {
    env?: NodeJS.ProcessEnv;
    fetcher?: Fetcher;
  } = {},
): Promise<EmailDelivery[]> {
  const name = escapeHtml(application.name);
  const applicationId = escapeHtml(application.id);
  const type = escapeHtml(application.type.replaceAll("_", " ").toLowerCase());
  const phoneText = application.phone
    ? `\nContact number: ${application.phone}`
    : "";
  const phoneHtml = application.phone
    ? `<br /><strong>Contact number:</strong> ${escapeHtml(application.phone)}`
    : "";

  return Promise.all([
    sendEmail(
      {
        to: application.email,
        subject: "We received your SANDHI application",
        text: `Hello ${application.name},\n\nApplication received. We read every application and will reply by email.\n\nReference: ${application.id}\n\nSANDHI Research Lab`,
        html: `<p>Hello ${name},</p><p><strong>Application received.</strong> We read every application and will reply by email.</p><p>Reference: ${applicationId}</p><p>SANDHI Research Lab</p>`,
      },
      dependencies,
    ),
    sendEmail(
      {
        to: adminEmail,
        replyTo: application.email,
        subject: `New SANDHI application: ${application.name}`,
        text: `A new ${application.type.toLowerCase()} application was received from ${application.name} <${application.email}>.${phoneText}\n\nReference: ${application.id}`,
        html: `<p>A new ${type} application was received from <strong>${name}</strong> (${escapeHtml(application.email)}).${phoneHtml}</p><p>Reference: ${applicationId}</p>`,
      },
      dependencies,
    ),
  ]);
}

export async function sendContactEmail(
  inquiry: ContactSubmission,
  recipient: string,
  dependencies: {
    env?: NodeJS.ProcessEnv;
    fetcher?: Fetcher;
  } = {},
): Promise<EmailDelivery> {
  const name = escapeHtml(inquiry.name);
  const email = escapeHtml(inquiry.email);
  const topic = escapeHtml(inquiry.topic);
  const message = escapeHtml(inquiry.message).replaceAll("\n", "<br />");

  return sendEmail(
    {
      to: recipient,
      replyTo: inquiry.email,
      subject: `SANDHI ${inquiry.topic} inquiry from ${inquiry.name}`,
      text: `Name: ${inquiry.name}\nEmail: ${inquiry.email}\nTopic: ${inquiry.topic}\n\n${inquiry.message}`,
      html: `<p><strong>Name:</strong> ${name}<br /><strong>Email:</strong> ${email}<br /><strong>Topic:</strong> ${topic}</p><p>${message}</p>`,
    },
    dependencies,
  );
}

type AccountEmail = {
  to: string;
  name: string;
  url: string;
};

type EmailDependencies = {
  env?: NodeJS.ProcessEnv;
  fetcher?: Fetcher;
};

export async function sendPasswordResetEmail(
  { to, name, url }: AccountEmail,
  dependencies: EmailDependencies = {},
): Promise<EmailDelivery> {
  return sendEmail(
    {
      to,
      subject: "Reset your SANDHI password",
      text: `Hello ${name},\n\nUse this link within one hour to choose a new password:\n${url}\n\nIf you did not ask to reset your password, you can ignore this email.\n\nSANDHI Research Lab`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Use this link within one hour to choose a new password:</p><p><a href="${escapeHtml(url)}">Reset your password</a></p><p>If you did not ask to reset your password, you can ignore this email.</p><p>SANDHI Research Lab</p>`,
    },
    dependencies,
  );
}

export async function sendVerificationEmail(
  { to, name, url }: AccountEmail,
  dependencies: EmailDependencies = {},
): Promise<EmailDelivery> {
  return sendEmail(
    {
      to,
      subject: "Confirm your SANDHI email address",
      text: `Hello ${name},\n\nConfirm your email address to finish signing in:\n${url}\n\nSANDHI Research Lab`,
      html: `<p>Hello ${escapeHtml(name)},</p><p>Confirm your email address to finish signing in:</p><p><a href="${escapeHtml(url)}">Confirm email address</a></p><p>SANDHI Research Lab</p>`,
    },
    dependencies,
  );
}

export async function sendInvitationEmail(
  {
    to,
    url,
    inviterName,
    expiresAt,
  }: { to: string; url: string; inviterName: string; expiresAt: Date },
  dependencies: EmailDependencies = {},
): Promise<EmailDelivery> {
  const expiry = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  });

  return sendEmail(
    {
      to,
      subject: "You are invited to join SANDHI Research Lab",
      text: `Hello,\n\n${inviterName} has invited you to the SANDHI Research Lab portal.\n\nAccept the invitation and set your password by ${expiry}:\n${url}\n\nSANDHI Research Lab`,
      html: `<p>Hello,</p><p>${escapeHtml(inviterName)} has invited you to the SANDHI Research Lab portal.</p><p>Accept the invitation and set your password by ${escapeHtml(expiry)}:</p><p><a href="${escapeHtml(url)}">Accept invitation</a></p><p>SANDHI Research Lab</p>`,
    },
    dependencies,
  );
}

/**
 * Tells the people who can review that a publication is waiting for them.
 * Sent when its stage moves to internal review.
 */
export async function sendPublicationReviewEmail(
  {
    to,
    title,
    url,
    movedBy,
  }: { to: string[]; title: string; url: string; movedBy: string },
  dependencies: EmailDependencies = {},
): Promise<EmailDelivery> {
  return sendEmail(
    {
      to,
      subject: `Ready for internal review: ${title}`,
      text: `${movedBy} moved "${title}" to internal review.\n\nRead it and record your decision:\n${url}\n\nSANDHI Research Lab`,
      html: `<p>${escapeHtml(movedBy)} moved &ldquo;${escapeHtml(title)}&rdquo; to internal review.</p><p><a href="${escapeHtml(url)}">Read it and record your decision</a></p><p>SANDHI Research Lab</p>`,
    },
    dependencies,
  );
}

/**
 * A short security notice to an account holder: what happened, and what to
 * do if it was not them. Lines are plain text and escaped for HTML.
 */
export async function sendSecurityNotice(
  {
    to,
    name,
    subject,
    lines,
  }: { to: string; name: string; subject: string; lines: string[] },
  dependencies: EmailDependencies = {},
): Promise<EmailDelivery> {
  return sendEmail(
    {
      to,
      subject,
      text: `Hello ${name},\n\n${lines.join("\n\n")}\n\nSANDHI Research Lab`,
      html: `<p>Hello ${escapeHtml(name)},</p>${lines
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join("")}<p>SANDHI Research Lab</p>`,
    },
    dependencies,
  );
}
