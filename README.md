[![Test](https://img.shields.io/github/actions/workflow/status/agentprobe/x402-mcp-validator/test-on-push.yml)]() ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

# x402-mcp-validator

Validates MCP servers end-to-end: connects via StreamableHTTP or SSE, discovers capabilities, probes each tool for x402 payment requirements, validates payment options against the x402 spec, measures latency, and returns a structured snapshot with 12 boolean categories and 13 entry fields.

## Quickstart

```bash
git clone https://github.com/agentprobe/x402-mcp-validator.git
cd x402-mcp-validator
npm i
```

```javascript
import { McpServerValidator } from 'x402-mcp-validator'

const { status, findings, categories, entries } = await McpServerValidator.start( {
    endpoint: 'https://your-mcp-server.example.com/mcp',
    timeout: 15000
} )
```

## Features

- Connects to MCP servers via StreamableHTTP with SSE fallback
- Discovers tools, resources, prompts, and capabilities
- Probes each tool for x402 payment requirements (HTTP 402 / JSON-RPC -32402)
- Validates payment options: scheme, network, amount, asset, payTo, checksums
- Classifies 12 boolean categories (reachable, MCP, x402, EVM, Solana, tasks, mcpApps)
- Measures ping and listTools latency
- Compares two snapshots and produces a structured diff
- Returns empty snapshot with all-false categories on connection failure

## Architecture

The validation pipeline processes an MCP server in six sequential steps:

```mermaid
flowchart LR
    A[endpoint] --> B[McpConnector.connect]
    B --> C[McpConnector.discover]
    C --> D[CapabilityClassifier.classify]
    D --> E[X402Prober.probe]
    E --> F[PaymentValidator.validate]
    F --> G[SnapshotBuilder.build]
```

## Table of Contents

- [Methods](#methods)
  - [.start()](#start)
  - [.compare()](#compare)
- [Categories](#categories)
- [Entries](#entries)
- [License](#license)

## Methods

All methods are static. Parameters are passed as objects, return values are objects.

### `.start()`

Connects to an MCP server, discovers capabilities, probes for x402 payment support, validates payment requirements, measures latency, and returns a structured snapshot.

**Method**

```
.start( { endpoint, timeout } )
```

| Key | Type | Description | Required |
|-----|------|-------------|----------|
| endpoint | string | URL of the MCP server. Example `'https://server.example.com/mcp'` | Yes |
| timeout | number | Connection timeout in milliseconds. Default `10000` | No |

**Example**

```javascript
import { McpServerValidator } from 'x402-mcp-validator'

const { status, findings, categories, entries } = await McpServerValidator.start( {
    endpoint: 'https://your-mcp-server.example.com/mcp',
    timeout: 15000
} )

console.log( `Status: ${status ? 'PASS' : 'FAIL'}` )
console.log( `Tools: ${entries['tools'].length}` )
console.log( `x402: ${categories['supportsX402']}` )
console.log( `Networks: ${JSON.stringify( entries['x402']['networks'] )}` )
```

**Returns**

```javascript
{ status, findings, categories, entries }
```

| Key | Type | Description |
|-----|------|-------------|
| status | boolean | `true` when no findings were generated |
| findings | array of objects | Structured findings `{ code, severity, location, message }`. `severity` is one of `error`, `warning`, `info` |
| categories | object | 12 boolean flags (see [Categories](#categories)) |
| entries | object | 13 data fields (see [Entries](#entries)) |

---

### `.compare()`

Compares two snapshots produced by `.start()` and returns a structured diff with added, removed, and modified items per section.

**Method**

```
.compare( { before, after } )
```

| Key | Type | Description | Required |
|-----|------|-------------|----------|
| before | object | Snapshot from a previous `.start()` call. Must contain `categories` and `entries` | Yes |
| after | object | Snapshot from a later `.start()` call. Must contain `categories` and `entries` | Yes |

**Example**

```javascript
import { McpServerValidator } from 'x402-mcp-validator'

const before = await McpServerValidator.start( { endpoint: 'https://server.example.com/mcp' } )
const after = await McpServerValidator.start( { endpoint: 'https://server.example.com/mcp' } )

const { status, messages, hasChanges, diff } = McpServerValidator.compare( { before, after } )

console.log( `Changes detected: ${hasChanges}` )
console.log( `Tools added: ${diff['tools']['added'].length}` )
console.log( `Tools removed: ${diff['tools']['removed'].length}` )
```

**Returns**

```javascript
{ status, messages, hasChanges, diff }
```

| Key | Type | Description |
|-----|------|-------------|
| status | boolean | `true` when comparison completed |
| messages | array of strings | Integrity warnings (URL mismatch, timestamp issues) |
| hasChanges | boolean | `true` when any diff section has changes |
| diff | object | Structured diff with sections: `server`, `capabilities`, `tools`, `x402`, `latency`, `categories` |

## Categories

12 boolean flags returned in `categories`:

| Key | Description |
|-----|-------------|
| isReachable | Server responded to HEAD request |
| supportsMcp | MCP handshake completed |
| hasTools | Server exposes at least one tool |
| hasResources | Server exposes at least one resource |
| hasPrompts | Server exposes at least one prompt |
| supportsX402 | At least one tool returned a 402 payment error |
| hasValidPaymentRequirements | At least one payment option passed validation |
| supportsExactScheme | Has payment options with `scheme: 'exact'` |
| supportsEvm | Has payment options with `network: 'eip155:*'` |
| supportsSolana | Has payment options with `network: 'solana:*'` |
| supportsTasks | Server advertises tasks capability |
| supportsMcpApps | Server advertises mcpApps capability |

## Entries

13 data fields returned in `entries`:

| Key | Type | Description |
|-----|------|-------------|
| endpoint | string | MCP server endpoint URL that was validated |
| serverName | string | Server name from MCP handshake |
| serverVersion | string | Server version |
| serverDescription | string | Server description |
| protocolVersion | string | MCP protocol version |
| capabilities | object | Raw server capabilities |
| instructions | string | Server instructions |
| tools | array | Discovered tools with name, description, inputSchema |
| resources | array | Discovered resources |
| prompts | array | Discovered prompts |
| x402 | object | Payment data: `version`, `restrictedCalls`, `paymentOptions`, `networks`, `schemes`, `perTool` |
| latency | object | `ping` and `listTools` in milliseconds |
| timestamp | string | ISO 8601 timestamp of validation |

## Validation Codes

Every validator in the AgentProbe fleet emits findings as `{ code, severity, location, message }`
objects. `code` is a globally-unique `PREFIX-NNN` string; `severity` is one of `error`, `warning`,
`info`. The two generic prefixes `VAL` and `CON` are de-collided across the fleet by disjoint number
bands — this validator owns the `VAL-2xx` and `CON-2xx` bands.

### VAL — Input Validation (`VAL-2xx`)

| Code | Severity | Description |
|------|----------|-------------|
| VAL-201 | error | endpoint: Missing value |
| VAL-202 | error | endpoint: Must be a string |
| VAL-203 | error | endpoint: Must not be empty |
| VAL-204 | error | endpoint: Must be a valid URL |
| VAL-205 | error | timeout: Must be a number |
| VAL-206 | error | timeout: Must be greater than 0 |
| VAL-210 | error | before: Missing value |
| VAL-211 | error | before: Must be an object |
| VAL-212 | error | before: Missing categories or entries |
| VAL-213 | error | after: Missing value |
| VAL-214 | error | after: Must be an object |
| VAL-215 | error | after: Missing categories or entries |

### CON — MCP Connection (`CON-2xx`)

| Code | Severity | Description |
|------|----------|-------------|
| CON-201 | error | endpoint: Server is not reachable |
| CON-204 | error | mcp: Initialize handshake failed |
| CON-208 | warning | tools/list: Request failed |
| CON-209 | warning | tools/list: Invalid response format |
| CON-210 | info | resources/list: Request failed |
| CON-211 | info | prompts/list: Request failed |

### PAY — Payment Validation

| Code | Severity | Description |
|------|----------|-------------|
| PAY-001 | error | restrictedCalls: PaymentRequired data is missing |
| PAY-002 | error | restrictedCalls: PaymentRequired is not an object |
| PAY-010 | error | x402Version: Missing required field |
| PAY-011 | error | x402Version: Must be a number |
| PAY-012 | error | x402Version: Expected 2 |
| PAY-020 | error | resource: Must be a string or object |
| PAY-021 | error | resource: Must not be empty / resource.url: Missing value |
| PAY-022 | error | resource.url: Must be a string |
| PAY-023 | error | resource.url: Invalid URL format |
| PAY-024 | warning | resource: Unknown field |
| PAY-030 | error | accepts: Missing required field |
| PAY-031 | error | accepts: Must be an array |
| PAY-032 | error | accepts: Is empty array |
| PAY-040 | error | scheme: Missing value |
| PAY-041 | error | scheme: Must be a string |
| PAY-042 | error | scheme: Invalid value |
| PAY-050 | error | network: Missing value |
| PAY-051 | error | network: Must be a string |
| PAY-052 | error | network: Unknown prefix |
| PAY-053 | error | network: Missing chain ID after prefix |
| PAY-060 | error | amount: Missing value |
| PAY-061 | error | amount: Must be a string |
| PAY-062 | error | amount: Must be a numeric string |
| PAY-063 | error | amount: Must be positive |
| PAY-070 | error | asset: Missing value |
| PAY-071 | error | asset: Must be a string |
| PAY-072 | error | asset: Invalid EVM address format |
| PAY-080 | error | payTo: Missing value |
| PAY-081 | error | payTo: Must be a string |
| PAY-082 | error | payTo: Invalid EVM address format |
| PAY-083 | warning | payTo: Not checksummed |
| PAY-090 | error | maxTimeoutSeconds: Missing value |
| PAY-091 | error | maxTimeoutSeconds: Must be a number |
| PAY-092 | error | maxTimeoutSeconds: Must be greater than 0 |
| PAY-100 | info | extra: Must be an object |
| PAY-101 | info | extra.name: Missing (recommended for EVM) |
| PAY-102 | info | extra.version: Missing (recommended for EIP-3009) |

### PRB — Probe

| Code | Severity | Description |
|------|----------|-------------|
| PRB-004 | info | probe(tool): Unexpected exception |
| PRB-005 | info | probe: No tools available to probe |
| PRB-006 | warning | probe(tool): x402 detected via legacy error code |
| PRB-007 | info | probe(tool): x402 payment detected (spec-conformant) |
| PRB-008 | warning | probe(tool): x402 detected via HTTP 402 (transport mixing) |
| PRB-009 | warning | probe(tool): x402 detected via non-standard structuredContent |
| PRB-010 | info | probe(tool): x402 API endpoint redirect detected |

### AUTH — OAuth

| Code | Severity | Description |
|------|----------|-------------|
| AUTH-002 | info | Authorization Server Metadata not found or incomplete |
| AUTH-003 | info | PKCE S256 not supported (MCP Spec MUST) |
| AUTH-004 | info | Missing authorization_servers in Protected Resource Metadata |
| AUTH-005 | info | No client registration mechanism available |
| AUTH-010 | info | Server requires authentication |
| AUTH-011 | info | Scopes found |

### CMP — Comparison

The `.compare()` diff engine still emits `CMP-*` codes; its migration to the structured finding
object is tracked separately.

| Code | Severity | Description |
|------|----------|-------------|
| CMP-001 | warning | Snapshots are from different servers |
| CMP-002 | warning | Before snapshot has no timestamp |
| CMP-003 | warning | After snapshot is older than before |

## License

MIT
