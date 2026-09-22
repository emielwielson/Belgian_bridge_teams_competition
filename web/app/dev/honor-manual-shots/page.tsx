/**
 * Dev-only fixture for capturing Honor lineup manual screenshots.
 * Visit /dev/honor-manual-shots?locale=nl|en|fr
 * then run scripts/capture-honor-manual-shots.mjs
 */

import type { ReactNode } from "react";
import { isLocale, type Locale } from "@/i18n/config";

type FixtureCopy = {
  openMatchTitle: string;
  openMatchMeta: string;
  phaseSequentialTitle: string;
  phaseSequentialAway: string;
  phaseSequentialBody: string;
  phaseBlindTitle: string;
  phaseBlindBody: string;
  homeTeam: string;
  statusYourTurn: string;
  statusLocked: string;
  homeMayEnterHint: string;
  seatsHeading: string;
  roomOpen: string;
  roomClosed: string;
  seatWithTable: (table: number, dir: string) => string;
  seat: (dir: string, room: "open" | "closed") => string;
  emptySeat: string;
  needAllSeats: string;
  substitutesHeading: string;
  addSubstitute: string;
  remove: string;
  playerWithSub: string;
  submitLineup: string;
  lockConfirmTitle: string;
  lockConfirmMessage: string;
  cancel: string;
  phaseBothLockedTitle: string;
  phaseBothLockedBody: string;
  lockedAskDirector: string;
};

