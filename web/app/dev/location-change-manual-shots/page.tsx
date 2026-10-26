/**
 * Dev-only fixture for capturing location-change manual screenshots.
 * Visit /dev/location-change-manual-shots?locale=nl|en|fr
 * then run scripts/capture-location-change-manual-shots.mjs
 */

import type { ReactNode } from "react";
import { isLocale, type Locale } from "@/i18n/config";

type FixtureCopy = {
  matchTitle: string;
  matchMeta: string;
  reschedule: string;
  requestArbiter: string;
  changeLocation: string;
  hideLocationChange: string;
  pendingLocationChange: string;
  title: string;
  description: string;
  currentLocation: string;
  newLocation: string;
  otherTeamLocation: string;
  customLocation: string;
  proposeChange: string;
  pendingTitle: string;
  pendingBody: string;
  approveChange: string;
  reject: string;
};

const HOME_VENUE = "Clubzaal BBC, Brussel";
const AWAY_VENUE = "Salle Royal, Liège";
const HOME_TEAM = "BBC 1";
const AWAY_TEAM = "Royal Bridge Club";

const COPY: Record<Locale, FixtureCopy> = {
  nl: {
    matchTitle: `Ronde 4: ${HOME_TEAM} vs ${AWAY_TEAM}`,
    matchMeta: "3e nationale · zaterdag 14:00",
    reschedule: "Wedstrijd verplaatsen",
    requestArbiter: "Scheidsrechterverzoek",
    changeLocation: "Locatie wijzigen",
    hideLocationChange: "Locatiewijziging verbergen",
    pendingLocationChange: "Locatiewijziging in behandeling",
    title: "Wedstrijdlocatie wijzigen",
    description:
      "Stel een andere speellocatie voor. De andere kapitein of een competitiebeheerder moet goedkeuren.",
    currentLocation: `Huidige locatie: ${HOME_VENUE}`,
    newLocation: "Nieuwe locatie",
    otherTeamLocation: `Locatie van ${AWAY_TEAM}: ${AWAY_VENUE}`,
    customLocation: "Aangepaste locatie",
    proposeChange: "Locatiewijziging voorstellen",
    pendingTitle: "Wacht op goedkeuring",
    pendingBody: `${HOME_TEAM} stelde voor te spelen op: ${AWAY_VENUE}`,
    approveChange: "Locatie goedkeuren",
    reject: "Afwijzen",
  },
  en: {
    matchTitle: `Round 4: ${HOME_TEAM} vs ${AWAY_TEAM}`,
    matchMeta: "3rd National · Saturday 14:00",
    reschedule: "Reschedule match",
    requestArbiter: "Request arbiter",
    changeLocation: "Change location",
    hideLocationChange: "Hide location change",
    pendingLocationChange: "Pending location change",
    title: "Change match location",
    description:
      "Propose a different venue for this match. The other captain or a competition manager must approve.",
    currentLocation: `Current location: ${HOME_VENUE}`,
    newLocation: "New location",
    otherTeamLocation: `${AWAY_TEAM}'s location: ${AWAY_VENUE}`,
    customLocation: "Custom location",
    proposeChange: "Propose location change",
    pendingTitle: "Pending approval",
    pendingBody: `${HOME_TEAM} proposed playing at: ${AWAY_VENUE}`,
    approveChange: "Approve location",
    reject: "Reject",
  },
  fr: {
    matchTitle: `Ronde 4 : ${HOME_TEAM} vs ${AWAY_TEAM}`,
    matchMeta: "3e nationale · samedi 14:00",
    reschedule: "Reporter la rencontre",
    requestArbiter: "Demander un arbitre",
    changeLocation: "Changer de lieu",
    hideLocationChange: "Masquer le changement de lieu",
    pendingLocationChange: "Changement de lieu en attente",
    title: "Changer le lieu de la rencontre",
    description:
      "Proposez un autre lieu pour cette rencontre. L'autre capitaine ou un gestionnaire de compétition doit approuver.",
    currentLocation: `Lieu actuel : ${HOME_VENUE}`,
    newLocation: "Nouveau lieu",
    otherTeamLocation: `Lieu de ${AWAY_TEAM} : ${AWAY_VENUE}`,
    customLocation: "Lieu personnalisé",
    proposeChange: "Proposer un changement de lieu",
    pendingTitle: "En attente d'approbation",
    pendingBody: `${HOME_TEAM} a proposé de jouer à : ${AWAY_VENUE}`,
    approveChange: "Approuver le lieu",
    reject: "Refuser",
  },
};

