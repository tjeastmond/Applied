/* global process */

import { randomBytes } from "node:crypto";

const token = randomBytes(32).toString("base64url");

process.stdout.write(`APP_ACCESS_TOKEN=${token}\n`);
