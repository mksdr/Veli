import { useId, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { getTranslations as t, useLocale } from "../../locales";
import locales from "../../locales/locales";
import { useWorkflow } from "../components/WorkflowContext";
export default function Language() {
  const { locale, changeLocale } = useLocale();
  const { busy, dirty } = useWorkflow();
  const [pending, setPending] = useState(null);
  const id = useId();
  const choose = event => {
    if (dirty) setPending(event.target.value);
    else changeLocale(event.target.value);
  };
  return <>
    <FormControl size="small" sx={{ minWidth: 130, my: 1 }} disabled={busy}>
      <InputLabel id={id}>{t("language")}</InputLabel>
      <Select labelId={id} value={locale} onChange={choose} label={t("language")}>
        {Object.entries(locales).map(([code, copy]) => <MenuItem key={code} value={code}>{copy.language_name}</MenuItem>)}
      </Select>
    </FormControl>
    <Dialog open={!!pending} onClose={() => setPending(null)} aria-labelledby={`${id}-title`}>
      <DialogTitle id={`${id}-title`}>{t("language_restart_title")}</DialogTitle>
      <DialogContent><DialogContentText>{t("language_restart_description")}</DialogContentText></DialogContent>
      <DialogActions><Button onClick={() => setPending(null)}>{t("cancel")}</Button>
        <Button variant="contained" disabled={busy} onClick={() => changeLocale(pending)}>{t("language_restart")}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
