import { useState } from "react";

import Alert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import Collapse from "@mui/material/Collapse";
import CloseIcon from "@mui/icons-material/Close";
import { getTranslations as t} from "../../../locales";


const LimitedAlert = () => {

    const [alertOpen, setAlertOpen] = useState(true);


    return (
        <Collapse in={alertOpen} style={{ marginTop: 5 }}>
        <Alert
          severity="info"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                setAlertOpen(false);
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {t('buffered_mode_notice')}
        </Alert>
      </Collapse>
    )
}

export default LimitedAlert
