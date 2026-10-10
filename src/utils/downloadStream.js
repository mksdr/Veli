function downloadStream(url) {
  // Use a navigation request so Chromium routes it through the service worker.
  // Navigate a separate frame to avoid the main page's beforeunload guard.
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.src = url;
  document.body.appendChild(frame);
  // Keep the frame alive for the stream; the caller removes it on reset,
  // cancellation, unmount, or before starting the next download.
  return () => frame.remove();
}

module.exports = { downloadStream };
