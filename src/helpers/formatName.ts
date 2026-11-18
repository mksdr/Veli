export const formatName = (fileName: string): string => {
  //remove .enc
  const trimmed = fileName.replace(".enc", "");
  //remove parenthesis
  const clean = trimmed.replace(/ *\([^)]*\) */g, "");

  return clean;
};
