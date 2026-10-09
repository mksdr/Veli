const { installWorker } = require("./worker");

installWorker(self, require("libsodium-wrappers"), require("./config"));
