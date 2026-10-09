import Link from "next/link";
import { Box, Button, Stack, Typography } from "@mui/material";
import { getTranslations as t } from "../locales";
export default function Custom404() {
  return <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 3 }}>
    <Stack alignItems="center" spacing={2}><Typography color="text.secondary">404</Typography>
      <Typography variant="h1" component="h1">{t("page_not_found")}</Typography>
      <Button component={Link} href="/" variant="contained">{t("home")}</Button>
    </Stack>
  </Box>;
}
