export const formatName = (fileName: string): string => {
  const trimmed = fileName.replace(/(\s*\(\d+\))?\.enc(\s*\(\d+\))?$/, "$1$2");
  const clean = trimmed.replace(/\s*\(\d+\)$/, "");

  return clean;
};
