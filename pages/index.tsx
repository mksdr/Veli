import useFileProcessingSupport from "../src/utils/useFileProcessingSupport";
import MainContainer from "../src/views/MainContainer";
import LimitedContainer from "../src/views/LimitedContainer";
import LoadingCom from "../src/components/Loading";

const Home = () => {
  const { loading, streaming } = useFileProcessingSupport();

  return (<>
    <LoadingCom open={loading} />
    {!loading &&
      (streaming ? <MainContainer /> : <LimitedContainer />)}
  </>);
};

export default Home;
