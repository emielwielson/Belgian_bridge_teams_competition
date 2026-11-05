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
  options?: {
    expiresInSeconds?: number;
    downloadFileName?: string | null;
  },
): Promise<string> {
  const expiresInSeconds = options?.expiresInSeconds ?? 3600;
  const downloadFileName = options?.downloadFileName?.trim();
  const signedOptions = downloadFileName
    ? { download: downloadFileName }
    : undefined;
  const { data, error } = await supabase.storage
    .from(OPERATIONAL_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds, signedOptions);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Failed to create signed URL");
  return data.signedUrl;
}

export async function downloadOperationalFile(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<{ data: Blob; contentType: string | null }> {
  const { data, error } = await supabase.storage
    .from(OPERATIONAL_FILES_BUCKET)
    .download(storagePath);

  if (error) throw error;
  if (!data) throw new Error("Failed to download file");
  return {
    data,
    contentType: data.type || null,
  };
}
