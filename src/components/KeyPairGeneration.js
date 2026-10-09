import { useId, useState } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, InputAdornment, Paper, Stack, TextField, Tooltip, Typography } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { generateAsymmetricKeys } from "../utils/generateAsymmetricKeys";
import { downloadBlob } from "../utils/downloadBlob";
import { getTranslations as t } from "../../locales";
import { useWorkflowStatus } from "./WorkflowContext";
import QuickResponseCode from "./QuickResponseCode";
import CopyButton from "./ui/CopyButton";
export default function KeysGeneration({ opened = false, onUsePrivateKey }) {
  const [open, setOpen] = useState(opened);
  const [keys, setKeys] = useState(null);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [replace, setReplace] = useState(false);
  const [requested, setRequested] = useState(false);
  const id = useId();
  useWorkflowStatus(id, pending, !!keys);
  const generate = async () => {
    setReplace(false); setPending(true); setError(false); setVisible(false);
    try { setKeys(await generateAsymmetricKeys()); }
    catch { setError(true); }
    finally { setPending(false); }
  };
  const download = (value, filename) => { downloadBlob(new Blob([value], { type: "text/plain" }), filename); setRequested(true); };
  return <Box>
    {!opened && <Button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={`${id}-form`}>{t("key_pair_question")} {t("generate_now_button")}</Button>}
    {open && <Paper id={`${id}-form`} variant="outlined" sx={{ p: 2.5 }}><Stack spacing={2}>
      <Typography component="h3" variant="h6">{t("key_pair_generation_title")}</Typography>
      <Typography variant="body2" color="text.secondary">{t("keys_create_description")}</Typography>
      <Alert severity="info">{t("private_key_notice")}</Alert>
      {error && <Alert severity="error">{t("keys_generate_error")}</Alert>}
      <Button className="keyPairGenerateBtn" variant="outlined" disabled={pending} onClick={() => keys ? setReplace(true) : generate()}>{t(keys ? "generate_another_key_pair_button" : "generate_key_pair_button")}</Button>
      {keys && <>
        <TextField id="generatedPublicKey" label={t("public_key")} value={keys.publicKey} fullWidth InputProps={{ readOnly: true }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={() => download(keys.publicKey, "key.public")}>{t("download_public_key")}</Button>
          <QuickResponseCode publicKey={keys.publicKey} />
        </Stack>
        <TextField id="generatedPrivateKey" label={t("private_key")} value={keys.privateKey} type={visible ? "text" : "password"} fullWidth
          InputProps={{ readOnly: true, endAdornment: <InputAdornment position="end"><Tooltip title={t(visible ? "hide_private_key" : "show_private_key")}>
            <IconButton aria-label={t(visible ? "hide_private_key" : "show_private_key")} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <VisibilityOff /> : <Visibility />}</IconButton>
          </Tooltip></InputAdornment> }} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={() => download(keys.privateKey, "key.private")}>{t("download_private_key")}</Button>
          <CopyButton value={keys.privateKey} secret label={t("copy_private_key")} success={t("private_key_copied")} />
        </Stack>
        {onUsePrivateKey && <Button variant="outlined" onClick={() => onUsePrivateKey(keys.privateKey)}>{t("use_private_key")}</Button>}
      </>}
      {requested && <Typography variant="body2" role="status">{t("download_check")}</Typography>}
    </Stack></Paper>}
    <Dialog open={replace} onClose={() => setReplace(false)} aria-labelledby={`${id}-replace`}>
      <DialogTitle id={`${id}-replace`}>{t("keys_replace_title")}</DialogTitle>
      <DialogContent><DialogContentText>{t("keys_replace_description")}</DialogContentText></DialogContent>
      <DialogActions><Button onClick={() => setReplace(false)}>{t("cancel")}</Button><Button onClick={generate}>{t("keys_replace")}</Button></DialogActions>
    </Dialog>
  </Box>;
}
