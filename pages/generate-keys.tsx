import NavAppBar from "../src/components/AppBar";
import Footer from "../src/components/Footer";
import Hero from "../src/components/Hero";
import Container from "@mui/material/Container";
import KeyPairGeneration from "../src/components/KeyPairGeneration";
import Box from "@mui/material/Box";

const Generate = () => {
  return (
    <Box sx={(theme) => ({
      backgroundColor: theme.palette.custom?.alabaster?.main,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
    })}>
      <NavAppBar />
      <Hero />
      <Container maxWidth={false} sx={{ maxWidth: "768px" }}>
        <KeyPairGeneration opened={true} />
      </Container>

      <Footer />
    </Box>
  );
};

export default Generate;
