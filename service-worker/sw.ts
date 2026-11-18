import sodium from "libsodium-wrappers-sumo";
import * as config from "./config.ts";
import { installWorker, type WorkerScope } from "./worker.ts";

installWorker(self as unknown as WorkerScope, sodium, config);