const COPY: Record<Locale, FixtureCopy> = {
  nl: {
    openMatchTitle: "Ronde 4: BBC 1 vs Royal Bridge Club",
    openMatchMeta: "Eredivisie · zaterdag 11:00",
    phaseSequentialTitle: "Uitteam legt eerst vast",
    phaseSequentialAway:
      "Royal Bridge Club (uit) moet eerst de line-up vastleggen.",
    phaseSequentialBody:
      "In RR1–2 legt uit eerst vast; thuis ziet daarna de uit-line-up en mag invullen.",
    phaseBlindTitle: "Blinde line-up",
    phaseBlindBody:
      "In RR3 vullen beide teams in zonder elkaars line-up te zien tot beide vastliggen.",
    homeTeam: "Thuis",
    statusYourTurn: "Aan de beurt",
    statusLocked: "Vastgelegd",
    homeMayEnterHint:
      "Uit is vastgelegd. U kunt nu de thuis-line-up zetten en vastleggen.",
    seatsHeading: "Plaatsen",
    roomOpen: "Open room",
    roomClosed: "Closed room",
    seatWithTable: (table, dir) => `Open room · Tafel ${table} · ${dir}`,
    seat: (dir, room) =>
      `${room === "open" ? "Open room" : "Closed room"} · ${dir}`,
    emptySeat: "— leeg —",
    needAllSeats: "Vul alle plaatsen in om vast te leggen (2/4).",
    substitutesHeading: "Invallers",
    addSubstitute: "+ Invaller toevoegen",
    remove: "Verwijderen",
    playerWithSub: "De Smet Luc (12003) (invaller)",
    submitLineup: "Line-up vastleggen",
    lockConfirmTitle: "Line-up vastleggen?",
    lockConfirmMessage:
      "Na vastleggen kunt u de plaatsen niet meer zelf wijzigen. Bij een vergissing vraagt u de arbiter om te ontgrendelen.",
    cancel: "Annuleren",
    phaseBothLockedTitle: "Beide line-ups vastgelegd",
    phaseBothLockedBody:
      "De plaatsen staan vast. Vraag de arbiter als een line-up ontgrendeld moet worden.",
    lockedAskDirector:
      "Deze line-up is vastgelegd. Vraag de arbiter als die ontgrendeld moet worden.",
  },
  en: {
    openMatchTitle: "Round 4: BBC 1 vs Royal Bridge Club",
    openMatchMeta: "Honor Division · Saturday 11:00",
    phaseSequentialTitle: "Away team locks first",
    phaseSequentialAway:
      "Royal Bridge Club (away) must lock their line-up first.",
    phaseSequentialBody:
      "In RR1–2 away locks first; then home can see the away line-up and enter.",
    phaseBlindTitle: "Blind line-up",
    phaseBlindBody:
      "In RR3 both teams enter without seeing each other until both have locked.",
    homeTeam: "Home",
    statusYourTurn: "Your turn",
    statusLocked: "Locked",
    homeMayEnterHint:
      "Away is locked. You can now set seats and lock the home line-up.",
    seatsHeading: "Seats",
    roomOpen: "Open room",
    roomClosed: "Closed room",
    seatWithTable: (table, dir) => `Open room · Table ${table} · ${dir}`,
    seat: (dir, room) =>
      `${room === "open" ? "Open room" : "Closed room"} · ${dir}`,
    emptySeat: "— empty —",
    needAllSeats: "Fill all seats to lock (2/4).",
    substitutesHeading: "Substitutes",
    addSubstitute: "+ Add substitute",
    remove: "Remove",
    playerWithSub: "De Smet Luc (12003) (sub)",
    submitLineup: "Lock line-up",
    lockConfirmTitle: "Lock this line-up?",
    lockConfirmMessage:
      "After locking you cannot change seats yourself. If you locked by mistake, ask the director or arbiter to unlock.",
    cancel: "Cancel",
    phaseBothLockedTitle: "Both line-ups locked",
    phaseBothLockedBody:
      "Seating is fixed. Ask the director or arbiter if a line-up needs to be unlocked.",
    lockedAskDirector:
      "This line-up is locked. Ask the director or arbiter if you need it unlocked.",
  },
  fr: {
    openMatchTitle: "Journée 4 : BBC 1 vs Royal Bridge Club",
    openMatchMeta: "Division d'honneur · samedi 11:00",
    phaseSequentialTitle: "Les visiteurs verrouillent d'abord",
    phaseSequentialAway:
      "Royal Bridge Club (visiteurs) doit d'abord verrouiller son line-up.",
    phaseSequentialBody:
      "En RR1–2, les visiteurs verrouillent d'abord ; ensuite le domicile voit le line-up adverse et peut saisir.",
    phaseBlindTitle: "Line-up à l'aveugle",
    phaseBlindBody:
      "En RR3, les deux équipes saisissent sans se voir jusqu'à ce que les deux aient verrouillé.",
    homeTeam: "Équipe à domicile",
    statusYourTurn: "À vous",
    statusLocked: "Verrouillé",
    homeMayEnterHint:
      "Les visiteurs sont verrouillés. Vous pouvez maintenant saisir et verrouiller le line-up à domicile.",
    seatsHeading: "Places",
    roomOpen: "Salle ouverte",
    roomClosed: "Salle fermée",
    seatWithTable: (table, dir) => `Salle ouverte · Table ${table} · ${dir}`,
    seat: (dir, room) =>
      `${room === "open" ? "Salle ouverte" : "Salle fermée"} · ${dir}`,
    emptySeat: "— vide —",
    needAllSeats: "Remplissez toutes les places pour verrouiller (2/4).",
    substitutesHeading: "Remplaçants",
    addSubstitute: "+ Ajouter un remplaçant",
    remove: "Retirer",
    playerWithSub: "De Smet Luc (12003) (remplaçant)",
    submitLineup: "Verrouiller le line-up",
    lockConfirmTitle: "Verrouiller ce line-up ?",
    lockConfirmMessage:
      "Après verrouillage, vous ne pourrez plus modifier les places vous-même. En cas d'erreur, demandez au directeur ou à l'arbitre de déverrouiller.",
    cancel: "Annuler",
    phaseBothLockedTitle: "Les deux line-ups sont verrouillés",
    phaseBothLockedBody:
      "Les places sont fixées. Demandez au directeur ou à l'arbitre si un line-up doit être déverrouillé.",
    lockedAskDirector:
      "Ce line-up est verrouillé. Demandez au directeur ou à l'arbitre s'il doit être déverrouillé.",
  },
};

