import { jest } from '@jest/globals'

import {
    MOCK_SERVER_INFO,
    MOCK_TOOLS,
    MOCK_RESOURCES,
    MOCK_PROMPTS,
    MOCK_CAPABILITIES,
    VALID_PAYMENT_REQUIRED,
    MOCK_OAUTH_ENTRIES_EMPTY,
    MOCK_LATENCY,
    EXPECTED_CATEGORY_KEYS,
    EXPECTED_ENTRY_KEYS,
    EMPTY_CATEGORIES,
    TEST_ENDPOINT
} from '../../helpers/config.mjs'


// --- Mock Setup ---

const mockClient = {
    callTool: jest.fn(),
    listTools: jest.fn().mockResolvedValue( { tools: MOCK_TOOLS } ),
    listResources: jest.fn().mockResolvedValue( { resources: MOCK_RESOURCES } ),
    listPrompts: jest.fn().mockResolvedValue( { prompts: MOCK_PROMPTS } ),
    ping: jest.fn().mockResolvedValue( undefined ),
    close: jest.fn().mockResolvedValue( undefined ),
    serverCapabilities: MOCK_CAPABILITIES
}

const mockConnector = {
    connect: jest.fn(),
    discover: jest.fn(),
    measureLatency: jest.fn(),
    disconnect: jest.fn(),
    probeVersionBranch: jest.fn()
}

const mockOAuthProber = {
    probe: jest.fn()
}

jest.unstable_mockModule( '../../../src/task/McpConnector.mjs', () => ( {
    McpConnector: {
        connect: mockConnector['connect'],
        discover: mockConnector['discover'],
        measureLatency: mockConnector['measureLatency'],
        disconnect: mockConnector['disconnect'],
        probeVersionBranch: mockConnector['probeVersionBranch']
    }
} ) )

jest.unstable_mockModule( '../../../src/task/OAuthProber.mjs', () => ( {
    OAuthProber: {
        probe: mockOAuthProber['probe']
    },
    EMPTY_OAUTH_ENTRIES: MOCK_OAUTH_ENTRIES_EMPTY
} ) )

const { McpServerValidator } = await import( '../../../src/McpServerValidator.mjs' )


