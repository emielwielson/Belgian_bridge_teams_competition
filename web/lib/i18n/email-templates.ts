import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import { toIntlLocale } from "@/i18n/intl-locale";
import { formatBrussels } from "@/lib/time/brussels";

type EmailMessages = Record<string, unknown>;

export type EmailTranslator = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export type EmailContent = {
  subject: string;
  bodyText: string;
  bodyHtml: string;
};

export type EmailTemplateContext = {
  locale: Locale;
  intlLocale: string;
  t: EmailTranslator;
};

type WorkflowDecision = "approve" | "reject" | "cancel";

export type PostponementProposedEmailBuildContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  previousDatetime: string;
  proposedDatetime: string;
  proposingTeamName: string;
};

export type PostponementDecisionEmailBuildContext =
  PostponementProposedEmailBuildContext & {
    action: WorkflowDecision;
  };

export type HomeAwaySwitchProposedEmailBuildContext = {
  matchId: string;
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  requestingTeamName: string;
};

export type HomeAwaySwitchDecisionEmailBuildContext =
  HomeAwaySwitchProposedEmailBuildContext & {
    action: WorkflowDecision;
  };

const POSTPONEMENT_ACTION_KEY: Record<
  WorkflowDecision,
  "approved" | "rejected" | "cancelled"
> = {
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
};

const HOME_AWAY_ACTION_KEY: Record<
  WorkflowDecision,
  "approved" | "rejected" | "cancelled"
> = {
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
};

export function resolveEmailLocale(locale?: string | null): Locale {
  if (locale && isLocale(locale)) return locale;
  return defaultLocale;
}

