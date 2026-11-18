import { Box, Link, Typography } from "@mui/material";
import { getTranslations as t } from "../../locales";
export default function Footer() {
  return <Box component="footer" sx={{ textAlign: "center", color: "text.secondary", px: 2, py: 4, mt: "auto" }}>
    <Typography variant="body2">{t("footer_local")}</Typography>
    <Typography variant="caption">{t("footer_credit")} {" "}
      <Link href="https://github.com/sh-dv/hat.sh" target="_blank" rel="noopener noreferrer" color="inherit">hat.sh</Link>
      {" · "}<Link href="https://github.com/mrtechtroid/hatsmith" target="_blank" rel="noopener noreferrer" color="inherit">Hatsmith</Link>
    </Typography>
  </Box>;
}
