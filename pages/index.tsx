import useFileProcessingSupport from "../src/utils/useFileProcessingSupport";
import MainContainer from "../src/views/MainContainer";

const Home = () => {
  const streaming = useFileProcessingSupport();
  return <MainContainer streaming={streaming} />;
};

export default Home;
