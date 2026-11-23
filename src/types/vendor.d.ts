declare module "prismjs" {
  export type Grammar = Record<string, unknown>;
  export const languages: Record<string, Grammar | undefined>;
  export function highlight(
    text: string,
    grammar: Grammar,
    language: string,
  ): string;
}
