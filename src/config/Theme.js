import { getStoredValue, setStoredValue } from "../utils/storage";
import { createTheme } from "@mui/material/styles";
import { FormControlLabel, Switch } from "@mui/material";
import { useState } from "react";
import { getTranslations as t } from "../../locales";
import { border, styled } from '@mui/system';
import { useEffect } from "react";
export const Theme = createTheme({
  palette: {
    primary: {
      main: "#464653",
    },
    custom:{
    white: {
      main: "#ffffff",
    },

    alabaster: {
      main: "#fafafa",
      dark: "#303030",
    },

    mountainMist: {
      main: "#9791a1",
    },
    gallery: {
      main: "#ebebeb",
    },
    cinnabar: {
      main: "#e74c3c",
    },
    denim: {
      main: "#1976d2",
    },
    hawkesBlue: {
      main: "#d0e5f5",
      light: "#e3f2fd",
    },
    mineShaft: {
      main: "#3f3f3f",
    },
    emperor: {
      main: "#525252",
    },
    mercury: {
      main: "#e9e9e9",
      light: "#f3f3f3",
    },
    alto: {
      main: "#e1e1e1",
      light: "#ebebeb",
    },
    flower: {
      main: "#fdecea",
      light: "#fadbd7",
      text: "#611a15",
    },
    cottonBoll: {
      main: "#e8f4fd",
      light: "#c9e1f2",
      text: "#0d3c61",
    },
    diamondBlack : {
      main: "rgba(0, 0, 0, 0.54)",
    }
    }
  },
});



const DarkModeSwitch = styled(Switch)(({ theme }) => ({
  width: 60,
  height: 34,
  padding: 3,
  marginLeft: 20,
  '& .MuiSwitch-switchBase': {
    padding: 4,
    '&.Mui-checked': {
      transform: 'translateX(26px)',
      color: '#000',
      '& + .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: 'black',
      },
      '& .MuiSwitch-thumb': {
        backgroundColor: 'transparent'
      },
      '& .MuiSwitch-thumb:before': {
        content: '"🌙"',
      },
    },
  },
  '& .MuiSwitch-thumb': {
    backgroundColor: 'transparent',
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    position: 'relative',
    '&:before': {
      content: '"☀️"',
      position: 'absolute',
    },
  },
  '& .MuiSwitch-track': {
    borderRadius: 34,
    backgroundColor: 'grey',
    opacity: 1,
  },
}));

export const checkTheme = () => {
  
  if (typeof window !== "undefined") {
    let darkMode = getStoredValue("darkTheme");

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      {
        if(darkMode != 0) {
          setStoredValue("darkTheme", "1");
          document.querySelector("html").classList.add("darkStyle");
        }
      }
    }

    if (darkMode > 0) {
      document.querySelector("html").classList.add("darkStyle");
    }
  }

}

export const DarkModeLight = () => {
  const [checked, setchecked] = useState(false)
  useEffect(() => {
    if (typeof document !== "undefined") {
      setchecked(document.querySelector("html").classList.contains("darkStyle"));
    }
  },[])
  if (typeof window === "undefined") {
    return;
  }
  if (typeof document === "undefined") {
    return;
  }
  const changeTheme = () => {
    {
      if (!checked) {
        setStoredValue("darkTheme", "1");
        document.querySelector("html").classList.add("darkStyle");
        setchecked(true)
      } else {
        setStoredValue("darkTheme", "0");
        document.querySelector("html").classList.remove("darkStyle");
        setchecked(false)
      }
    }
  };

  return (
    <FormControlLabel
      value="darkModeEnabled"
      
      control={<DarkModeSwitch checked={checked} onChange={()=>{changeTheme()}} />}
    />
  );
}


export const DarkMode = () => {
  const [checked, setchecked] = useState(typeof document !== "undefined" && document.querySelector("html").classList.contains("darkStyle"))

  const changeTheme = () => {
    {
      if (!checked) {
        setStoredValue("darkTheme", "1");
        document.querySelector("html").classList.add("darkStyle");
        setchecked(true)
      } else {
        setStoredValue("darkTheme", "0");
        document.querySelector("html").classList.remove("darkStyle");
        setchecked(false)
      }
    }
  };

  return (
    <FormControlLabel
      value="darkModeEnabled"
      control={<Switch color="primary" checked={checked}  onChange={() => changeTheme()} />}
      label={t('dark_mode')}
      labelPlacement="start"
    />
  );
};


