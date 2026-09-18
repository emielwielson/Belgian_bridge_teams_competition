import { NextResponse } from "next/server";
import { assertArbiterHonorApiAccess } from "@/lib/auth/arbiter-scope";
import { ARBITER_ACCESS_ROLES } from "@/lib/auth/roles";
import { requireRoles } from "@/lib/auth/route-auth";
import { exportHonorRoundBws } from "@/lib/bridgemate/honor-bws-export";
import {
  defaultHonorRound,
  loadHonorRoundMeta,
  loadHonorRoundSeating,
  resolveActiveHonorGroup,
} from "@/lib/competition/honor-seating-overview";
import { jsonError, jsonFromError } from "@/lib/http/api-response";

export async function GET(request: Request) {
  try {
    const { user, roles, supabase } = await requireRoles([...ARBITER_ACCESS_ROLES]);
    await assertArbiterHonorApiAccess(supabase, user.id, roles);
    const group = await resolveActiveHonorGroup(supabase);
    if (!group) {
      return jsonError("Honor division group not found for the active season", 404);
    }

    const url = new URL(request.url);
    const roundParam = url.searchParams.get("round");
    const meta = await loadHonorRoundMeta(supabase, group.id);
    const requestedRound = roundParam ? Number(roundParam) : NaN;
    const round =
      Number.isInteger(requestedRound) &&
      requestedRound >= 1 &&
      requestedRound <= group.round_count
        ? requestedRound
        : defaultHonorRound(meta);

    const seating = await loadHonorRoundSeating(supabase, group, round);
    const exported = exportHonorRoundBws(round, seating.matches);
    if (!exported.ok) {
      return NextResponse.json(
        {
          error: exported.errors[0] ?? "Kon .bws niet maken.",
          errors: exported.errors,
        },
        { status: 400 },
      );
    }

    return new NextResponse(new Uint8Array(exported.buffer), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${exported.plan.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonFromError(err);
  }
}
