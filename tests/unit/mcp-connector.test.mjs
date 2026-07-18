import { describe, test, expect, jest, beforeEach } from '@jest/globals'


const mockConnect = jest.fn()
const mockClose = jest.fn()
const mockListTools = jest.fn()
const mockListResources = jest.fn()
const mockListPrompts = jest.fn()
const mockPing = jest.fn()
const mockGetServerVersion = jest.fn()
const mockGetServerCapabilities = jest.fn()
const mockGetInstructions = jest.fn()

const MockClient = jest.fn().mockImplementation( () => ( {
    connect: mockConnect,
    close: mockClose,
    listTools: mockListTools,
    listResources: mockListResources,
    listPrompts: mockListPrompts,
    ping: mockPing,
    getServerVersion: mockGetServerVersion,
    getServerCapabilities: mockGetServerCapabilities,
    getInstructions: mockGetInstructions,
    _transport: { _protocolVersion: '2025-03-26', sessionId: 'test-session-123' }
} ) )

const MockStreamableHTTPClientTransport = jest.fn()
const MockSSEClientTransport = jest.fn()

jest.unstable_mockModule( '@modelcontextprotocol/sdk/client/index.js', () => ( {
    Client: MockClient
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/client/streamableHttp.js', () => ( {
    StreamableHTTPClientTransport: MockStreamableHTTPClientTransport
} ) )

jest.unstable_mockModule( '@modelcontextprotocol/sdk/client/sse.js', () => ( {
    SSEClientTransport: MockSSEClientTransport
} ) )

const { McpConnector } = await import( '../../src/task/McpConnector.mjs' )


