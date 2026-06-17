export function isAgentEnvTokenConfigured(): boolean {
  const token = process.env.AGENT_API_TOKEN?.trim();
  return Boolean(token);
}