describe( 'McpServerValidator.start', () => {

    beforeEach( () => {
        jest.clearAllMocks()

        mockOAuthProber['probe'].mockResolvedValue( {
            findings: [],
            supportsOAuth: false,
            protectedResource: null,
            authServer: null,
            oauthEntries: { ...MOCK_OAUTH_ENTRIES_EMPTY }
        } )

        mockConnector['probeVersionBranch'].mockResolvedValue( {
            versionBranch: { statelessRc: false, statelessDiscoverError: null, sessionId: null },
            findings: []
        } )
    } )


    describe( 'Parameter Validation', () => {

        test( 'throws when endpoint is missing', async () => {
            await expect( McpServerValidator.start( {} ) ).rejects.toThrow( 'VAL-201' )
        } )


        test( 'throws when endpoint is not a string', async () => {
            await expect( McpServerValidator.start( { endpoint: 42 } ) ).rejects.toThrow( 'VAL-202' )
        } )


        test( 'throws when endpoint is empty', async () => {
            await expect( McpServerValidator.start( { endpoint: '  ' } ) ).rejects.toThrow( 'VAL-203' )
        } )


        test( 'throws when endpoint is invalid URL', async () => {
            await expect( McpServerValidator.start( { endpoint: 'not-a-url' } ) ).rejects.toThrow( 'VAL-204' )
        } )


        test( 'throws when timeout is not a number', async () => {
            await expect( McpServerValidator.start( { endpoint: TEST_ENDPOINT, timeout: 'fast' } ) ).rejects.toThrow( 'VAL-205' )
        } )


        test( 'throws when timeout is zero', async () => {
            await expect( McpServerValidator.start( { endpoint: TEST_ENDPOINT, timeout: 0 } ) ).rejects.toThrow( 'VAL-206' )
        } )


        test( 'throws when timeout is negative', async () => {
            await expect( McpServerValidator.start( { endpoint: TEST_ENDPOINT, timeout: -1 } ) ).rejects.toThrow( 'VAL-206' )
        } )
    } )


    describe( 'Unreachable Server', () => {

        test( 'returns empty categories when server is not reachable', async () => {
            mockConnector['connect'].mockResolvedValue( {
                status: false,
                findings: [ { code: 'CON-201', severity: 'error', location: 'endpoint', message: 'Server is not reachable' } ],
                client: null,
                serverInfo: null
            } )

            const { status, findings, categories, entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( status ).toBe( false )
            expect( findings ).toContainEqual( expect.objectContaining( { code: 'CON-201' } ) )

            EXPECTED_CATEGORY_KEYS
                .forEach( ( key ) => {
                    if( key === 'specVersion' ) {
                        expect( categories[key] ).toBeNull()
                    } else {
                        expect( categories[key] ).toBe( false )
                    }
                } )

            expect( entries['endpoint'] ).toBe( TEST_ENDPOINT )
            expect( entries['serverName'] ).toBeNull()
            expect( entries['tools'] ).toEqual( [] )
        } )
    } )


    describe( 'Successful Pipeline', () => {

        beforeEach( () => {
            mockConnector['connect'].mockResolvedValue( {
                status: true,
                findings: [],
                client: mockClient,
                serverInfo: MOCK_SERVER_INFO
            } )

            mockConnector['discover'].mockResolvedValue( {
                status: true,
                findings: [],
                tools: MOCK_TOOLS,
                resources: MOCK_RESOURCES,
                prompts: MOCK_PROMPTS,
                capabilities: MOCK_CAPABILITIES
            } )

            mockConnector['measureLatency'].mockResolvedValue( {
                latency: MOCK_LATENCY
            } )

            mockConnector['disconnect'].mockResolvedValue( {
                disconnected: true
            } )
        } )


        test( 'returns all 32 category keys', async () => {
            const { categories } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            const categoryKeys = Object.keys( categories )

            EXPECTED_CATEGORY_KEYS
                .forEach( ( key ) => {
                    expect( categoryKeys ).toContain( key )
                } )

            expect( categoryKeys.length ).toBe( 32 )
        } )


        test( 'returns all 18 entry keys', async () => {
            const { entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            const entryKeys = Object.keys( entries )

            EXPECTED_ENTRY_KEYS
                .forEach( ( key ) => {
                    expect( entryKeys ).toContain( key )
                } )

            expect( entryKeys.length ).toBe( 18 )
        } )


        test( 'sets isReachable and supportsMcp to true', async () => {
            const { categories } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( categories['isReachable'] ).toBe( true )
            expect( categories['supportsMcp'] ).toBe( true )
        } )


        test( 'classifies tools, resources, prompts correctly', async () => {
            const { categories } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( categories['hasTools'] ).toBe( true )
            expect( categories['hasResources'] ).toBe( true )
            expect( categories['hasPrompts'] ).toBe( true )
        } )


        test( 'extracts server info into entries', async () => {
            const { entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['serverName'] ).toBe( 'test-mcp-server' )
            expect( entries['serverVersion'] ).toBe( '1.0.0' )
            expect( entries['protocolVersion'] ).toBe( '2025-03-26' )
        } )


        test( 'includes latency in entries', async () => {
            const { entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['latency']['ping'] ).toBe( 120 )
            expect( entries['latency']['listTools'] ).toBe( 250 )
        } )


        test( 'includes timestamp in entries', async () => {
            const { entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( entries['timestamp'] ).toBeDefined()
            expect( typeof entries['timestamp'] ).toBe( 'string' )
        } )


        test( 'calls disconnect after pipeline', async () => {
            await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( mockConnector['disconnect'] ).toHaveBeenCalledTimes( 1 )
        } )
    } )


    describe( 'x402 Detection', () => {

        beforeEach( () => {
            mockConnector['connect'].mockResolvedValue( {
                status: true,
                findings: [],
                client: mockClient,
                serverInfo: MOCK_SERVER_INFO
            } )

            mockConnector['discover'].mockResolvedValue( {
                status: true,
                findings: [],
                tools: MOCK_TOOLS,
                resources: MOCK_RESOURCES,
                prompts: MOCK_PROMPTS,
                capabilities: MOCK_CAPABILITIES
            } )

            mockConnector['measureLatency'].mockResolvedValue( {
                latency: MOCK_LATENCY
            } )

            mockConnector['disconnect'].mockResolvedValue( {
                disconnected: true
            } )
        } )


        test( 'detects x402 when tool returns 402 error', async () => {
            mockClient['callTool']
                .mockRejectedValueOnce( { code: -32402, data: VALID_PAYMENT_REQUIRED } )
                .mockRejectedValueOnce( { code: -32402, data: VALID_PAYMENT_REQUIRED } )

            const { categories, entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( categories['supportsX402'] ).toBe( true )
            expect( entries['x402']['restrictedCalls'].length ).toBeGreaterThan( 0 )
        } )


        test( 'validates payment options', async () => {
            mockClient['callTool']
                .mockRejectedValueOnce( { code: -32402, data: VALID_PAYMENT_REQUIRED } )
                .mockResolvedValueOnce( {} )

            const { categories, entries } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( categories['supportsX402'] ).toBe( true )
            expect( categories['hasValidPaymentRequirements'] ).toBe( true )
            expect( entries['x402']['networks'].length ).toBeGreaterThan( 0 )
            expect( entries['x402']['schemes'] ).toContain( 'exact' )
        } )


        test( 'sets supportsX402 false when no 402 errors', async () => {
            mockClient['callTool'].mockResolvedValue( {} )

            const { categories } = await McpServerValidator.start( { endpoint: TEST_ENDPOINT } )

            expect( categories['supportsX402'] ).toBe( false )
            expect( categories['hasValidPaymentRequirements'] ).toBe( false )
        } )
    } )
} )
