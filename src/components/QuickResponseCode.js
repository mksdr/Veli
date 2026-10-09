import { useId, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { QRCodeSVG } from "qrcode.react";
import { getTranslations as t } from "../../locales";
import CopyButton from "./ui/CopyButton";
export default function QuickResponseCode({ publicKey }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/?tab=encryption&publicKey=${encodeURIComponent(publicKey)}`;
  return <>
    <Button onClick={() => setOpen(true)} variant="outlined">{t("generate_qr_code")}</Button>
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth aria-labelledby={id}>
      <DialogTitle id={id}>{t("share_public_key")}</DialogTitle>
      <DialogContent><Stack spacing={2}>
        <Box sx={{ display: "flex", justifyContent: "center", p: 2, bgcolor: "#fff", borderRadius: 3 }}><QRCodeSVG value={url} size={200} marginSize={4} title={t("generate_qr_code")} /></Box>
        <Typography>{t("qr_code_note_one")}</Typography><Typography variant="body2" color="text.secondary">{t("qr_code_note_two")}</Typography>
        <TextField label={t("public_link")} value={url} fullWidth InputProps={{ readOnly: true }} />
        <Box><CopyButton value={url} label={t("copy_link")} success={t("create_shareable_link_copied")} /></Box>
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>{t("close")}</Button></DialogActions>
    </Dialog>
  </>;
}
