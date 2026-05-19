import type { SupabaseClient } from "@supabase/supabase-js";
import {
  OPERATIONAL_FILES_BUCKET,
  type ValidatedOperationalFile,
} from "./operational-file-upload";

export async function uploadOperationalFile(
  supabase: SupabaseClient,
  storagePath: string,
  file: Blob | ArrayBuffer | Buffer,
  validated: ValidatedOperationalFile,
): Promise<void> {
  const body =
    file instanceof ArrayBuffer
      ? file
      : Buffer.isBuffer(file)
        ? file
        : await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(OPERATIONAL_FILES_BUCKET)
    .upload(storagePath, body, {
      contentType: validated.mime,
      upsert: true,
    });

  if (error) throw error;
}

export async function removeOperationalFile(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(OPERATIONAL_FILES_BUCKET)
    .remove([storagePath]);

  if (error) throw error;
}

export async function createOperationalSignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(OPERATIONAL_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}
