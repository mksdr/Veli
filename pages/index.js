import useFileProcessingSupport from "../src/utils/useFileProcessingSupport";
import MainContainer from "../src/views/MainContainer";
import LimitedContainer from "../src/views/LimitedContainer";
import { ThemeProvider } from "@mui/styles";
import { Theme } from "../src/config/Theme";
import LoadingCom from "../src/components/Loading";

const Home = () => {
  const { loading, streaming } = useFileProcessingSupport();

  return (<>
    {/* // <ThemeProvider theme={Theme}> */}
      <LoadingCom open={loading} />
      {!loading &&
        (streaming ? <MainContainer /> : <LimitedContainer />)}
    {/* // </ThemeProvider> */}
  </>);
};

export default Home;
