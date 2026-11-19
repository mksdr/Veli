export const formatName = (fileName: string): string =>
  fileName
    .replace(/(\.[^./\\()\s]+)(?:\s*\(\d+\))+(?=\.enc(?:\s*\(\d+\))*$)/, "$1")
    .replace(/\.enc(?:\s*\(\d+\))*$/, "");
