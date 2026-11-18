# CommandOS — Business Command Center

A new dashboard for detailed business instructions sent to a Paperclip-managed workforce, with OSIRIS intelligence available to selected agents through MCP. This is separate from the prior HR-bot and OSIRIS projects.

## Features
- Detailed 20,000-character command composer and editable prompt templates.
- Category, priority, agent assignment, and execution-permission settings.
- Server-side Paperclip connection and documented REST API calls.
- Live Paperclip agent roster, task list, and approval readout.
- Real Paperclip issue creation; no fake local dispatch.
- OSIRIS MCP setup guide for selected Paperclip agents.
- Honest disconnected states and explicit errors.
- Recommend-only default. No purchases, payments, outbound emails, publishing, or commitments.

## Run in GitHub Codespaces
1. Open this repository in GitHub.
2. Choose Code → Codespaces → Create codespace on feature/commandos-paperclip-osiris.
3. In the terminal run:
   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```
4. Open forwarded port 5173 in the Ports tab.
5. Add these server settings to .env:
   ```env
   PAPERCLIP_BASE_URL=https://your-paperclip-host
   PAPERCLIP_COMPANY_ID=your-company-id
   PAPERCLIP_API_TOKEN=your-board-api-token
   ```
6. Restart the dev command and use Connections → Test Paperclip connection.

Never commit .env or credentials. The API token stays server-side. Remote Paperclip connections must use HTTPS; localhost HTTP is allowed for development.

## Paperclip API routes used
- GET /api/companies
- GET /api/companies/{companyId}/agents
- GET /api/companies/{companyId}/issues
- GET /api/companies/{companyId}/approvals
- POST /api/companies/{companyId}/issues

## OSIRIS
CommandOS can test the OSIRIS MCP Streamable HTTP handshake and list tools at https://osirisai.live/api/mcp. In Paperclip, add that URL under Connectors as a custom MCP server and grant it only to selected agents. Public intelligence tools need no OSIRIS key. OI prediction tools require X-OI-Provider and X-OI-Key connection headers; the provider key is billed by its provider. Verify tool discovery in Paperclip before assigning research. A successful MCP handshake proves tool discovery only, not that a Paperclip agent has used the tools or returned findings.

## Safety
Recommend-only is the default. This initial version displays approvals but does not approve them or execute external side effects. Browser code never receives the Paperclip API token.

## Verification
Run npm test and npm run build in Codespaces. The GitHub commit does not establish that your Paperclip instance or OSIRIS MCP tools are connected; configure and test those in your own environment.
