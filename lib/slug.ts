/* Slug de marca → segmento de URL. Misma implementación que ya usan
   full_service y research-pitch, para que los links no cambien de forma. */
export function slugify(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita los acentos que dejó el NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
