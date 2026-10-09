import { useId, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import Language from "../config/Language";
import { DarkMode } from "../config/Theme";
import { getTranslations as t } from "../../locales";
export default function Settings() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <>
    <IconButton aria-label={t("settings")} onClick={() => setOpen(true)}><SettingsIcon /></IconButton>
    <Dialog maxWidth="xs" fullWidth open={open} onClose={() => setOpen(false)} aria-labelledby={id}>
      <DialogTitle id={id}>{t("settings")}</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Language /><Typography variant="body2" color="text.secondary">{t("languages_notice")}</Typography><DarkMode />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>{t("close")}</Button></DialogActions>
    </Dialog>
  </>;
}
