const { installWorker } = require("./worker");

installWorker(self, require("libsodium-wrappers-sumo"), require("./config"));