type PageProps = {
  searchParams: Promise<{ locale?: string }>;
};

export default async function LocationChangeManualShotsPage({
  searchParams,
}: PageProps) {
  if (process.env.NODE_ENV === "production") {
    return (
      <main className="page-container py-10">
        <p className="text-sm text-zinc-600">Not available in production.</p>
      </main>
    );
  }

  const params = await searchParams;
  const locale: Locale = isLocale(params.locale ?? "")
    ? (params.locale as Locale)
    : "nl";
  const t = COPY[locale];

  return (
    <main className="mx-auto max-w-lg bg-zinc-100 px-4 py-8">
      <p className="mb-6 text-xs text-zinc-500">
        Location-change manual screenshot fixtures · locale={locale}
      </p>

      <Shot id="open-change" label="open-change">
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              {t.matchTitle}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{t.matchMeta}</p>
            <p className="mt-2 text-sm text-zinc-600">{t.currentLocation}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="btn-secondary text-sm">{t.reschedule}</span>
            <span className="btn-secondary text-sm">{t.requestArbiter}</span>
            <span className="btn-secondary ring-2 ring-emerald-600 ring-offset-2 text-sm">
              {t.changeLocation}
            </span>
          </div>
        </div>
      </Shot>

      <Shot id="propose-change" label="propose-change">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="btn-secondary text-sm">{t.reschedule}</span>
            <span className="btn-secondary text-sm">{t.requestArbiter}</span>
            <span className="btn-primary text-sm">{t.hideLocationChange}</span>
          </div>
          <section className="card flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">{t.title}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t.description}</p>
            </div>
            <p className="text-sm text-zinc-600">{t.currentLocation}</p>
            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="text-zinc-600">{t.newLocation}</legend>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="location-mode-propose"
                  className="mt-1"
                  checked
                  readOnly
                />
                <span>{t.otherTeamLocation}</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="location-mode-propose"
                  className="mt-1"
                  disabled
                />
                <span>{t.customLocation}</span>
              </label>
            </fieldset>
            <span className="btn-primary w-fit text-sm">{t.proposeChange}</span>
          </section>
        </div>
      </Shot>

      <Shot id="approve-change" label="approve-change">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="btn-secondary text-sm">{t.reschedule}</span>
            <span className="btn-secondary text-sm">{t.requestArbiter}</span>
            <span className="btn-primary text-sm">
              {t.pendingLocationChange}
            </span>
          </div>
          <section className="card flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">{t.title}</h2>
              <p className="mt-1 text-sm text-zinc-600">{t.description}</p>
            </div>
            <p className="text-sm text-zinc-600">{t.currentLocation}</p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
              <p className="font-medium text-amber-900">{t.pendingTitle}</p>
              <p className="mt-1 text-amber-800">{t.pendingBody}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="btn-primary px-3 py-1.5 text-sm">
                  {t.approveChange}
                </span>
                <span className="btn-secondary px-3 py-1.5 text-sm">
                  {t.reject}
                </span>
              </div>
            </div>
          </section>
        </div>
      </Shot>
    </main>
  );
}

function Shot({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-16">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <div id={`shot-${id}`} className="bg-white p-1">
        {children}
      </div>
    </section>
  );
}
