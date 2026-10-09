import useFileProcessingSupport from "../src/utils/useFileProcessingSupport";
import MainContainer from "../src/views/MainContainer";
import LimitedContainer from "../src/views/LimitedContainer";
import { ThemeProvider } from "@mui/styles";
import { Theme } from "../src/config/Theme";
import LoadingCom from "../src/components/Loading";
import Panels from "../src/components/Panels";
import Footer from "../src/components/Footer";
import LimitedPanels from "../src/components/limited/LimitedPanels";
const Home = () => {
  const { loading, streaming } = useFileProcessingSupport();

  return (
    <>
      {/* // <ThemeProvider theme={Theme}> */}
      <LoadingCom open={loading} />
      {!loading &&
        (streaming ? (
          <>
            <div
              sx={{
                backgroundColor: (theme) =>
                  theme.palette.custom?.alabaster?.main || "#fff",
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Panels />
              <Footer />
            </div>
          </>
        ) : (
          <>
          <div sx={{
                  backgroundColor: (theme) => theme.palette.custom?.alabaster?.main || "#fff",
                  minHeight: "100vh",
                  display: "flex",
                  flexDirection: "column",
                }}>
                <LimitedPanels />
                <Footer />
              </div>
          </>
        ))}
      {/* // </ThemeProvider> */}
      <div style={{ display: "flex", justifyContent: "center", color: "grey", textAlign: "center" }}>
        <span className="text-center">Hatsmith is running in headless mode.</span>
      </div>
    </>
  );
};

export default Home;
