import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CONVENTION_CARDS_BUCKET,
  type ValidatedConventionCardFile,
} from "./convention-card-upload";

export async function uploadConventionCardFile(
  supabase: SupabaseClient,
  storagePath: string,
  file: Blob | ArrayBuffer | Buffer,
  validated: ValidatedConventionCardFile,
): Promise<void> {
  const body =
    file instanceof ArrayBuffer
      ? file
      : Buffer.isBuffer(file)
        ? file
        : await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(CONVENTION_CARDS_BUCKET)
    .upload(storagePath, body, {
      contentType: validated.mime,
      upsert: true,
    });

  if (error) throw error;
}

export async function removeConventionCardFile(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(CONVENTION_CARDS_BUCKET)
    .remove([storagePath]);

  if (error) throw error;
}
