'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  CircularProgress,
  Button,
  DialogActions
} from '@mui/material';
import { FileUtils } from '../utils/fileUtils';
import { getTranslations as t } from '../../locales';
// interface FileInfoDialogProps {
//   file: File | null;
//   display: boolean;
//   onClose: () => void;
// }

const FileInfoDialog = ({ file, display, onClose }) => {
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setFileInfo(null);
    setError(false);
    if (display && file) {
      setLoading(true);
      FileUtils.getFileInfo(file)
        .then(info => { if (active) setFileInfo(info); })
        .catch(() => { if (active) setError(true); })
        .finally(() => { if (active) setLoading(false); });
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [file, display]);

  return (
    <Dialog aria-labelledby="file-info-title" open={display} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle id="file-info-title">{t('fi_file_info')}</DialogTitle>
      <DialogContent sx={{ overflowWrap: "anywhere" }}>
        {loading ? (
          <CircularProgress />
        ) : fileInfo ? (
          <>
            <Typography><strong>{t('fi_name')}:</strong> {fileInfo.name}</Typography>
            <Typography><strong>{t('fi_size')}:</strong> {fileInfo.size} B</Typography>
            <Typography><strong>{t('fi_type')}:</strong> {fileInfo.type}</Typography>
            <Typography><strong>{t('fi_last_modified')}:</strong> {fileInfo.lastModified.toLocaleString(document.documentElement.lang)}</Typography>

            <Typography variant="h6" sx={{ mt: 2 }}>{t('fi_hashes')}</Typography>
            {fileInfo.hashesUnavailable && <Typography>{t('file_hash_limit')}</Typography>}
            <Typography><strong>SHA-256:</strong> {fileInfo.hashes.sha256 || t("hash_unavailable")}</Typography>
            <Typography><strong>SHA-1:</strong> {fileInfo.hashes.sha1 || t("hash_unavailable")}</Typography>
            <Typography><strong>MD5:</strong> {fileInfo.hashes.md5 || t("hash_unavailable")}</Typography>
          </>
        ) : (
          <Typography>{error ? t('file_info_error') : t("no_file")}</Typography>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>{t("close")}</Button></DialogActions>
    </Dialog>
  );
};

export default FileInfoDialog;
