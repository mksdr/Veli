/* eslint-disable @next/next/no-sync-scripts */
import Head from "next/head";
import { getTranslations as t } from "../locales";
import "../public/assets/styles/style.css";
import { AppearanceProvider } from "../src/config/Theme";
import { LocaleProvider, useLocale } from "../locales";
import { WorkflowProvider } from "../src/components/WorkflowContext";

function AppContent({ Component, pageProps }) {
  const { locale } = useLocale();
  return (
    <>
      <Head>
        <title>
          {`Veli - ${t("sub_title")}`}
        </title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="16x16 24x24 32x32 48x48 64x64 128x128 256x256" />

        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Encrypt and Decrypt files securely in your browser."
        />
        <meta
          name="Keywords"
          content="encrypt decrypt encryption file-encryption javascript client-side serverless decryption xchcha20 argon2id encryption-decryption webcrypto crypto browser in-browser"
        />
        <meta
          name="theme-color"
          content="#fafafa"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#1c1c1c"
          media="(prefers-color-scheme: dark)"
        />
      </Head>
      <AppearanceProvider>
        <WorkflowProvider key={locale}><Component {...pageProps} /></WorkflowProvider>
      </AppearanceProvider>
    </>
  );
}

export default function MyApp(props) {
  return <LocaleProvider><AppContent {...props} /></LocaleProvider>;
}
