import { McpServerValidator } from '../../../src/index.mjs'

import {
    FULL_VALID_CATEGORIES,
    EMPTY_CATEGORIES,
    MOCK_TOOLS,
    MOCK_RESOURCES,
    MOCK_PROMPTS,
    MOCK_CAPABILITIES,
    VALID_PAYMENT_REQUIRED,
    VALID_PAYMENT_OPTIONS,
    MOCK_OAUTH_ENTRIES_EMPTY,
    MOCK_LATENCY,
    TEST_ENDPOINT,
    EXPECTED_CATEGORY_KEYS
} from '../../helpers/config.mjs'


// --- Test-specific Snapshot Factory ---

const MOCK_PER_TOOL = {
    get_weather: {
        x402Version: 2,
        resource: { url: 'https://mcp.example.com/tool/get_weather' },
        networks: [ 'eip155:84532' ],
        byNetwork: {
            'eip155:84532': {
                scheme: 'exact',
                amount: '100000',
                asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
                maxTimeoutSeconds: 300,
                extra: { name: 'USDC', version: '2' }
            }
        }
    }
}

const buildBaseEntries = () => ( {
    endpoint: TEST_ENDPOINT,
    serverName: 'test-mcp-server',
    serverVersion: '1.0.0',
    serverDescription: 'A test MCP server',
    protocolVersion: '2025-03-26',
    capabilities: { ...MOCK_CAPABILITIES },
    instructions: null,
    tools: [ ...MOCK_TOOLS ],
    resources: [ ...MOCK_RESOURCES ],
    prompts: [ ...MOCK_PROMPTS ],
    x402: {
        version: 2,
        restrictedCalls: [ { toolName: 'get_weather', paymentRequired: VALID_PAYMENT_REQUIRED } ],
        paymentOptions: [ ...VALID_PAYMENT_OPTIONS ],
        networks: [ 'eip155:84532' ],
        schemes: [ 'exact' ],
        perTool: { ...MOCK_PER_TOOL }
    },
    oauth: { ...MOCK_OAUTH_ENTRIES_EMPTY },
    latency: { ...MOCK_LATENCY },
    timestamp: '2025-06-01T12:00:00.000Z'
} )

const buildSnapshot = ( { categoriesOverride, entriesOverride } = {} ) => {
    const categories = categoriesOverride || { ...FULL_VALID_CATEGORIES }
    const entries = entriesOverride || buildBaseEntries()

    return { categories, entries }
}


