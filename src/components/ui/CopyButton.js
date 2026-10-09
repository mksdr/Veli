import { useId, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar, TextField } from "@mui/material";
import ContentCopy from "@mui/icons-material/ContentCopy";
import { getTranslations as t } from "../../../locales";
export default function CopyButton({ value, label, success, secret = false, disabled = false }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [pending, setPending] = useState(false);
  const id = useId();
  const copy = async () => {
    setPending(true);
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch { setFallback(true); }
    finally { setPending(false); }
  };
  return <>
    <Button onClick={copy} disabled={disabled || pending || !value} startIcon={<ContentCopy />} variant="outlined">{label}</Button>
    <Snackbar open={copied} autoHideDuration={3500} onClose={() => setCopied(false)}>
      <Alert severity="success" onClose={() => setCopied(false)}>{success}</Alert>
    </Snackbar>
    <Dialog open={fallback} onClose={() => setFallback(false)} fullWidth maxWidth="sm" aria-labelledby={id}>
      <DialogTitle id={id}>{t("copy_fallback_title")}</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>{t("copy_failed")}</Alert>
        <DialogContentText sx={{ mb: 2 }}>{t("copy_fallback_help")}</DialogContentText>
        <TextField label={label} value={value || ""} fullWidth multiline={!secret} inputProps={{ autoComplete: "off", spellCheck: false }} InputProps={{ readOnly: true }}
          autoFocus onFocus={event => event.target.select()} />
      </DialogContent>
      <DialogActions><Button onClick={() => setFallback(false)}>{t("close")}</Button></DialogActions>
    </Dialog>
  </>;
}
