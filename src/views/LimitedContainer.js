import { Box } from "@mui/material";
import NavAppBar from "../components/AppBar";
import Hero from "../components/Hero";
import LimitedPanels from "../components/limited/LimitedPanels";
import Footer from "../components/Footer";

const LimitedContainer = () => {

  return (
    <Box sx={{
        backgroundColor: (theme) => theme.palette.custom?.alabaster?.main || "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}>
      <NavAppBar />
      <Hero />
      <LimitedPanels />
      <Footer />
    </Box>
  );
};

export default LimitedContainer;