describe( 'McpServerValidator.compare', () => {

    describe( 'Parameter Validation', () => {

        test( 'throws when before is missing', () => {
            const after = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { after } )
            } ).toThrow( 'VAL-210' )
        } )


        test( 'throws when after is missing', () => {
            const before = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before } )
            } ).toThrow( 'VAL-213' )
        } )


        test( 'throws when before is not an object', () => {
            const after = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before: 'string', after } )
            } ).toThrow( 'VAL-211' )
        } )


        test( 'throws when after is not an object', () => {
            const before = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before, after: 42 } )
            } ).toThrow( 'VAL-214' )
        } )


        test( 'throws when before is missing categories', () => {
            const after = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before: { entries: {} }, after } )
            } ).toThrow( 'VAL-212' )
        } )


        test( 'throws when after is missing entries', () => {
            const before = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before, after: { categories: {} } } )
            } ).toThrow( 'VAL-215' )
        } )


        test( 'throws when before is an array', () => {
            const after = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before: [], after } )
            } ).toThrow( 'VAL-211' )
        } )


        test( 'throws when before is null', () => {
            const after = buildSnapshot()

            expect( () => {
                McpServerValidator.compare( { before: null, after } )
            } ).toThrow( 'VAL-211' )
        } )
    } )


    describe( 'Identical Snapshots', () => {

        test( 'reports no changes for identical snapshots', () => {
            const before = buildSnapshot()
            const after = buildSnapshot()

            const { status, messages, hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( status ).toBe( true )
            expect( messages ).toEqual( [] )
            expect( hasChanges ).toBe( false )
            expect( diff['tools']['added'] ).toEqual( [] )
            expect( diff['tools']['removed'] ).toEqual( [] )
            expect( diff['tools']['modified'] ).toEqual( [] )
            expect( diff['x402']['changed'] ).toEqual( {} )
            expect( diff['latency']['changed'] ).toEqual( {} )
            expect( diff['categories']['changed'] ).toEqual( {} )
        } )
    } )


    describe( 'Tool Diff', () => {

        test( 'detects added tools', () => {
            const before = buildSnapshot()
            const newTool = { name: 'new_tool', description: 'A new tool', inputSchema: {} }
            const after = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    tools: [ ...MOCK_TOOLS, newTool ]
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['tools']['added'] ).toEqual( [ 'new_tool' ] )
        } )


        test( 'detects removed tools', () => {
            const before = buildSnapshot()
            const after = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    tools: [ MOCK_TOOLS[0] ]
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['tools']['removed'] ).toEqual( [ 'search_web' ] )
        } )


        test( 'detects modified tool description', () => {
            const modifiedTools = [
                { ...MOCK_TOOLS[0], description: 'Updated description' },
                MOCK_TOOLS[1]
            ]
            const before = buildSnapshot()
            const after = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    tools: modifiedTools
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['tools']['modified'].length ).toBeGreaterThan( 0 )
            expect( diff['tools']['modified'][0]['name'] ).toBe( 'get_weather' )
            expect( diff['tools']['modified'][0]['changes'][0]['field'] ).toBe( 'description' )
        } )
    } )


    describe( 'x402 Diff', () => {

        test( 'detects network changes', () => {
            const before = buildSnapshot()
            const baseEntries = buildBaseEntries()
            const after = buildSnapshot( {
                entriesOverride: {
                    ...baseEntries,
                    x402: {
                        ...baseEntries['x402'],
                        networks: [ 'eip155:84532', 'solana:mainnet' ]
                    }
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['x402']['changed']['networks']['before'] ).toEqual( [ 'eip155:84532' ] )
            expect( diff['x402']['changed']['networks']['after'] ).toEqual( [ 'eip155:84532', 'solana:mainnet' ] )
        } )


        test( 'detects scheme changes', () => {
            const before = buildSnapshot()
            const baseEntries = buildBaseEntries()
            const after = buildSnapshot( {
                entriesOverride: {
                    ...baseEntries,
                    x402: {
                        ...baseEntries['x402'],
                        schemes: [ 'exact', 'flexible' ]
                    }
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['x402']['changed']['schemes'] ).toBeDefined()
        } )
    } )


    describe( 'Latency Diff', () => {

        test( 'detects latency delta', () => {
            const before = buildSnapshot()
            const after = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    latency: { ping: 95, listTools: 250 }
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['latency']['changed']['ping']['before'] ).toBe( 120 )
            expect( diff['latency']['changed']['ping']['after'] ).toBe( 95 )
            expect( diff['latency']['changed']['ping']['delta'] ).toBe( -25 )
        } )
    } )


    describe( 'Category Diff', () => {

        test( 'detects boolean flag changes', () => {
            const before = buildSnapshot()
            const after = buildSnapshot( {
                categoriesOverride: {
                    ...FULL_VALID_CATEGORIES,
                    supportsTasks: true
                }
            } )

            const { hasChanges, diff } = McpServerValidator.compare( { before, after } )

            expect( hasChanges ).toBe( true )
            expect( diff['categories']['changed']['supportsTasks']['before'] ).toBe( false )
            expect( diff['categories']['changed']['supportsTasks']['after'] ).toBe( true )
        } )
    } )


    describe( 'Warning Messages', () => {

        test( 'warns when snapshots are from different servers', () => {
            const before = buildSnapshot()
            const after = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    endpoint: 'https://other-server.com/mcp'
                }
            } )

            const { messages } = McpServerValidator.compare( { before, after } )

            expect( messages ).toContainEqual(
                expect.stringContaining( 'CMP-001' )
            )
        } )


        test( 'warns when before snapshot has no timestamp', () => {
            const before = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    timestamp: null
                }
            } )
            const after = buildSnapshot()

            const { messages } = McpServerValidator.compare( { before, after } )

            expect( messages ).toContainEqual(
                expect.stringContaining( 'CMP-002' )
            )
        } )


        test( 'warns when after snapshot is older', () => {
            const before = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    timestamp: '2025-06-02T12:00:00.000Z'
                }
            } )
            const after = buildSnapshot( {
                entriesOverride: {
                    ...buildBaseEntries(),
                    timestamp: '2025-06-01T12:00:00.000Z'
                }
            } )

            const { messages } = McpServerValidator.compare( { before, after } )

            expect( messages ).toContainEqual(
                expect.stringContaining( 'CMP-003' )
            )
        } )
    } )
} )
