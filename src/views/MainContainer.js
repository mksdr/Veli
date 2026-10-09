import { Box } from "@mui/material";
import NavAppBar from "../components/AppBar";
import Hero from "../components/Hero";
import Panels from "../components/Panels";
import Footer from "../components/Footer";



const MainContainer = () => {

  return (
    <Box sx={{
        backgroundColor: (theme) => theme.palette.custom?.alabaster?.main || "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}>
      <NavAppBar />
      <Hero />
      <Panels />
      <Footer />
    </Box>
  );
};

export default MainContainer;
