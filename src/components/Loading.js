import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { getTranslations as t } from "../../locales";
export default function Loading({ open }) {
  return open ? <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }} role="status">
    <Stack spacing={2} alignItems="center"><CircularProgress /><Typography>{t("loading")}</Typography></Stack>
  </Box> : null;
}
