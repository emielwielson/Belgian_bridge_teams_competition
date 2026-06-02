"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { isErrorCode } from "@/lib/http/error-codes";

export function useTranslateApiError() {
  const t = useTranslations("errors");

  return useCallback(
    (
      error: string | undefined | null,
      params?: Record<string, string | number>,
    ): string => {
      if (!error) {
        return t("unknown");
      }
      if (isErrorCode(error)) {
        return t(error, params);
      }
      return error;
    },
    [t],
  );
}