describe( 'McpConnector', () => {
    beforeEach( () => {
        jest.clearAllMocks()

        mockGetServerVersion.mockReturnValue( {
            name: 'test-server',
            version: '1.0.0',
            description: 'Test MCP server'
        } )
        mockGetServerCapabilities.mockReturnValue( { tools: {}, resources: {} } )
        mockGetInstructions.mockReturnValue( null )
    } )


    describe( 'connect', () => {
        test( 'returns CON-201 when server is not reachable', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'ECONNREFUSED' ) )

            const { status, findings, client } = await McpConnector
                .connect( { endpoint: 'https://unreachable.example.com/mcp', timeout: 1000 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ] ).toEqual( { code: 'CON-201', severity: 'error', location: 'endpoint', message: 'Server is not reachable' } )
            expect( client ).toBeNull()

            globalThis.fetch = originalFetch
        } )


        test( 'connects successfully via StreamableHTTP', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockResolvedValue( { ok: true } )
            mockConnect.mockResolvedValue( undefined )

            const { status, client, serverInfo } = await McpConnector
                .connect( { endpoint: 'https://reachable.example.com/mcp', timeout: 5000 } )

            expect( status ).toBe( true )
            expect( client ).toBeDefined()
            expect( serverInfo ).toBeDefined()

            globalThis.fetch = originalFetch
        } )


        test( 'falls back to SSE when StreamableHTTP fails', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockResolvedValue( { ok: true } )

            mockConnect
                .mockRejectedValueOnce( new Error( 'StreamableHTTP not supported' ) )
                .mockResolvedValueOnce( undefined )

            const { status, client } = await McpConnector
                .connect( { endpoint: 'https://sse-only.example.com/mcp', timeout: 5000 } )

            expect( status ).toBe( true )
            expect( client ).toBeDefined()
            expect( MockClient ).toHaveBeenCalledTimes( 2 )

            globalThis.fetch = originalFetch
        } )


        test( 'returns CON-204 when both transports fail', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockResolvedValue( { ok: true } )

            mockConnect
                .mockRejectedValueOnce( new Error( 'StreamableHTTP failed' ) )
                .mockRejectedValueOnce( new Error( 'SSE failed' ) )

            const { status, findings, client } = await McpConnector
                .connect( { endpoint: 'https://broken.example.com/mcp', timeout: 5000 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'CON-204' )
            expect( findings[ 0 ]['severity'] ).toBe( 'error' )
            expect( client ).toBeNull()

            globalThis.fetch = originalFetch
        } )


        test( 'declares client-side tasks opt-in (SEP-2663 double opt-in)', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockResolvedValue( { ok: true } )
            mockConnect.mockResolvedValue( undefined )

            await McpConnector
                .connect( { endpoint: 'https://reachable.example.com/mcp', timeout: 5000 } )

            expect( MockClient ).toHaveBeenCalledWith(
                expect.any( Object ),
                { capabilities: { tasks: { list: {}, cancel: {} } } }
            )

            globalThis.fetch = originalFetch
        } )
    } )


    describe( 'discover', () => {
        test( 'lists tools, resources, prompts and capabilities', async () => {
            mockListTools.mockResolvedValue( { tools: [ { name: 'tool1' } ] } )
            mockListResources.mockResolvedValue( { resources: [ { uri: 'res1' } ] } )
            mockListPrompts.mockResolvedValue( { prompts: [ { name: 'prompt1' } ] } )
            mockGetServerCapabilities.mockReturnValue( { tools: {} } )

            const mockClient = {
                listTools: mockListTools,
                listResources: mockListResources,
                listPrompts: mockListPrompts,
                getServerCapabilities: mockGetServerCapabilities
            }

            const { status, tools, resources, prompts, capabilities } = await McpConnector
                .discover( { client: mockClient } )

            expect( status ).toBe( true )
            expect( tools ).toHaveLength( 1 )
            expect( resources ).toHaveLength( 1 )
            expect( prompts ).toHaveLength( 1 )
            expect( capabilities ).toBeDefined()
        } )


        test( 'returns empty arrays and messages on listTools failure', async () => {
            mockListTools.mockRejectedValue( new Error( 'timeout' ) )
            mockListResources.mockResolvedValue( { resources: [] } )
            mockListPrompts.mockResolvedValue( { prompts: [] } )
            mockGetServerCapabilities.mockReturnValue( {} )

            const mockClient = {
                listTools: mockListTools,
                listResources: mockListResources,
                listPrompts: mockListPrompts,
                getServerCapabilities: mockGetServerCapabilities
            }

            const { status, tools, findings } = await McpConnector
                .discover( { client: mockClient } )

            expect( status ).toBe( true )
            expect( tools ).toEqual( [] )
            expect( findings ).toContainEqual( { code: 'CON-208', severity: 'warning', location: 'tools/list', message: 'Request failed' } )
        } )


        test( 'handles listResources failure', async () => {
            mockListTools.mockResolvedValue( { tools: [] } )
            mockListResources.mockRejectedValue( new Error( 'timeout' ) )
            mockListPrompts.mockResolvedValue( { prompts: [] } )
            mockGetServerCapabilities.mockReturnValue( {} )

            const mockClient = {
                listTools: mockListTools,
                listResources: mockListResources,
                listPrompts: mockListPrompts,
                getServerCapabilities: mockGetServerCapabilities
            }

            const { resources, findings } = await McpConnector
                .discover( { client: mockClient } )

            expect( resources ).toEqual( [] )
            expect( findings ).toContainEqual( { code: 'CON-210', severity: 'info', location: 'resources/list', message: 'Request failed' } )
        } )


        test( 'handles listPrompts failure', async () => {
            mockListTools.mockResolvedValue( { tools: [] } )
            mockListResources.mockResolvedValue( { resources: [] } )
            mockListPrompts.mockRejectedValue( new Error( 'timeout' ) )
            mockGetServerCapabilities.mockReturnValue( {} )

            const mockClient = {
                listTools: mockListTools,
                listResources: mockListResources,
                listPrompts: mockListPrompts,
                getServerCapabilities: mockGetServerCapabilities
            }

            const { prompts, findings } = await McpConnector
                .discover( { client: mockClient } )

            expect( prompts ).toEqual( [] )
            expect( findings ).toContainEqual( { code: 'CON-211', severity: 'info', location: 'prompts/list', message: 'Request failed' } )
        } )


        test( 'emits CON-221 when server advertises a tasks capability', async () => {
            mockListTools.mockResolvedValue( { tools: [] } )
            mockListResources.mockResolvedValue( { resources: [] } )
            mockListPrompts.mockResolvedValue( { prompts: [] } )
            mockGetServerCapabilities.mockReturnValue( { tools: {}, tasks: { list: true } } )

            const mockClient = {
                listTools: mockListTools,
                listResources: mockListResources,
                listPrompts: mockListPrompts,
                getServerCapabilities: mockGetServerCapabilities
            }

            const { findings } = await McpConnector
                .discover( { client: mockClient } )

            expect( findings ).toContainEqual( { code: 'CON-221', severity: 'info', location: 'capabilities.tasks', message: 'Tasks capability detected (SEP-2663, double opt-in confirmed)' } )
        } )
    } )


    describe( 'probeVersionBranch', () => {
        test( 'reports statelessRc true and emits CON-220 when server/discover succeeds', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                status: 200,
                headers: { get: () => null },
                json: async () => ( { jsonrpc: '2.0', id: 1, result: { tools: [] } } )
            } )

            const { versionBranch, findings } = await McpConnector
                .probeVersionBranch( { endpoint: 'https://rc.example.com/mcp', timeout: 5000 } )

            expect( versionBranch['statelessRc'] ).toBe( true )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'CON-220', severity: 'info' } ) )

            globalThis.fetch = originalFetch
        } )


        test( 'reports statelessRc false on a JSON-RPC -32601 (method not found)', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: true,
                status: 200,
                headers: { get: () => null },
                json: async () => ( { jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } } )
            } )

            const { versionBranch, findings } = await McpConnector
                .probeVersionBranch( { endpoint: 'https://legacy.example.com/mcp', timeout: 5000 } )

            expect( versionBranch['statelessRc'] ).toBe( false )
            expect( findings ).toEqual( [] )

            globalThis.fetch = originalFetch
        } )


        test( 'reports statelessRc false with an error message on network failure', async () => {
            const originalFetch = globalThis.fetch
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'ECONNREFUSED' ) )

            const { versionBranch, findings } = await McpConnector
                .probeVersionBranch( { endpoint: 'https://down.example.com/mcp', timeout: 5000 } )

            expect( versionBranch['statelessRc'] ).toBe( false )
            expect( versionBranch['statelessDiscoverError'] ).toBe( 'ECONNREFUSED' )
            expect( findings ).toEqual( [] )

            globalThis.fetch = originalFetch
        } )
    } )


    describe( 'measureLatency', () => {
        test( 'measures ping and listTools latency', async () => {
            mockPing.mockResolvedValue( undefined )
            mockListTools.mockResolvedValue( { tools: [] } )

            const mockClient = {
                ping: mockPing,
                listTools: mockListTools
            }

            const { latency } = await McpConnector
                .measureLatency( { client: mockClient, tools: [] } )

            expect( latency.ping ).toBeDefined()
            expect( typeof latency.ping ).toBe( 'number' )
            expect( latency.listTools ).toBeDefined()
            expect( typeof latency.listTools ).toBe( 'number' )
        } )


        test( 'returns null durations on failure', async () => {
            mockPing.mockRejectedValue( new Error( 'timeout' ) )
            mockListTools.mockRejectedValue( new Error( 'timeout' ) )

            const mockClient = {
                ping: mockPing,
                listTools: mockListTools
            }

            const { latency } = await McpConnector
                .measureLatency( { client: mockClient, tools: [] } )

            expect( latency.ping ).toBeNull()
            expect( latency.listTools ).toBeNull()
        } )
    } )


    describe( 'disconnect', () => {
        test( 'closes client', async () => {
            mockClose.mockResolvedValue( undefined )

            const mockClient = { close: mockClose }

            const { disconnected } = await McpConnector
                .disconnect( { client: mockClient } )

            expect( disconnected ).toBe( true )
            expect( mockClose ).toHaveBeenCalled()
        } )


        test( 'returns true when client is null', async () => {
            const { disconnected } = await McpConnector
                .disconnect( { client: null } )

            expect( disconnected ).toBe( true )
        } )


        test( 'ignores close errors', async () => {
            const mockClient = {
                close: jest.fn().mockRejectedValue( new Error( 'close error' ) )
            }

            const { disconnected } = await McpConnector
                .disconnect( { client: mockClient } )

            expect( disconnected ).toBe( true )
        } )
    } )
} )
