import { Box, Container, Typography } from "@mui/material";
import { getTranslations as t } from "../../locales";
export default function Hero() {
  return <Container maxWidth="sm" sx={{ pt: { xs: 3, sm: 6 }, pb: { xs: 3, sm: 4 } }}>
    <Typography component="h1" variant="h1" sx={{ fontSize: { xs: 28, sm: 36 } }}>{t("hero_title")}</Typography>
    <Typography color="text.secondary" sx={{ mt: 1.5 }}>{t("hero_description")}</Typography>
    <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}>
      <Box aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "primary.main", flexShrink: 0 }} />
      <Typography variant="body2" color="text.secondary">{t("offline_note")}</Typography>
    </Box>
  </Container>;
}
