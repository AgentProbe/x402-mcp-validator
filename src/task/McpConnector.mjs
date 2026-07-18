import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'


class McpConnector {


    static async connect( { endpoint, timeout } ) {
        const findings = []

        const { reachable } = await McpConnector.#checkReachable( { endpoint, timeout } )

        if( !reachable ) {
            findings.push( { code: 'CON-201', severity: 'error', location: 'endpoint', message: 'Server is not reachable' } )

            return { status: false, findings, client: null, serverInfo: null }
        }

        const { client, serverInfo, error } = await McpConnector.#initializeClient( { endpoint, timeout } )

        if( error ) {
            findings.push( { code: 'CON-204', severity: 'error', location: 'mcp', message: `Initialize handshake failed — ${error}` } )

            return { status: false, findings, client: null, serverInfo: null }
        }

        return { status: true, findings, client, serverInfo }
    }


    static async discover( { client } ) {
        const findings = []

        const { tools } = await McpConnector.#listTools( { client, findings } )
        const { resources } = await McpConnector.#listResources( { client, findings } )
        const { prompts } = await McpConnector.#listPrompts( { client, findings } )

        const capabilities = McpConnector.#getCapabilities( { client } )

        // Our probe client opts into tasks (SEP-2663 double opt-in, see #tryStreamableHttp/#trySSE); a server
        // that still advertises `tasks` back confirms the capability is genuinely available to opted-in clients.
        if( capabilities && typeof capabilities === 'object' && capabilities['tasks'] != null ) {
            findings.push( { code: 'CON-221', severity: 'info', location: 'capabilities.tasks', message: 'Tasks capability detected (SEP-2663, double opt-in confirmed)' } )
        }

        const status = true

        return { status, findings, tools, resources, prompts, capabilities }
    }


    static async measureLatency( { client, tools } ) {
        const { durationMs: ping } = await McpConnector.#measurePing( { client } )
        const { durationMs: listTools } = await McpConnector.#measureListTools( { client } )

        const latency = { ping, listTools }

        return { latency }
    }


    static async disconnect( { client } ) {
        if( !client ) {
            return { disconnected: true }
        }

        try {
            await client.close()
        } catch( _e ) {
            // Ignore disconnect errors
        }

        return { disconnected: true }
    }


    static async probeVersionBranch( { endpoint, timeout } ) {
        const findings = []

        const { statelessRc, statelessDiscoverError, sessionId } = await McpConnector.#probeStatelessDiscover( { endpoint, timeout } )

        if( statelessRc ) {
            findings.push( { code: 'CON-220', severity: 'info', location: 'server/discover', message: 'MCP version-branch probe: stateless RC path (server/discover) supported' } )
        }

        const versionBranch = { statelessRc, statelessDiscoverError, sessionId }

        return { versionBranch, findings }
    }


    static async #probeStatelessDiscover( { endpoint, timeout } ) {
        const controller = new AbortController()
        const timer = setTimeout( () => { controller.abort() }, timeout )

