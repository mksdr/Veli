function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give Safari time to consume the URL before releasing the Blob.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

module.exports = { downloadBlob };
