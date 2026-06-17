import { getTranslations } from "next-intl/server";
import { GroupPenaltiesSection } from "@/components/standings/GroupPenaltiesSection";
import { GroupRulingsSection } from "@/components/standings/GroupRulingsSection";
import { getCachedGroupDisciplineData } from "@/lib/competition/standings-cache";
import { createServiceClient } from "@/lib/supabase/server-client";
import { createOperationalSignedUrl } from "@/lib/files/operational-file-storage";

type Props = {
  groupId: string;
};

export async function GroupDisciplineSections({ groupId }: Props) {
  const { penalties, rulings } = await getCachedGroupDisciplineData(groupId);

  if (penalties.length === 0 && rulings.length === 0) {
    return null;
  }

  const service = createServiceClient();

  const penaltiesWithUrls = await Promise.all(
    penalties.map(async (penalty) => {
      if (!penalty.file_path) return { ...penalty, signed_url: null };
      try {
        const signed_url = await createOperationalSignedUrl(
          service,
          penalty.file_path,
        );
        return { ...penalty, signed_url };
      } catch {
        return { ...penalty, signed_url: null };
      }
    }),
  );

  const rulingsWithUrls = await Promise.all(
    rulings.map(async (ruling) => {
      try {
        const signed_url = await createOperationalSignedUrl(
          service,
          ruling.file_path,
        );
        return { ...ruling, signed_url };
      } catch {
        return { ...ruling, signed_url: null };
      }
    }),
  );

  return (
    <>
      <GroupPenaltiesSection penalties={penaltiesWithUrls} />
      <GroupRulingsSection rulings={rulingsWithUrls} />
    </>
  );
}

export async function GroupDisciplineSectionsFallback() {
  const t = await getTranslations("standings.disciplineLoading");
  return (
    <p className="text-sm text-zinc-500" aria-busy="true">
      {t("message")}
    </p>
  );
}
