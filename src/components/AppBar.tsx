import Link from "next/link";
import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import Settings from "./Settings";
import { getTranslations as t } from "../../locales";
import { useWorkflow } from "./WorkflowContext";
export default function NavAppBar() {
  const { busy } = useWorkflow();
  return <AppBar color="transparent" position="static" elevation={0}>
    <Container maxWidth="lg"><Toolbar disableGutters sx={{ gap: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1 }}>
        <Box component="img" src="/assets/icons/veli.svg" alt="" aria-hidden="true" sx={{ width: 32, height: 32, flexShrink: 0 }} /><Typography variant="h6">Veli</Typography>
      </Box>
      <Button component={Link} href="/about/" disabled={busy}>{t("about")}</Button>
      <Settings />
    </Toolbar></Container>
  </AppBar>;
}
