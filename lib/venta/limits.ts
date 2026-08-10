/* Límites duros de caracteres por bloque de las slides. Es lo que mantiene el
   deck sin desbordes.

   Viven en su propio módulo (y no en copy.ts) porque el editor los usa en el
   cliente para pintar el contador, y copy.ts arrastra el SDK de Anthropic y la
   conexión a Postgres. */
export const LIMITS = {
  subtitle: 165,
  cardTitle: 40,
  cardDesc: 152,
  insightTitle: 52,
  insightDesc: 190,
  compTitle: 48,
  compLabel: 24,
  compDesc: 160,
  closingTitle: 42,
  closingText: 200,
};
