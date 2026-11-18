export interface WorkerConfig {
  encoder: TextEncoder;
  decoder: TextDecoder;
  sigCodes: {
    readonly v1: string;
    readonly v2_symmetric: string;
    readonly v2_asymmetric: string;
  };
}

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();
export const sigCodes = {
  v1: "Encrypted Using Hat.sh",
  v2_symmetric: "zDKO6XYXioc",
  v2_asymmetric: "hTWKbfoikeg",
} as const;
