/** Regional leagues use first/second/third — never honor (national Eredivisie). */
export function regionalDivisionLevelCode(
  name: string,
): "first" | "second" | "third" {
  const match = name.trim().match(/liga\s*([123])/i);
  if (match?.[1] === "2") return "second";
  if (match?.[1] === "3") return "third";
  return "first";
}
