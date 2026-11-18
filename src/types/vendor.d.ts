declare module "marked" {
  export interface MarkedOptions {
    highlight?: (code: string, lang: string) => string;
  }
  export function marked(src: string, options?: MarkedOptions): string;
  export namespace marked {
    function setOptions(options: MarkedOptions): void;
  }
}

declare module "prismjs" {
  export type Grammar = Record<string, unknown>;
  export const languages: Record<string, Grammar | undefined>;
  export function highlight(
    text: string,
    grammar: Grammar,
    language: string,
  ): string;
}
