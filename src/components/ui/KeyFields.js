import { useId, useRef, useState } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Stack, TextField, Tooltip } from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { getTranslations as t } from "../../../locales";
export default function KeyFields({ direction, publicKey, privateKey, onPublicKey, onPrivateKey, publicKeyError, privateKeyError, disabled }) {
  const [visible, setVisible] = useState(false);
  const [readError, setReadError] = useState(false);
  const publicInput = useRef(null), privateInput = useRef(null);
  const id = useId();
  const load = async (file, apply) => {
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("Key file too large");
      apply((await file.text()).trim());
      setReadError(false);
    } catch { setReadError(true); }
  };
  return <Stack spacing={2}>
    <TextField id={`${direction}-public-key-input`} label={t(direction === "encrypt" ? "recipient_public_key" : "sender_public_key")}
      placeholder={t(direction === "encrypt" ? "enter_recipient_public_key" : "enter_sender_public_key")}
      value={publicKey || ""} onChange={event => onPublicKey(event.target.value)} fullWidth required disabled={disabled}
      error={!!publicKeyError} helperText={t(publicKeyError ? "wrong_public_key" : direction === "encrypt" ? "public_key_help_enc" : "public_key_help_dec")}
      inputProps={{ spellCheck: false, autoCapitalize: "none", autoComplete: "off" }} />
    <Box><input ref={publicInput} id={`${id}-public`} hidden type="file" accept=".public,text/plain" onChange={event => { load(event.target.files[0], onPublicKey); event.target.value = ""; }} />
      <Button variant="outlined" disabled={disabled} onClick={() => publicInput.current.click()}>{t("load_public_key")}</Button></Box>
    <TextField id={`${direction}-private-key-input`} label={t("private_key")} placeholder={t(direction === "encrypt" ? "enter_private_key_enc" : "enter_private_key_dec")}
      type={visible ? "text" : "password"} value={privateKey || ""} onChange={event => onPrivateKey(event.target.value)} fullWidth required disabled={disabled}
      error={!!privateKeyError} helperText={t(privateKeyError ? "wrong_private_key" : "private_key_help")}
      inputProps={{ spellCheck: false, autoCapitalize: "none", autoComplete: "off" }} InputProps={{ endAdornment:
        <InputAdornment position="end"><Tooltip title={t(visible ? "hide_private_key" : "show_private_key")}>
          <IconButton disabled={disabled} aria-label={t(visible ? "hide_private_key" : "show_private_key")} aria-pressed={visible} onClick={() => setVisible(!visible)}>
            {visible ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        </Tooltip></InputAdornment> }} />
    <Box><input ref={privateInput} id={`${id}-private`} hidden type="file" accept=".private,text/plain" onChange={event => { load(event.target.files[0], onPrivateKey); event.target.value = ""; }} />
      <Button variant="outlined" disabled={disabled} onClick={() => privateInput.current.click()}>{t("load_private_key")}</Button></Box>
    {readError && <Alert severity="error">{t("file_read_error")}</Alert>}
  </Stack>;
}
