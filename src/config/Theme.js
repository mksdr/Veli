import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { CssBaseline, FormControlLabel, Switch } from "@mui/material";
import { getStoredValue, setStoredValue } from "../utils/storage";
import { getTranslations as t } from "../../locales";
const AppearanceContext = createContext({ dark: false, toggle: () => {} });
export const createAppTheme = (dark = false) => {
  const background = dark ? "#121820" : "#f5f7fa";
  const surface = dark ? "#1c2531" : "#ffffff";
  const text = dark ? "#f0f4f8" : "#202b3b";
  const muted = dark ? "#aebbc9" : "#58677a";
  const soft = dark ? "#283443" : "#edf1f6";
  return createTheme({
    palette: {
      mode: dark ? "dark" : "light",
      primary: { main: dark ? "#8ab9ff" : "#2563d4", contrastText: dark ? "#10233e" : "#ffffff" },
      background: { default: background, paper: surface }, text: { primary: text, secondary: muted },
      divider: dark ? "#39485a" : "#dce3ec",
      custom: {
        white: { main: surface }, alabaster: { main: background, dark: background },
        mountainMist: { main: muted }, gallery: { main: soft }, cinnabar: { main: dark ? "#ffb4ab" : "#b42318" },
        denim: { main: dark ? "#8ab9ff" : "#2563d4" }, hawkesBlue: { main: soft, light: soft },
        mineShaft: { main: text }, emperor: { main: text }, mercury: { main: soft, light: soft }, alto: { main: soft, light: soft },
        flower: { main: dark ? "#442923" : "#fff0ed", light: soft, text: dark ? "#ffb4ab" : "#b42318" },
        cottonBoll: { main: soft, light: soft, text: muted }, diamondBlack: { main: muted },
      },
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Roboto", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif',
      h1: { fontSize: "2rem", fontWeight: 700, lineHeight: 1.35, letterSpacing: "-0.025em" },
      h2: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.02em" },
      h6: { fontWeight: 700 }, button: { textTransform: "none", fontWeight: 600, fontSize: "1rem" },
      body1: { lineHeight: 1.65 }, body2: { lineHeight: 1.6 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: {
        root: { minHeight: 44, borderRadius: 12, padding: "10px 18px", whiteSpace: "normal" }, sizeLarge: { minHeight: 52 },
      } },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12 } } },
      MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, fontSize: "0.8125rem" } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 12 }, message: { minWidth: 0, overflowWrap: "anywhere" } } },
      MuiDialog: { styleOverrides: { paper: { backgroundImage: "none" } } },
      MuiCssBaseline: { styleOverrides: { body: { wordBreak: "keep-all", overflowWrap: "anywhere" }, "button:focus-visible, a:focus-visible, [tabindex]:focus-visible": {
        outline: "3px solid", outlineColor: dark ? "#8ab9ff" : "#2563d4", outlineOffset: 3,
      } } },
    },
  });
};
export const Theme = createAppTheme();
export function AppearanceProvider({ children }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const stored = getStoredValue("darkTheme");
      setDark(stored === "1" || (stored !== "0" && media.matches));
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  const toggle = () => setDark(current => {
    setStoredValue("darkTheme", current ? "0" : "1");
    return !current;
  });
  const theme = useMemo(() => createAppTheme(dark), [dark]);
  return <AppearanceContext.Provider value={{ dark, toggle }}><ThemeProvider theme={theme}>
    <CssBaseline />{children}
  </ThemeProvider></AppearanceContext.Provider>;
}
export function DarkMode() {
  const { dark, toggle } = useContext(AppearanceContext);
  return <FormControlLabel label={t("dark_mode")} control={<Switch checked={dark} onChange={toggle} />} />;
}
export const DarkModeLight = DarkMode;
