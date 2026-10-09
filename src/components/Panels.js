import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Box, Container, Tab, Tabs, Typography } from "@mui/material";
import { getTranslations as t } from "../../locales";
import { useWorkflow } from "./WorkflowContext";
import EncryptionPanel from "./EncryptionPanel";
import DecryptionPanel from "./DecryptionPanel";
import LimitedEncryptionPanel from "./limited/LimitedEncryptionPanel";
import LimitedDecryptionPanel from "./limited/LimitedDecryptionPanel";
export default function Panels({ buffered = false }) {
  const router = useRouter();
  const [value, setValue] = useState(0);
  const { busy } = useWorkflow();
  useEffect(() => {
    setValue(router.query.tab === "decryption" ? 1 : 0);
  }, [router.query.tab]);
  const change = (event, next) => {
    if (busy) return;
    setValue(next);
    // Preserve public-key invitations when changing direction.
    router.replace({ pathname: router.pathname, query: { ...router.query, tab: next === 1 ? "decryption" : "encryption" } }, undefined, { shallow: true });
  };
  const Encrypt = buffered ? LimitedEncryptionPanel : EncryptionPanel;
  const Decrypt = buffered ? LimitedDecryptionPanel : DecryptionPanel;
  return <Container component="main" maxWidth="sm" sx={{ pb: 2 }}>
    <Tabs value={value} onChange={change} variant="fullWidth" aria-label={t("selected_method")} sx={{ bgcolor: "action.hover", borderRadius: 3, p: .75, minHeight: 54, "& .MuiTabs-indicator": { display: "none" }, "& .Mui-selected": { bgcolor: "background.paper", boxShadow: "0 2px 6px rgba(0,0,0,.06)" } }}>
      <Tab id="simple-tab-0" aria-controls="simple-tabpanel-0" disabled={busy} label={t("encrypt_tab")} sx={{ borderRadius: 2, fontWeight: 600, textTransform: "none", minHeight: 44 }} />
      <Tab id="simple-tab-1" aria-controls="simple-tabpanel-1" disabled={busy} label={t("decrypt_tab")} sx={{ borderRadius: 2, fontWeight: 600, textTransform: "none", minHeight: 44 }} />
    </Tabs>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, mb: 3 }}>{busy ? t("busy_navigation") : t(value === 0 ? "encrypt_hint" : "decrypt_hint")}</Typography>
    <Box role="tabpanel" hidden={value !== 0} id="simple-tabpanel-0" aria-labelledby="simple-tab-0"><Encrypt active={value === 0} /></Box>
    <Box role="tabpanel" hidden={value !== 1} id="simple-tabpanel-1" aria-labelledby="simple-tab-1"><Decrypt active={value === 1} /></Box>
  </Container>;
}
