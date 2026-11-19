export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
export const sigCodes = {
  v1: "Encrypted Using Hat.sh",
  v2_symmetric: "zDKO6XYXioc",
  v2_asymmetric: "hTWKbfoikeg",
} as const;

export interface WorkerConfig {
  encoder: TextEncoder;
  decoder: TextDecoder;
  sigCodes: {
    readonly [K in keyof typeof sigCodes]: string;
  };
}