function getNestedString(obj: EmailMessages, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function formatTemplate(
  template: string,
  values?: Record<string, string | number>,
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

function createEmailTranslator(emails: EmailMessages): EmailTranslator {
  return (key, values) => {
    const template = getNestedString(emails, key);
    if (!template) return key;
    return formatTemplate(template, values);
  };
}

export async function loadEmailTemplateContext(
  locale?: string | null,
): Promise<EmailTemplateContext> {
  const resolved = resolveEmailLocale(locale);
  const emails = await loadEmailMessages(resolved);
  return {
    locale: resolved,
    intlLocale: toIntlLocale(resolved),
    t: createEmailTranslator(emails),
  };
}

async function loadEmailMessages(locale: Locale): Promise<EmailMessages> {
  try {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    return (messages.emails ?? {}) as EmailMessages;
  } catch {
    const messages = (await import("../../messages/en.json")).default;
    return (messages.emails ?? {}) as EmailMessages;
  }
}

export function buildPostponementProposedEmail(
  ctx: PostponementProposedEmailBuildContext,
  matchUrl: string,
  { t, intlLocale }: Pick<EmailTemplateContext, "t" | "intlLocale">,
): EmailContent {
  const previous = formatBrussels(ctx.previousDatetime, intlLocale);
  const proposed = formatBrussels(ctx.proposedDatetime, intlLocale);
  const roundLine = t("postponementProposed.roundLine", {
    round: ctx.round,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
  });

  const subject = t("postponementProposed.subject", {
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
    round: ctx.round,
  });

  const bodyText = [
    t("postponementProposed.bodyIntro", {
      proposingTeam: ctx.proposingTeamName,
    }),
    "",
    roundLine,
    t("postponementProposed.currentDate", { datetime: previous }),
    t("postponementProposed.proposedDate", { datetime: proposed }),
    "",
    t("postponementProposed.openToApprove"),
    matchUrl,
  ].join("\n");

  const bodyHtml = [
    `<p>${t("postponementProposed.bodyIntro", { proposingTeam: ctx.proposingTeamName })}</p>`,
    `<p><strong>${roundLine}</strong><br>`,
    `${t("postponementProposed.currentDate", { datetime: previous })}<br>`,
    `${t("postponementProposed.proposedDate", { datetime: proposed })}</p>`,
    `<p><a href="${matchUrl}">${t("postponementProposed.openMatchLink")}</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}

export function buildPostponementDecisionEmail(
  ctx: PostponementDecisionEmailBuildContext,
  matchUrl: string,
  loginUrl: string,
  { t, intlLocale }: Pick<EmailTemplateContext, "t" | "intlLocale">,
): EmailContent {
  const previous = formatBrussels(ctx.previousDatetime, intlLocale);
  const proposed = formatBrussels(ctx.proposedDatetime, intlLocale);
  const actionLabel = t(
    `postponementDecision.${POSTPONEMENT_ACTION_KEY[ctx.action]}`,
  );
  const roundLine = t("postponementDecision.roundLine", {
    round: ctx.round,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
  });

  const subject = t("postponementDecision.subject", {
    action: actionLabel,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
    round: ctx.round,
  });

  const bodyText = [
    t("postponementDecision.bodyIntro", {
      proposingTeam: ctx.proposingTeamName,
      action: actionLabel,
    }),
    "",
    roundLine,
    t("postponementDecision.currentDate", { datetime: previous }),
    t("postponementDecision.proposedDate", { datetime: proposed }),
    "",
    `${t("postponementDecision.openMatch")}: ${matchUrl}`,
    `${t("postponementDecision.loginFirst")}: ${loginUrl}`,
  ].join("\n");

  const bodyHtml = [
    `<p>${t("postponementDecision.bodyIntro", {
      proposingTeam: ctx.proposingTeamName,
      action: actionLabel,
    })}</p>`,
    `<p><strong>${roundLine}</strong><br>`,
    `${t("postponementDecision.currentDate", { datetime: previous })}<br>`,
    `${t("postponementDecision.proposedDate", { datetime: proposed })}</p>`,
    `<p><a href="${matchUrl}">${t("postponementDecision.openMatch")}</a><br>`,
    `<a href="${loginUrl}">${t("postponementDecision.loginFirst")}</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}

export function buildHomeAwaySwitchProposedEmail(
  ctx: HomeAwaySwitchProposedEmailBuildContext,
  matchUrl: string,
  loginUrl: string,
  { t }: Pick<EmailTemplateContext, "t">,
): EmailContent {
  const matchLine = t("homeAwaySwitchProposed.matchLine", {
    round: ctx.round,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
  });

  const subject = t("homeAwaySwitchProposed.subject", {
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
    round: ctx.round,
  });

  const bodyText = [
    t("homeAwaySwitchProposed.bodyProposed", {
      requestingTeam: ctx.requestingTeamName,
    }),
    "",
    matchLine,
    "",
    t("homeAwaySwitchProposed.openMatch", { url: matchUrl }),
    t("homeAwaySwitchProposed.loginFirst", { url: loginUrl }),
  ].join("\n");

  const bodyHtml = [
    `<p>${t("homeAwaySwitchProposed.bodyProposed", {
      requestingTeam: ctx.requestingTeamName,
    })}</p>`,
    `<p><strong>${matchLine}</strong></p>`,
    `<p><a href="${matchUrl}">${t("homeAwaySwitchDecision.openMatch")}</a><br>`,
    `<a href="${loginUrl}">${t("homeAwaySwitchDecision.loginFirst")}</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}

export function buildHomeAwaySwitchDecisionEmail(
  ctx: HomeAwaySwitchDecisionEmailBuildContext,
  matchUrl: string,
  loginUrl: string,
  { t }: Pick<EmailTemplateContext, "t">,
): EmailContent {
  const actionLabel = t(
    `homeAwaySwitchDecision.${HOME_AWAY_ACTION_KEY[ctx.action]}`,
  );
  const matchLine = t("homeAwaySwitchDecision.matchLine", {
    round: ctx.round,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
  });

  const subject = t("homeAwaySwitchDecision.subject", {
    action: actionLabel,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
    round: ctx.round,
  });

  const bodyText = [
    t("homeAwaySwitchDecision.bodyDecision", {
      requestingTeam: ctx.requestingTeamName,
      action: actionLabel,
    }),
    "",
    matchLine,
    "",
    `${t("homeAwaySwitchDecision.openMatch")}: ${matchUrl}`,
    `${t("homeAwaySwitchDecision.loginFirst")}: ${loginUrl}`,
  ].join("\n");

  const bodyHtml = [
    `<p>${t("homeAwaySwitchDecision.bodyDecision", {
      requestingTeam: ctx.requestingTeamName,
      action: actionLabel,
    })}</p>`,
    `<p><strong>${matchLine}</strong></p>`,
    `<p><a href="${matchUrl}">${t("homeAwaySwitchDecision.openMatch")}</a><br>`,
    `<a href="${loginUrl}">${t("homeAwaySwitchDecision.loginFirst")}</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}

export type ArbiterRequestCreatedEmailBuildContext = {
  matchId: string;
  round?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  matchUrl: string;
  loginUrl: string;
  inboxUrl: string;
};

export function buildArbiterRequestCreatedEmail(
  ctx: ArbiterRequestCreatedEmailBuildContext,
  { t }: Pick<EmailTemplateContext, "t">,
): EmailContent {
  const matchLine =
    ctx.round != null &&
    ctx.homeTeamName != null &&
    ctx.awayTeamName != null
      ? t("arbiterRequestCreated.matchLine", {
          round: ctx.round,
          homeTeam: ctx.homeTeamName,
          awayTeam: ctx.awayTeamName,
        })
      : t("arbiterRequestCreated.matchFallback", { matchId: ctx.matchId });

  const subject = t("arbiterRequestCreated.subject", { matchLine });

  const bodyText = [
    t("arbiterRequestCreated.bodyIntro"),
    "",
    matchLine,
    "",
    t("arbiterRequestCreated.arbiterInbox", { url: ctx.inboxUrl }),
    t("arbiterRequestCreated.match", { url: ctx.matchUrl }),
    t("arbiterRequestCreated.loginFirst", { url: ctx.loginUrl }),
  ].join("\n");

  const bodyHtml = [
    `<p>${t("arbiterRequestCreated.bodyIntro")}</p>`,
    `<p><strong>${matchLine}</strong></p>`,
    `<p><a href="${ctx.inboxUrl}">${t("arbiterRequestCreated.openInbox")}</a> · `,
    `<a href="${ctx.matchUrl}">${t("arbiterRequestCreated.viewMatch")}</a><br>`,
    `<a href="${ctx.loginUrl}">${t("arbiterRequestCreated.loginFirstLink")}</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}

export type ArbiterRequestResolvedEmailBuildContext = {
  round: number;
  homeTeamName: string;
  awayTeamName: string;
  board: number | null;
  description: string | null;
  matchUrl: string;
  loginUrl: string;
  inboxUrl: string;
  rulingSignedUrl?: string | null;
};

export function buildArbiterRequestResolvedEmail(
  ctx: ArbiterRequestResolvedEmailBuildContext,
  { t }: Pick<EmailTemplateContext, "t">,
): EmailContent {
  const matchLine = t("arbiterRequestCreated.matchLine", {
    round: ctx.round,
    homeTeam: ctx.homeTeamName,
    awayTeam: ctx.awayTeamName,
  });

  const detailLines: string[] = [];
  if (ctx.board != null) {
    detailLines.push(
      t("arbiterRequestResolved.board", { board: ctx.board }),
    );
  }
  if (ctx.description) {
    detailLines.push(
      t("arbiterRequestResolved.description", {
        description: ctx.description,
      }),
    );
  }

  const rulingLine = ctx.rulingSignedUrl
    ? t("arbiterRequestResolved.officialRuling", {
        url: ctx.rulingSignedUrl,
      })
    : null;

  const subject = t("arbiterRequestResolved.subject", { matchLine });

  const bodyText = [
    t("arbiterRequestResolved.bodyIntro"),
    "",
    matchLine,
    ...detailLines,
    ...(rulingLine ? ["", rulingLine] : []),
    "",
    t("arbiterRequestResolved.arbiterInbox", { url: ctx.inboxUrl }),
    t("arbiterRequestResolved.match", { url: ctx.matchUrl }),
    t("arbiterRequestResolved.loginFirst", { url: ctx.loginUrl }),
  ].join("\n");

  const legacyHtml =
    detailLines.length > 0 ? `<br>${detailLines.join("<br>")}` : "";

  const rulingHtml = ctx.rulingSignedUrl
    ? `<p><a href="${ctx.rulingSignedUrl}">${t("arbiterRequestResolved.viewRulingPdf")}</a></p>`
    : "";

  const bodyHtml = [
    `<p>${t("arbiterRequestResolved.bodyIntro")}</p>`,
    `<p><strong>${matchLine}</strong>${legacyHtml}</p>`,
    rulingHtml,
    `<p><a href="${ctx.inboxUrl}">${t("arbiterRequestResolved.openInbox")}</a> · `,
    `<a href="${ctx.matchUrl}">${t("arbiterRequestResolved.viewMatch")}</a><br>`,
    `<a href="${ctx.loginUrl}">${t("arbiterRequestResolved.loginFirstLink")}</a></p>`,
  ].join("");

  return { subject, bodyText, bodyHtml };
}
