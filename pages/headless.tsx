import { Box, Typography } from "@mui/material";
import useFileProcessingSupport from "../src/utils/useFileProcessingSupport";
import Panels from "../src/components/Panels";
import { getTranslations as t } from "../locales";
export default function Headless() {
  const streaming = useFileProcessingSupport();
  return <Box sx={{ py: 3 }}>
    {streaming !== null && <Panels buffered={!streaming} />}
    <Typography variant="caption" component="p" color="text.secondary" align="center" sx={{ mt: 2 }}>{t("headless_note")}</Typography>
  </Box>;
}
