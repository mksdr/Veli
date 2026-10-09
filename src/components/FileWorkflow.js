import { useEffect, useRef, useState } from "react";
import { Alert, AlertTitle, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, InputAdornment, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography } from "@mui/material";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutline from "@mui/icons-material/CheckCircleOutline";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import ArrowForward from "@mui/icons-material/ArrowForward";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import { getTranslations as t } from "../../locales";
import { formatBytes } from "../helpers/formatBytes";
import passwordStrengthCheck from "../utils/passwordStrengthCheck";
import { useWorkflowStatus } from "./WorkflowContext";
import FileInfoDialog from "./FileInfoDialog";
import KeyPairGeneration from "./KeyPairGeneration";
import CopyButton from "./ui/CopyButton";
import KeyFields from "./ui/KeyFields";

// The processing adapters own cryptography; this view owns presentation only.
export default function FileWorkflow({ direction, active, step, done, buffered = false, files = [], onFiles, onRemove,
  onFileContinue, method, onMethod, password, onPassword, onGenerate, publicKey, privateKey, onPublicKey, onPrivateKey,
  passwordError, publicKeyError, privateKeyError, keysError, fileError, operationError, errorFile,
  checking = false, testing = false, processing = false, currentFile = 0,
  onCredentialContinue, onExecute, onDownload, onReset, onBack, onCancel,
  rootProps, isDragActive, publicKeyNotice, shareableLink, onCreateLink }) {
  const encrypt = direction === "encrypt";
  const [visible, setVisible] = useState(false);
  const [generation, setGeneration] = useState("random");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState(null);
  const [downloadRequested, setDownloadRequested] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const [linkPending, setLinkPending] = useState(false);
  const fileInput = useRef(null), heading = useRef(null), passwordInput = useRef(null), operationAlert = useRef(null);
  const busy = checking || testing || processing || generating || linkPending;
  useWorkflowStatus(direction, busy, files.length > 0 || !!password || !!privateKey || !!publicKey);
  useEffect(() => {
    if (active && (step > 0 || done)) heading.current?.focus();
    setVisible(false);
    setDownloadRequested(false);
  }, [active, step, done]);
  useEffect(() => {
    if (!active) return;
    if (passwordError) passwordInput.current?.focus();
    else if (operationError || keysError || fileError) operationAlert.current?.focus();
  }, [active, passwordError, operationError, keysError, fileError]);
  const generate = async () => {
    setGenerating(true);
    setGenerateError(false);
    try { await onGenerate(generation); }
    catch { setGenerateError(true); }
    finally { setGenerating(false); }
  };
  const title = done ? t(encrypt ? "result_enc_title" : "result_dec_title") : step === 0 ? t(encrypt ? "select_enc_title" : "select_dec_title") : step === 1 ? t(method === "publicKey" ? encrypt ? "enter_keys_enc" : "enter_keys_dec" : encrypt ? "enter_password_enc" : "enter_password_dec") : t(encrypt ? "review_enc_title" : "review_dec_title");
  const currentStep = done ? 3 : processing ? 2 : step;
  const status = checking ? t("checking_file") : testing ? t(method === "publicKey" ? "testing_keys" : "testing_password") : t(encrypt ? "processing_enc" : "processing_dec");
  const errorMessage = operationError ? t("file_processing_error") : fileError || keysError;
  const credentialLabel = encrypt ? t("prepare_encryption") : buffered ? t("decrypt_action") : t(method === "publicKey" ? "check_keys" : "check_password");
  const executeLabel = t(buffered ? encrypt ? "encrypt_action" : "decrypt_action" : encrypt ? "encrypt_download" : "decrypt_download");
  const fieldFilled = method === "publicKey" ? !!publicKey && !!privateKey : !!password;
  const fileRows = (editable) => <Stack spacing={1}>
    {files.map((file, index) => <Box key={`${file.name}-${file.size}-${index}`} sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderRadius: 2, bgcolor: "action.hover", minWidth: 0 }}>
      <DescriptionOutlined color="action" sx={{ flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{file.name}</Typography>
        <Typography variant="caption" color="text.secondary">{formatBytes(file.size)}</Typography></Box>
      <Tooltip title={t("file_details")}><IconButton disabled={busy} aria-label={`${t("file_details")}: ${file.name}`} onClick={() => setSelectedInfo(file)}><InfoOutlined /></IconButton></Tooltip>
      {editable && <Tooltip title={t("remove_file")}><IconButton disabled={busy} aria-label={`${t("remove_file")}: ${file.name}`} onClick={() => onRemove(index)}><DeleteOutline /></IconButton></Tooltip>}
    </Box>)}
  </Stack>;
  const primary = (label, action, disabled, icon = <ArrowForward />) => <Button size="large" fullWidth variant="contained" disabled={disabled || busy} onClick={action} endIcon={icon}>{label}</Button>;
  const actions = (label, action, disabled) => <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
    <Button onClick={onBack} disabled={busy} sx={{ flexShrink: 0, minWidth: 72, whiteSpace: "nowrap" }}>{t("back")}</Button>{primary(label, action, disabled)}
  </Stack>;

  return <Box {...rootProps} sx={{ minWidth: 0 }}>
    <Box component="ol" aria-label={t("step_result")} sx={{ m: 0, mb: 3, p: 0, display: "flex", gap: 1, listStyle: "none" }}>
      {["step_files", "step_credentials", "step_result"].map((label, index) => <Box component="li" key={label} aria-current={index === currentStep ? "step" : undefined}
        sx={{ flex: 1, display: "flex", alignItems: "center", gap: .75, color: index <= currentStep ? "primary.main" : "text.secondary", fontSize: { xs: 12, sm: 14 }, fontWeight: index === currentStep ? 700 : 400 }}>
        <Box aria-hidden="true" sx={{ bgcolor: index <= currentStep ? "primary.main" : "action.hover", color: index <= currentStep ? "primary.contrastText" : "text.secondary", borderRadius: "50%", minWidth: 24, height: 24, display: "grid", placeItems: "center", fontSize: 12 }}>{index < currentStep ? "✓" : index + 1}</Box>{t(label)}
      </Box>)}
    </Box>
    <Paper variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderColor: isDragActive ? "primary.main" : "divider", backgroundImage: "none" }} aria-busy={busy}>
      <Stack spacing={3}>
        <Box>{done && <CheckCircleOutline color="success" sx={{ fontSize: 40, mb: 1 }} />}
          <Typography variant="h2" component="h2" ref={heading} tabIndex={-1} sx={{ outline: "none", fontSize: { xs: 22, sm: 26 } }}>{title}</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>{t(done ? buffered ? "result_buffered" : "result_streamed" : step === 0 ? "select_description" : step === 2 ? "review_description" : method === "publicKey" ? "keys_explanation" : encrypt ? "password_explanation" : "decrypt_hint")}</Typography>
        </Box>
        {publicKeyNotice && <Alert severity="info">{t(encrypt ? "recipient_key_loaded" : "sender_key_loaded")}</Alert>}
        {errorMessage && <Alert severity="error" ref={operationAlert} tabIndex={-1}>
          {errorMessage}{errorFile && <Typography variant="body2" sx={{ mt: 1, overflowWrap: "anywhere" }}>{errorFile}</Typography>}
        </Alert>}
        {step === 0 && !done && <>
          {buffered && <Alert severity="info">{t("buffered_mode_notice")}</Alert>}
          <Box sx={{ p: 2.5, border: "2px dashed", borderColor: isDragActive ? "primary.main" : "divider", borderRadius: 3, textAlign: "center" }}>
            <Box sx={{ mb: 2 }}>{files.length ? fileRows(true) : <><DescriptionOutlined sx={{ fontSize: 40, color: "primary.main", mb: 1 }} /><Typography color="text.secondary" variant="body2">{t("drag_drop")}</Typography></>}</Box>
            <input ref={fileInput} id={encrypt ? "enc-file" : "dec-file"} hidden type="file" multiple={!buffered} disabled={busy}
              onChange={event => { onFiles(Array.from(event.target.files)); event.target.value = ""; }} />
            <Button variant="outlined" disabled={busy} onClick={() => fileInput.current.click()}>{t(files.length ? buffered ? "change_file" : "add_files" : buffered ? "browse_file" : "browse_files")}</Button>
          </Box>
          {primary(t(encrypt ? "continue_password" : "continue_file"), onFileContinue, !files.length)}
        </>}
        {step === 1 && !done && <>
          <Box>{fileRows(false)}</Box>
          {method === "publicKey" ? <>
            <KeyFields {...{ direction, publicKey, privateKey, onPublicKey, onPrivateKey, publicKeyError, privateKeyError }} disabled={busy} />
            {encrypt && <KeyPairGeneration onUsePrivateKey={onPrivateKey} />}
          </> : <>
            <TextField inputRef={passwordInput} id={`${direction}-password`} label={t("password")} required fullWidth disabled={busy}
              type={visible ? "text" : "password"} value={password || ""} onChange={event => onPassword(event.target.value)}
              error={!!passwordError} helperText={passwordError ? t(encrypt ? "short_password" : "wrong_password") : encrypt ? t("password_tip") : " "}
              inputProps={{ autoComplete: encrypt ? "new-password" : "off", autoCapitalize: "none", spellCheck: false }} InputProps={{ endAdornment:
                <InputAdornment position="end"><Tooltip title={t(visible ? "hide_password" : "show_password")}>
                  <IconButton disabled={busy} aria-label={t(visible ? "hide_password" : "show_password")} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <VisibilityOff /> : <Visibility />}</IconButton>
                </Tooltip></InputAdornment> }} />
            {passwordError && errorFile && files.length > 1 && <Typography variant="body2" color="error">{errorFile}</Typography>}
            {encrypt && <>
              {!!password && <Typography variant="body2" color="text.secondary">{t("password_strength")}: {passwordStrengthCheck(password)[0]}</Typography>}
              <Stack spacing={1} direction={{ xs: "column", sm: "row" }}>
                <Select size="small" value={generation} onChange={event => setGeneration(event.target.value)} disabled={busy} inputProps={{ "aria-label": t("generate_password") }} sx={{ flex: 1 }}>
                  <MenuItem value="random">{t("random_password")}</MenuItem><MenuItem value="words">{t("word_password")}</MenuItem>
                </Select>
                <Button variant="outlined" disabled={busy} onClick={generate}>{t("make_password")}</Button>
              </Stack>
              {generateError && <Alert severity="error">{t("generate_failed")}</Alert>}
              <Alert severity="info"><AlertTitle>{t("password_keep_title")}</AlertTitle>{t("password_keep")}</Alert>
              {!!password && <Box><CopyButton value={password} secret label={t("copy_password")} success={t("password_copied")} disabled={busy} /></Box>}
            </>}
          </>}
          {encrypt && <Box><Button disabled={busy} onClick={() => onMethod(method === "publicKey" ? "secretKey" : "publicKey")} aria-expanded={method === "publicKey"}>{t(method === "publicKey" ? "use_password" : "advanced_keys")}</Button></Box>}
          {actions(credentialLabel, onCredentialContinue, !fieldFilled)}
        </>}
        {step === 2 && !done && <>
          {fileRows(false)}
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}><Typography color="text.secondary">{t("selected_method")}</Typography><Typography>{t(method === "publicKey" ? "key_method" : "password_method")}</Typography></Box>
          {actions(executeLabel, onExecute, !fieldFilled || !files.length)}
        </>}
        {busy && <Box role="status" aria-live="polite"><Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size={22} /><Typography>{generating ? t("make_password") : linkPending ? t("create_shareable_link") : status}</Typography>
        </Stack>{processing && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{files.length > 1 ? `${Math.min(currentFile + 1, files.length)} / ${files.length} · ` : ""}{t("working_hint")}</Typography>}</Box>}
        {processing && onCancel && <Button color="error" onClick={() => setCancelOpen(true)}>{t("cancel_operation")}</Button>}
        {done && <>
          {fileRows(false)}
          {buffered && primary(t(encrypt ? "download_encrypted" : "download_decrypted"), () => { onDownload(); setDownloadRequested(true); }, false, <DownloadOutlined />)}
          {downloadRequested && <Alert severity="info">{t("download_requested")}</Alert>}
          {!buffered && <Typography color="text.secondary" role="status">{t("download_check")}</Typography>}
          {encrypt && method !== "publicKey" && <>
            <Alert severity="info"><AlertTitle>{t("password_keep_title")}</AlertTitle>{t("password_keep")}<br />{t("password_share")}</Alert>
            <Box><CopyButton value={password} secret label={t("copy_password")} success={t("password_copied")} /></Box>
          </>}
          {encrypt && method === "publicKey" && <>
            <Alert severity="info">{t("after_enc_note_one")}</Alert>
            <Button variant="outlined" disabled={linkPending} onClick={async () => { setLinkPending(true); setLinkError(false); try { await onCreateLink(); } catch { setLinkError(true); } finally { setLinkPending(false); } }}>{t("create_shareable_link")}</Button>
            {linkError && <Alert severity="error">{t("invalid_keys_input")}</Alert>}
            {shareableLink && <><TextField label={t("public_link")} value={shareableLink} InputProps={{ readOnly: true }} fullWidth helperText={t("create_shareable_link_note")} />
              <Box><CopyButton value={shareableLink} label={t("copy_link")} success={t("create_shareable_link_copied")} /></Box></>}
          </>}
          <Divider /><Button onClick={onReset} variant={buffered ? "outlined" : "contained"}>{t("start_again")}</Button>
        </>}
        {operationError && !done && <Button variant="outlined" disabled={busy} onClick={onReset}>{t("start_again")}</Button>}
      </Stack>
    </Paper>
    <FileInfoDialog file={selectedInfo} display={!!selectedInfo} onClose={() => setSelectedInfo(null)} />
    <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} aria-labelledby={`${direction}-cancel-title`}>
      <DialogTitle id={`${direction}-cancel-title`}>{t("cancel_title")}</DialogTitle>
      <DialogContent><DialogContentText>{t("cancel_description")}</DialogContentText></DialogContent>
      <DialogActions><Button onClick={() => setCancelOpen(false)}>{t("keep_processing")}</Button><Button color="error" onClick={() => { onCancel(); setCancelOpen(false); }}>{t("cancel_operation")}</Button></DialogActions>
    </Dialog>
  </Box>;
}
