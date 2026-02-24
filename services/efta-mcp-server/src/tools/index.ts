import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerEntityTools } from './entities.js';
import { registerDocumentTools } from './documents.js';
import { registerEventTools } from './events.js';
import { registerConnectionTools } from './connections.js';
import { registerRedactionTools } from './redactions.js';
import { registerSightingTools } from './sightings.js';
import { registerSuspectTools } from './suspects.js';
import { registerLinkTools } from './links.js';
import { registerUtilityTools } from './utility.js';
import { registerCorpusTools } from './corpus.js';
import { registerPublicEventTools } from './public-events.js';

export function registerTools(server: McpServer) {
  registerEntityTools(server);
  registerDocumentTools(server);
  registerEventTools(server);
  registerConnectionTools(server);
  registerRedactionTools(server);
  registerSightingTools(server);
  registerSuspectTools(server);
  registerLinkTools(server);
  registerUtilityTools(server);
  registerCorpusTools(server);
  registerPublicEventTools(server);
}
