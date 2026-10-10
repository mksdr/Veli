/* eslint-disable @next/next/no-html-link-for-pages */
import fs from "fs";
import path from "path";
import { marked } from "marked";
import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import AppBar from "@mui/material/AppBar";
import CssBaseline from "@mui/material/CssBaseline";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Hidden from "@mui/material/Hidden";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuIcon from "@mui/icons-material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { makeStyles, useTheme } from "@mui/styles";
import Link from "next/link";
import Container from "@mui/material/Container";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import GitHubIcon from "@mui/icons-material/GitHub";
import Footer from "../src/components/Footer";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import StarsIcon from "@mui/icons-material/Stars";
import GetAppIcon from "@mui/icons-material/GetApp";
import EmojiObjectsIcon from "@mui/icons-material/EmojiObjects";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import LiveHelpIcon from "@mui/icons-material/LiveHelp";
import HistoryIcon from "@mui/icons-material/History";
import prism from "prismjs";
import Settings from "../src/components/Settings";
import locales from "../locales/locales";
import { getTranslations as t, useLocale } from "../locales";
const drawerWidth = 240;

marked.setOptions({
  highlight: function (code, lang) {
    if (prism.languages[lang]) {
      return prism.highlight(code, prism.languages[lang], lang);
    } else {
      return code;
    }
  },
});

const useStyles = makeStyles((theme) => ({
  root: {
    backgroundColor: theme.palette.custom.alabaster.main,
    minHeight: "100vh",
  },
  drawer: {
    [theme.breakpoints.down("lg")]: {
      display: "none",
    },
  },
  appBar: {
    backgroundColor: theme.palette.custom.alabaster.main,
    [theme.breakpoints.up("sm")]: {
      width: "100%",
      marginLeft: drawerWidth,
      zIndex: theme.zIndex.drawer - 1,
    },
  },

  logo: {
    flexGrow: 1,
    marginTop: 5,
  },
  button: {
    textTransform: "none",
    color: theme.palette.custom.diamondBlack.main,
  },

  menuButton: {
    marginRight: theme.spacing(2),
    [theme.breakpoints.up("xl")]: {
      display: "none",
    },
  },
  // necessary for content to be below app bar
  toolbar: theme.mixins.toolbar,
  drawerPaper: {
    width: drawerWidth,
  },
  content: {
    padding: theme.spacing(3),
    marginTop: "20px",

    "& h1": {
      marginTop: 20,
      color: theme.palette.custom.mineShaft.main,
      borderRadius: "8px",
      paddingBottom: 15,
      "& a": {
        textDecoration: "none",
        fontWeight: "bold",
        fontSize: 40,
        letterSpacing: "1px",
        borderBottom: "1px solid #000",
      },
    },

    "& h2": {
      color: theme.palette.custom.mineShaft.main,
      fontSize: "26px",
      paddingTop: 20,
      paddingBottom: 20,
      fontWeight: "700",
    },

    "& h3": {
      color: theme.palette.custom.mineShaft.main,
      fontSize: "24px",
      paddingTop: 20,
      paddingBottom: 20,
      fontWeight: "700",
    },

    "& a": {
      color: theme.palette.custom.mineShaft.main,
    },

    "& :not(pre) > code": {
      backgroundColor: theme.palette.custom.gallery.main,
      color: theme.palette.text.primary,
      wordWrap: "break-word",
      fontFamily: "inherit",
      paddingRight: 7,
      paddingLeft: 7,
      borderRadius: "3px",
    },

    "& p": {
      fontSize: "17px",
      color: theme.palette.custom.mineShaft.main,
      lineHeight: 2,
    },

    "& li": {
      padding: 2.5,
      fontSize: "18px",
      color: theme.palette.custom.mineShaft.main,
      "& a": {
        textDecoration: "none",
        letterSpacing: "0.5px",
        borderBottom: "1px solid #000",
      },
    },

    "& hr": {
      backgroundColor: theme.palette.custom.mercury.main,
      border: "none",
      height: "1.5px",
      marginTop: 20,
      marginBottom: 30,
    },

    "& ul": {
      paddingLeft: 25,
      paddingBottom: 15,
      fontSize: "16px",
    },

    "& ol": {
      paddingLeft: 25,
      paddingBottom: 15,
      fontSize: "16px",
    },

    "& pre": {
      // Match the global Prism Nord token palette in both appearance modes.
      background: "#2E3440",
      color: "#f8f8f2",
      fontFamily: '"Fira Code", Consolas, Monaco, monospace',
      padding: "13px",
      marginTop: "-5px",
      marginBottom: "20px",
      lineHeight: "1.3",
      fontSize: "14px",
      borderRadius: "3px",
      overflow: "auto",
      "& code": {
        color: "inherit",
        background: "none",
        fontFamily: "inherit",
      },
      "& .token.comment, & .token.prolog, & .token.doctype, & .token.cdata": {
        color: "#aebbc9",
      },
      "& .token.number": {
        color: "#c6a0bf",
      },
    },

    "& blockquote": {
      backgroundColor: theme.palette.custom.gallery.main,
      marginTop: "15px",
      color: theme.palette.text.secondary,
      borderLeft: `5px solid ${theme.palette.mode === "dark" ? "#58677a" : "#c8ccd0"}`,
      marginBottom: 20,
      "& p": {
        color: "inherit",
        padding: 10,
      },
    },
  },
}));

