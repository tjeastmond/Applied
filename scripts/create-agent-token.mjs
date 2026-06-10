/* global process */

import { randomBytes } from "node:crypto";

const token = randomBytes(32).toString("base64url");

process.stdout.write(`AGENT_API_TOKEN=${token}\n`);
