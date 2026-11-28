import sodium from "libsodium-wrappers-sumo";
import * as config from "./config.ts";
import { installWorker, type WorkerScope } from "./worker.ts";

installWorker(self as unknown as WorkerScope, sodium, config);

import { installOffline } from "./offline.ts";
declare const __PRECACHE__: Record<string, string>;
declare const __CACHE_VERSION__: string;
installOffline(self as unknown as ServiceWorkerGlobalScope, __PRECACHE__, __CACHE_VERSION__);