export default function About(props) {
  const classes = useStyles();
  const theme = useTheme();
  const { locale } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [docContent, setDocContent] = useState("");

  useEffect(() => {
    setDocContent((props.docs.find(doc => doc.lang === locale) || props.docs[0]).content);
  }, [props.docs, locale]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleClose = () => {
    mobileOpen ? setMobileOpen(false) : null;
  };

  const drawer = (
    <div>
      <div className={classes.toolbar} />

      <List>
        <ListItem button component="a">
          <ListItemText primary="Veli Documentation" />
        </ListItem>
      </List>

      <Divider />
      <List>
        {[
          { name: t("introduction"), icon: <BookmarkBorderIcon /> },
          { name: t("features"), icon: <StarsIcon /> },
          { name: t("installation"), icon: <GetAppIcon /> },
          { name: t("usage"), icon: <EmojiObjectsIcon /> },
          { name: t("limitations"), icon: <ErrorOutlineIcon /> },
          { name: t("best_practices"), icon: <VerifiedUserIcon /> },
          { name: t("faq"), icon: <LiveHelpIcon /> },
          { name: t("technical_details"), icon: <MenuBookIcon /> },
          { name: t("changelog"), icon: <HistoryIcon /> },
        ].map((text, index) => (
          <div onClick={handleClose} key={index}>
            <Link href={"#" + text.name.toLowerCase()} passHref>
              <ListItem button>
                <ListItemIcon>{text.icon}</ListItemIcon>
                <ListItemText primary={text.name} />
              </ListItem>
            </Link>
          </div>
        ))}
      </List>
    </div>
  );
  return (
    // <ThemeProvider theme={Theme}>
      <div className={classes.root}>
        <CssBaseline />

        <AppBar
          color="transparent"
          position="fixed"
          className={classes.appBar}
          elevation={0}
        >
          <Container maxWidth="lg">
            <Toolbar>

              <Typography variant="h6" className={classes.logo}>
                <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Box component="img" src="/assets/icons/veli.svg" alt="" aria-hidden="true" sx={{ width: 32, height: 32, flexShrink: 0 }} />
                  Veli
                </a>
              </Typography>

              <Button color="inherit" href="/" className={classes.button}>
                {t('home')}
              </Button>

              <IconButton
                aria-label="GitHub"
                href="https://github.com/mksdr/Veli"
                target="_blank"
                rel="noopener"
              >
                <GitHubIcon />
              </IconButton>

              <Settings />
            </Toolbar>
          </Container>
        </AppBar>

        
        <main className={classes.content}>
          <Container maxWidth="lg">
            <div className={classes.toolbar} />

            <div dangerouslySetInnerHTML={{ __html: marked(docContent) }}></div>
            <div
              dangerouslySetInnerHTML={{ __html: marked(props.changelog) }}
            ></div>
          </Container>
        </main>

        <Footer />
      </div>
  );
}

About.propTypes = {
  /**
   * Injected by the documentation to work in an iframe.
   * You won't need it on your project.
   */
  window: PropTypes.func,
};

export async function getStaticProps() {
  // Get files from the posts dir

  let docs = [];

  {
    Object.entries(locales).map(([code, name]) => {
      let docFilePath = `locales/${code}/docs.md`;
      let docFile;
      try {
        docFile = fs.readFileSync(
          path.join(docFilePath),
          "utf-8"
        );
      } catch (error) {
        docFile = fs.readFileSync(
          path.join(`locales/en_US/docs.md`),
          "utf-8"
        );
      }
      
      let docStructure = { lang: code, content: docFile };
      docs.push(docStructure);
    });
  }

  const changelog = fs.readFileSync("CHANGELOG.md", "utf-8");

  return {
    props: {
      docs: docs,
      changelog: changelog,
    },
  };
}
