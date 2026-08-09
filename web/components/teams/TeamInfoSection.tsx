"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TeamDetail } from "@/lib/competition/team-queries";
import { translateLeagueName } from "@/lib/i18n/labels";
import { TeamLocationModal } from "./TeamLocationModal";

type Props = Pick<
  TeamDetail,
  "team" | "captain" | "club" | "group" | "division" | "league" | "clubLocation" | "hasCentralizedVenue"
> & {
  canLinkToPlayers: boolean;
  showCaptainContacts: boolean;
  canManageLocation: boolean;
};

function trimmed(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

export function TeamInfoSection({
  team,
  captain,
  club,
  group,
  division,
  league,
  clubLocation,
  hasCentralizedVenue,
  canLinkToPlayers,
  showCaptainContacts,
  canManageLocation,
}: Props) {
  const t = useTranslations("team");
  const tRegions = useTranslations("regions");
  const leagueName = translateLeagueName(league.name, tRegions);

  const email = showCaptainContacts ? trimmed(captain?.email) : null;
  const phone = showCaptainContacts ? trimmed(captain?.phone) : null;
  const mobilePhone = showCaptainContacts
    ? trimmed(captain?.mobile_phone)
    : null;

  const [displayLocation, setDisplayLocation] = useState(team.location);
  const [locationOverride, setLocationOverride] = useState(
    team.locationOverride,
  );
  const [clubLocationDisplay, setClubLocationDisplay] = useState(clubLocation);
  const [modalOpen, setModalOpen] = useState(false);

  const showChangeLocation = canManageLocation && !hasCentralizedVenue;

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-600">
        {[leagueName, division.name, group.name].join(" · ")}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{team.name}</h1>
      <p className="mt-1 text-sm text-zinc-600">{club.name}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium text-zinc-500">{t("captain")}</dt>
          <dd className="mt-0.5 text-zinc-900">
            {captain ? (
              <>
                {canLinkToPlayers ? (
                  <Link
                    href={`/players/${captain.id}?from=/teams/${team.id}`}
                    className="hover:text-emerald-800 hover:underline"
                  >
                    {captain.name}
                  </Link>
                ) : (
                  captain.name
                )}
                {captain.member_number ? (
                  <span className="text-zinc-600"> · {captain.member_number}</span>
                ) : null}
              </>
            ) : (
              <span className="text-zinc-500">{t("captainNotSet")}</span>
            )}
          </dd>
          {email || phone || mobilePhone ? (
            <dl className="mt-2 space-y-1.5 text-sm">
              {email ? (
                <div>
                  <dt className="font-medium text-zinc-500">{t("captainEmail")}</dt>
                  <dd className="mt-0.5">
                    <a
                      href={`mailto:${email}`}
                      className="text-zinc-900 hover:text-emerald-800 hover:underline"
                    >
                      {email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {phone ? (
                <div>
                  <dt className="font-medium text-zinc-500">{t("captainPhone")}</dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:${phone}`}
                      className="text-zinc-900 hover:text-emerald-800 hover:underline"
                    >
                      {phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {mobilePhone ? (
                <div>
                  <dt className="font-medium text-zinc-500">
                    {t("captainMobilePhone")}
                  </dt>
                  <dd className="mt-0.5">
                    <a
                      href={`tel:${mobilePhone}`}
                      className="text-zinc-900 hover:text-emerald-800 hover:underline"
                    >
                      {mobilePhone}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
        <div>
          <dt className="font-medium text-zinc-500">{t("location")}</dt>
          <dd className="mt-0.5 text-zinc-900">
            {displayLocation?.trim() ? displayLocation : (
              <span className="text-zinc-500">{t("locationNotSet")}</span>
            )}
          </dd>
          {showChangeLocation ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="btn-secondary mt-2 px-3 py-1.5 text-sm"
            >
              {t("locationEdit.changeButton")}
            </button>
          ) : null}
        </div>
      </dl>

      {modalOpen ? (
        <TeamLocationModal
          teamId={team.id}
          locationOverride={locationOverride}
          clubLocation={clubLocationDisplay}
          onClose={() => setModalOpen(false)}
          onSaved={(result) => {
            setDisplayLocation(result.location);
            setLocationOverride(result.locationOverride);
            setClubLocationDisplay(result.clubLocation);
          }}
        />
      ) : null}
    </section>
  );
}
