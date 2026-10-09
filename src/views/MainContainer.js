import { makeStyles } from "@mui/styles";
import NavAppBar from "../components/AppBar";
import Hero from "../components/Hero";
import Panels from "../components/Panels";
import Footer from "../components/Footer";



const MainContainer = () => {

  return (
    <div sx={{
        backgroundColor: (theme) => theme.palette.custom?.alabaster?.main || "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}>
      <NavAppBar />
      <Hero />
      <Panels />
      <Footer />
    </div>
  );
};

export default MainContainer;
