/* eslint-disable @next/next/no-html-link-for-pages */
import fs from "fs";
import path from "path";
import { marked } from "marked";
import AppBar from "@mui/material/AppBar";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import GitHubIcon from "@mui/icons-material/GitHub";
import Footer from "../src/components/Footer";
import prism from "prismjs";
import Settings from "../src/components/Settings";
import locales from "../locales/locales";
import { getTranslations as t, useLocale } from "../locales";

marked.setOptions({
  highlight: function (code, lang) {
    if (prism.languages[lang]) {
      return prism.highlight(code, prism.languages[lang], lang);
    } else {
      return code;
    }
  },
});

// Explicit pixel lengths preserve the original document layout under sx.
const contentSx = (theme) => ({
  padding: theme.spacing(3),
  marginTop: "20px",

  "& h1": {
    marginTop: "20px",
    color: theme.palette.custom.mineShaft.main,
    borderRadius: "8px",
    paddingBottom: "15px",
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
    paddingTop: "20px",
    paddingBottom: "20px",
    fontWeight: "700",
  },

  "& h3": {
    color: theme.palette.custom.mineShaft.main,
    fontSize: "24px",
    paddingTop: "20px",
    paddingBottom: "20px",
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
    paddingRight: "7px",
    paddingLeft: "7px",
    borderRadius: "3px",
  },

  "& p": {
    fontSize: "17px",
    color: theme.palette.custom.mineShaft.main,
    lineHeight: 2,
  },

  "& li": {
    padding: "2.5px",
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
    marginTop: "20px",
    marginBottom: "30px",
  },

  "& ul": {
    paddingLeft: "25px",
    paddingBottom: "15px",
    fontSize: "16px",
  },

  "& ol": {
    paddingLeft: "25px",
    paddingBottom: "15px",
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
    marginBottom: "20px",
    "& p": {
      color: "inherit",
      padding: "10px",
    },
  },
});

export default function About(props) {
  const { locale } = useLocale();
  const docContent = (props.docs.find(doc => doc.lang === locale) || props.docs[0]).content;

  return (
    <Box sx={(theme) => ({ backgroundColor: theme.palette.custom.alabaster.main, minHeight: "100vh" })}>
      <AppBar
        color="transparent"
        position="fixed"
        sx={(theme) => ({
          backgroundColor: theme.palette.custom.alabaster.main,
          [theme.breakpoints.up("sm")]: {
            width: "100%",
            zIndex: theme.zIndex.drawer - 1,
          },
        })}
        elevation={0}
      >
        <Container maxWidth="lg">
          <Toolbar>

            <Typography variant="h6" sx={{ flexGrow: 1, marginTop: "5px" }}>
              <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Box component="img" src="/assets/icons/veli.svg" alt="" aria-hidden="true" sx={{ width: 32, height: 32, flexShrink: 0 }} />
                Veli
              </a>
            </Typography>

            <Button color="inherit" href="/" sx={(theme) => ({ textTransform: "none", color: theme.palette.custom.diamondBlack.main })}>
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


      <Box component="main" sx={contentSx}>
        <Container maxWidth="lg">
          <Box sx={(theme) => theme.mixins.toolbar} />

          <div dangerouslySetInnerHTML={{ __html: marked(docContent) }}></div>
          <div
            dangerouslySetInnerHTML={{ __html: marked(props.changelog) }}
          ></div>
        </Container>
      </Box>

      <Footer />
    </Box>
  );
}

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
