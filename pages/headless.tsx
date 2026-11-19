import { Box, Typography } from "@mui/material";
import useFileProcessingSupport from "../src/utils/useFileProcessingSupport";
import Loading from "../src/components/Loading";
import Panels from "../src/components/Panels";
import { getTranslations as t } from "../locales";
export default function Headless() {
  const { loading, streaming } = useFileProcessingSupport();
  return <Box sx={{ py: 3 }}><Loading open={loading} />
    {!loading && <Panels buffered={!streaming} />}
    <Typography variant="caption" component="p" color="text.secondary" align="center" sx={{ mt: 2 }}>{t("headless_note")}</Typography>
  </Box>;
}
