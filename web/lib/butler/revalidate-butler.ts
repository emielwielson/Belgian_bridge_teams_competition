import { revalidatePath } from "next/cache";

/** Bust public Butler pages after IMP / datum recalculation. */
export function revalidateButlerPublicPages(): void {
  revalidatePath("/butler", "layout");
}
