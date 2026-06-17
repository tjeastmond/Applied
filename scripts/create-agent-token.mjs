/* global process */

import { randomBytes } from "node:crypto";

const token = randomBytes(32).toString("base64url");

process.stderr.write("Bootstrap env token only. For revocable named tokens, use Admin → Agent API Tokens.\n");
process.stdout.write(`AGENT_API_TOKEN=${token}\n`);