type PageProps = {
  searchParams: Promise<{ locale?: string }>;
};

export default async function HonorManualShotsPage({ searchParams }: PageProps) {
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
        Honor manual screenshot fixtures · locale={locale}
      </p>

      <Shot id="open-match" label="open-match">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <h1 className="text-lg font-semibold text-zinc-900">
            {t.openMatchTitle}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">{t.openMatchMeta}</p>
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <p className="font-medium">{t.phaseSequentialTitle}</p>
            <p className="mt-1 text-sky-900/80">{t.phaseSequentialAway}</p>
          </div>
        </div>
      </Shot>

      <Shot id="phase-rules" label="phase-rules">
        <div className="space-y-3">
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
            <p className="font-medium">{t.phaseSequentialTitle}</p>
            <p className="mt-1 text-sky-900/80">{t.phaseSequentialBody}</p>
          </div>
          <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-900">
            <p className="font-medium">{t.phaseBlindTitle}</p>
            <p className="mt-1 text-zinc-700">{t.phaseBlindBody}</p>
          </div>
        </div>
      </Shot>

      <Shot id="fill-seats" label="fill-seats">
        <EditorCard
          teamName="BBC 1"
          sideLabel={t.homeTeam}
          status={t.statusYourTurn}
          statusClass="bg-sky-100 text-sky-950 ring-1 ring-sky-200"
          borderClass="border-sky-300"
          guidance={t.homeMayEnterHint}
          guidanceClass="bg-sky-50 text-sky-950"
          seatsHeading={t.seatsHeading}
          seats={[
            {
              label: `${t.roomOpen} · ${locale === "nl" ? "Tafel" : "Table"} 1 · N`,
              value: "Janssens Piet (12001)",
            },
            {
              label: `${t.roomOpen} · ${locale === "nl" ? "Tafel" : "Table"} 1 · S`,
              value: "Peeters Anna (12002)",
            },
            {
              label: `${t.roomClosed} · ${locale === "nl" ? "Tafel" : "Table"} 2 · E`,
              value: t.emptySeat,
            },
            {
              label: `${t.roomClosed} · ${locale === "nl" ? "Tafel" : "Table"} 2 · W`,
              value: t.emptySeat,
            },
          ]}
          footerHint={t.needAllSeats}
        />
      </Shot>

      <Shot id="substitutes" label="substitutes">
        <EditorCard
          teamName="BBC 1"
          sideLabel={t.homeTeam}
          status={t.statusYourTurn}
          statusClass="bg-sky-100 text-sky-950 ring-1 ring-sky-200"
          borderClass="border-sky-300"
          seatsHeading={t.seatsHeading}
          seats={[
            { label: t.seat("N", "open"), value: "Janssens Piet (12001)" },
            { label: t.seat("S", "open"), value: "Peeters Anna (12002)" },
            { label: t.seat("E", "closed"), value: t.playerWithSub },
            { label: t.seat("W", "closed"), value: "Maes Els (12004)" },
          ]}
          showSubs
          substitutesHeading={t.substitutesHeading}
          subLabel={t.playerWithSub}
          removeLabel={t.remove}
          addSubstitute={t.addSubstitute}
        />
      </Shot>

      <Shot id="lock-lineup" label="lock-lineup">
        <div className="relative">
          <EditorCard
            teamName="BBC 1"
            sideLabel={t.homeTeam}
            status={t.statusYourTurn}
            statusClass="bg-sky-100 text-sky-950 ring-1 ring-sky-200"
            borderClass="border-sky-300"
            seatsHeading={t.seatsHeading}
            seats={[
              { label: t.seat("N", "open"), value: "Janssens Piet (12001)" },
              { label: t.seat("S", "open"), value: "Peeters Anna (12002)" },
              { label: t.seat("E", "closed"), value: "Claes Tom (12003)" },
              { label: t.seat("W", "closed"), value: "Maes Els (12004)" },
            ]}
            showLockButton
            lockLabel={t.submitLineup}
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg">
              <h4 className="text-sm font-semibold text-zinc-900">
                {t.lockConfirmTitle}
              </h4>
              <p className="mt-2 text-sm text-zinc-600">{t.lockConfirmMessage}</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <span className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700">
                  {t.cancel}
                </span>
                <span className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white">
                  {t.submitLineup}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Shot>

      <Shot id="after-lock" label="after-lock">
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            <p className="font-medium">{t.phaseBothLockedTitle}</p>
            <p className="mt-1 text-emerald-900/80">{t.phaseBothLockedBody}</p>
          </div>
          <EditorCard
            teamName="BBC 1"
            sideLabel={t.homeTeam}
            status={t.statusLocked}
            statusClass="bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200"
            borderClass="border-emerald-300"
            guidance={t.lockedAskDirector}
            guidanceClass="bg-emerald-50 text-emerald-950"
            seatsHeading={t.seatsHeading}
            seats={[
              { label: t.seat("N", "open"), value: "Janssens Piet (12001)" },
              { label: t.seat("S", "open"), value: "Peeters Anna (12002)" },
              { label: t.seat("E", "closed"), value: "Claes Tom (12003)" },
              { label: t.seat("W", "closed"), value: "Maes Els (12004)" },
            ]}
          />
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

function EditorCard({
  teamName,
  sideLabel,
  status,
  statusClass,
  borderClass,
  guidance,
  guidanceClass,
  seatsHeading,
  seats,
  footerHint,
  showSubs,
  substitutesHeading,
  subLabel,
  removeLabel,
  addSubstitute,
  showLockButton,
  lockLabel,
}: {
  teamName: string;
  sideLabel: string;
  status: string;
  statusClass: string;
  borderClass: string;
  guidance?: string;
  guidanceClass?: string;
  seatsHeading: string;
  seats: { label: string; value: string }[];
  footerHint?: string;
  showSubs?: boolean;
  substitutesHeading?: string;
  subLabel?: string;
  removeLabel?: string;
  addSubstitute?: string;
  showLockButton?: boolean;
  lockLabel?: string;
}) {
  return (
    <section className={`rounded-lg border bg-white p-4 ${borderClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{teamName}</h3>
          <p className="mt-1 text-xs text-zinc-500">{sideLabel}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
        >
          {status}
        </span>
      </div>

      {guidance ? (
        <p
          className={`mt-3 rounded-md px-3 py-2 text-sm ${guidanceClass ?? ""}`}
        >
          {guidance}
        </p>
      ) : null}

      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {seatsHeading}
      </p>
      <ul className="mt-2 space-y-3">
        {seats.map((seat) => (
          <li key={seat.label} className="text-sm">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              {seat.label}
            </label>
            <p
              className={`rounded border px-3 py-2 ${
                seat.value.startsWith("—")
                  ? "border-zinc-200 bg-white text-zinc-400"
                  : "border-zinc-100 bg-zinc-50 text-zinc-800"
              }`}
            >
              {seat.value}
            </p>
          </li>
        ))}
      </ul>

      {showSubs ? (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {substitutesHeading}
          </p>
          <ul className="mt-2 space-y-2">
            <li className="flex items-center justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-zinc-900">
              <span>{subLabel}</span>
              <span className="text-xs font-medium text-red-700 underline">
                {removeLabel}
              </span>
            </li>
          </ul>
          <p className="mt-2 text-sm font-medium text-emerald-800 underline">
            {addSubstitute}
          </p>
        </div>
      ) : null}

      {showLockButton ? (
        <div className="mt-4">
          <span className="inline-block rounded-md bg-emerald-800 px-3 py-1.5 text-sm font-medium text-white">
            {lockLabel}
          </span>
        </div>
      ) : null}

      {footerHint ? (
        <p className="mt-2 text-xs text-zinc-500">{footerHint}</p>
      ) : null}
    </section>
  );
}
