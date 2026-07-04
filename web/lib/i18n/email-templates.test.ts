import { describe, expect, it } from "vitest";
import {
  buildHomeAwaySwitchProposedEmail,
  buildPostponementProposedEmail,
  loadEmailTemplateContext,
} from "./email-templates";

const captainFields = {
  requestingCaptainName: "Jan Janssens",
  requestingCaptainEmail: "jan@example.com",
  receivingCaptainName: "Piet Pieters",
  receivingCaptainEmail: "piet@example.com",
};

describe("workflow email templates", () => {
  it("includes captain contacts and do-not-reply in postponement proposed email", async () => {
    const ctx = await loadEmailTemplateContext("en");
    const { bodyText, bodyHtml } = buildPostponementProposedEmail(
      {
        matchId: "m1",
        round: 4,
        homeTeamName: "Home FC",
        awayTeamName: "Away FC",
        previousDatetime: "2026-01-01T18:00:00.000Z",
        proposedDatetime: "2026-01-08T18:00:00.000Z",
        proposingTeamName: "Home FC",
        ...captainFields,
      },
      "https://app.example.com/matches/m1",
      ctx,
    );

    expect(bodyText).toContain("Please do not reply to this email");
    expect(bodyText).toContain("Requesting captain: Jan Janssens (jan@example.com)");
    expect(bodyText).toContain("Receiving captain: Piet Pieters (piet@example.com)");
    expect(bodyHtml).toContain("jan@example.com");
    expect(bodyHtml).toContain("piet@example.com");
  });

  it("uses email unavailable fallback when captain email is missing", async () => {
    const ctx = await loadEmailTemplateContext("en");
    const { bodyText } = buildHomeAwaySwitchProposedEmail(
      {
        matchId: "m1",
        round: 4,
        homeTeamName: "Home FC",
        awayTeamName: "Away FC",
        requestingTeamName: "Home FC",
        requestingCaptainName: "Jan Janssens",
        requestingCaptainEmail: null,
        receivingCaptainName: "Piet Pieters",
        receivingCaptainEmail: "piet@example.com",
      },
      "https://app.example.com/matches/m1",
      "https://app.example.com/login?next=%2Fmatches%2Fm1",
      ctx,
    );

    expect(bodyText).toContain("Requesting captain: Jan Janssens (email not on file)");
  });
});