        try {
            const response = await fetch( endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json, text/event-stream'
                },
                body: JSON.stringify( { jsonrpc: '2.0', id: 1, method: 'server/discover', params: {} } ),
                signal: controller['signal']
            } )

            clearTimeout( timer )

            const sessionId = response['headers']?.['get']?.( 'mcp-session-id' ) || null

            if( response['status'] === 404 || response['status'] === 405 ) {
                return { statelessRc: false, statelessDiscoverError: null, sessionId }
            }

            const body = await response.json()

            if( body && body['error'] ) {
                return { statelessRc: false, statelessDiscoverError: null, sessionId }
            }

            const statelessRc = response['ok'] === true

            return { statelessRc, statelessDiscoverError: null, sessionId }
        } catch( e ) {
            clearTimeout( timer )
            const statelessDiscoverError = e['message'] || String( e )

            return { statelessRc: false, statelessDiscoverError, sessionId: null }
        }
    }


    static #extractServerInfoFromClient( { client } ) {
        try {
            const version = client.getServerVersion()
            const protocolVersion = client?.['_transport']?.['_protocolVersion'] || null
            const sessionId = client?.['_transport']?.['sessionId'] || null
            const instructions = client.getInstructions?.() || null

            const serverInfo = {
                serverInfo: {
                    name: version?.['name'] || null,
                    version: version?.['version'] || null,
                    description: version?.['description'] || null
                },
                protocolVersion,
                sessionId,
                instructions
            }

            return serverInfo
        } catch( _e ) {
            return null
        }
    }


    static #getCapabilities( { client } ) {
        try {
            const capabilities = client.getServerCapabilities() || {}

            return capabilities
        } catch( _e ) {
            return {}
        }
    }


    static async #checkReachable( { endpoint, timeout } ) {
        const controller = new AbortController()
        const timer = setTimeout( () => { controller.abort() }, timeout )

        try {
            await fetch( endpoint, {
                method: 'HEAD',
                signal: controller['signal']
            } )

            clearTimeout( timer )

            return { reachable: true }
        } catch( _e ) {
            clearTimeout( timer )

            return { reachable: false }
        }
    }


    static async #initializeClient( { endpoint, timeout } ) {
        const clientInfo = { name: 'mcp-server-validator', version: '0.1.0' }

        const { client: streamClient, serverInfo: streamInfo, error: streamError } = await McpConnector.#tryStreamableHttp( { endpoint, timeout, clientInfo } )

        if( !streamError ) {
            return { client: streamClient, serverInfo: streamInfo, error: null }
        }

        const { client: sseClient, serverInfo: sseInfo, error: sseError } = await McpConnector.#trySSE( { endpoint, timeout, clientInfo } )

        if( !sseError ) {
            return { client: sseClient, serverInfo: sseInfo, error: null }
        }

        return { client: null, serverInfo: null, error: sseError }
    }


    static async #tryStreamableHttp( { endpoint, timeout, clientInfo } ) {
        try {
            const transport = new StreamableHTTPClientTransport( new URL( endpoint ) )
            const client = new Client( clientInfo, { capabilities: { tasks: { list: {}, cancel: {} } } } )

            await client.connect( transport )

            const serverInfo = McpConnector.#extractServerInfoFromClient( { client } )

            return { client, serverInfo, error: null }
        } catch( e ) {
            const errorMsg = e['message'] || String( e )

            return { client: null, serverInfo: null, error: errorMsg }
        }
    }


    static async #trySSE( { endpoint, timeout, clientInfo } ) {
        try {
            const transport = new SSEClientTransport( new URL( endpoint ) )
            const client = new Client( clientInfo, { capabilities: { tasks: { list: {}, cancel: {} } } } )

            await client.connect( transport )

            const serverInfo = McpConnector.#extractServerInfoFromClient( { client } )

            return { client, serverInfo, error: null }
        } catch( e ) {
            const errorMsg = e['message'] || String( e )

            return { client: null, serverInfo: null, error: errorMsg }
        }
    }


    static async #listTools( { client, findings } ) {
        try {
            const result = await client.listTools()
            const tools = result['tools'] || []

            if( !Array.isArray( tools ) ) {
                findings.push( { code: 'CON-209', severity: 'warning', location: 'tools/list', message: 'Invalid response format' } )

                return { tools: [] }
            }

            return { tools }
        } catch( _e ) {
            findings.push( { code: 'CON-208', severity: 'warning', location: 'tools/list', message: 'Request failed' } )

            return { tools: [] }
        }
    }


    static async #listResources( { client, findings } ) {
        try {
            const result = await client.listResources()
            const resources = result['resources'] || []

            return { resources }
        } catch( _e ) {
            findings.push( { code: 'CON-210', severity: 'info', location: 'resources/list', message: 'Request failed' } )

            return { resources: [] }
        }
    }


    static async #listPrompts( { client, findings } ) {
        try {
            const result = await client.listPrompts()
            const prompts = result['prompts'] || []

            return { prompts }
        } catch( _e ) {
            findings.push( { code: 'CON-211', severity: 'info', location: 'prompts/list', message: 'Request failed' } )

            return { prompts: [] }
        }
    }


    static async #measurePing( { client } ) {
        try {
            const start = performance.now()
            await client.ping()
            const end = performance.now()
            const durationMs = Math.round( end - start )

            return { durationMs }
        } catch( _e ) {
            return { durationMs: null }
        }
    }


    static async #measureListTools( { client } ) {
        try {
            const start = performance.now()
            await client.listTools()
            const end = performance.now()
            const durationMs = Math.round( end - start )

            return { durationMs }
        } catch( _e ) {
            return { durationMs: null }
        }
    }
}


export { McpConnector }
