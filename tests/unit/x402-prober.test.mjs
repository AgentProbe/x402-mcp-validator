import { describe, test, expect, jest } from '@jest/globals'
import { X402Prober } from '../../src/task/X402Prober.mjs'
import { MOCK_TOOLS } from '../helpers/config.mjs'


describe( 'X402Prober', () => {
    describe( 'probe', () => {
        test( 'returns PRB-005 when tools array is empty', async () => {
            const mockClient = { callTool: jest.fn() }

            const { status, messages, restrictedCalls, paymentOptions } = await X402Prober
                .probe( { client: mockClient, tools: [], timeout: 5000 } )

            expect( status ).toBe( false )
            expect( messages ).toContain( 'PRB-005 probe: No tools available to probe' )
            expect( restrictedCalls ).toEqual( [] )
            expect( paymentOptions ).toEqual( [] )
        } )


        test( 'returns PRB-005 when tools is not an array', async () => {
            const mockClient = { callTool: jest.fn() }

            const { status, messages } = await X402Prober
                .probe( { client: mockClient, tools: null, timeout: 5000 } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'PRB-005' )
        } )


        test( 'returns no restricted calls when tools respond normally', async () => {
            const mockClient = {
                callTool: jest.fn().mockResolvedValue( { content: [ { type: 'text', text: 'ok' } ] } )
            }

            const { status, restrictedCalls, paymentOptions } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( status ).toBe( true )
            expect( restrictedCalls ).toEqual( [] )
            expect( paymentOptions ).toEqual( [] )
            expect( mockClient.callTool ).toHaveBeenCalledTimes( 2 )
        } )


        test( 'detects 402 restricted tools', async () => {
            const paymentRequired = {
                x402Version: 2,
                accepts: [
                    { scheme: 'exact', network: 'eip155:84532', amount: '100000' }
                ]
            }

            const error402 = new Error( 'Payment Required' )
            error402.code = -32402
            error402.data = paymentRequired

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error402 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { status, restrictedCalls, paymentOptions } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( status ).toBe( true )
            expect( restrictedCalls ).toHaveLength( 1 )
            expect( restrictedCalls[ 0 ].toolName ).toBe( 'get_weather' )
            expect( restrictedCalls[ 0 ].paymentRequired ).toEqual( paymentRequired )
            expect( paymentOptions ).toHaveLength( 1 )
            expect( paymentOptions[ 0 ].scheme ).toBe( 'exact' )
        } )


        test( 'detects HTTP 402 code', async () => {
            const error402 = new Error( 'Payment Required' )
            error402.code = 402
            error402.data = { x402Version: 2, accepts: [] }

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error402 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toHaveLength( 1 )
        } )


        test( 'ignores non-402 errors', async () => {
            const error500 = new Error( 'Internal error' )
            error500.code = -32603

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error500 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { status, restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( status ).toBe( true )
            expect( restrictedCalls ).toEqual( [] )
        } )


        test( 'handles 402 with no data', async () => {
            const error402 = new Error( 'Payment Required' )
            error402.code = 402

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error402 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toEqual( [] )
        } )


        test( 'handles 402 with non-object data', async () => {
            const error402 = new Error( 'Payment Required' )
            error402.code = 402
            error402.data = 'string-data'

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error402 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toEqual( [] )
        } )


        test( 'handles 402 with array data', async () => {
            const error402 = new Error( 'Payment Required' )
            error402.code = 402
            error402.data = [ 'array-data' ]

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error402 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toEqual( [] )
        } )


        test( 'builds minimal args from input schema', async () => {
            const toolsWithSchema = [
                {
                    name: 'typed_tool',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            query: { type: 'string' },
                            count: { type: 'number' },
                            flag: { type: 'boolean' },
                            items: { type: 'array' },
                            config: { type: 'object' }
                        },
                        required: [ 'query', 'count', 'flag', 'items', 'config' ]
                    }
                }
            ]

            const mockClient = {
                callTool: jest.fn().mockResolvedValue( { content: [] } )
            }

            await X402Prober.probe( { client: mockClient, tools: toolsWithSchema, timeout: 5000 } )

            expect( mockClient.callTool ).toHaveBeenCalledWith(
                {
                    name: 'typed_tool',
                    arguments: {
                        query: 'test',
                        count: 0,
                        flag: false,
                        items: [],
                        config: {}
                    }
                },
                { timeout: 5000 }
            )
        } )


        test( 'builds empty args when no input schema', async () => {
            const toolsNoSchema = [
                { name: 'simple_tool' }
            ]

            const mockClient = {
                callTool: jest.fn().mockResolvedValue( { content: [] } )
            }

            await X402Prober.probe( { client: mockClient, tools: toolsNoSchema, timeout: 5000 } )

            expect( mockClient.callTool ).toHaveBeenCalledWith(
                { name: 'simple_tool', arguments: {} },
                { timeout: 5000 }
            )
        } )


        test( 'detects x402 via isError tool result with structuredContent (spec v2)', async () => {
            const paymentRequired = {
                x402Version: 2,
                error: 'Payment required',
                resource: { url: 'mcp://tool/get_weather', description: 'Weather data' },
                accepts: [
                    { scheme: 'exact', network: 'eip155:84532', amount: '100000', asset: '0xUSDC', payTo: '0xRecipient' }
                ]
            }

            const mockClient = {
                callTool: jest.fn()
                    .mockResolvedValueOnce( {
                        structuredContent: paymentRequired,
                        content: [ { type: 'text', text: JSON.stringify( paymentRequired ) } ],
                        isError: true
                    } )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { status, restrictedCalls, paymentOptions } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( status ).toBe( true )
            expect( restrictedCalls ).toHaveLength( 1 )
            expect( restrictedCalls[ 0 ].toolName ).toBe( 'get_weather' )
            expect( restrictedCalls[ 0 ].paymentRequired.x402Version ).toBe( 2 )
            expect( restrictedCalls[ 0 ].paymentRequired.accepts ).toHaveLength( 1 )
            expect( paymentOptions ).toHaveLength( 1 )
            expect( paymentOptions[ 0 ].scheme ).toBe( 'exact' )
        } )


        test( 'detects x402 via isError tool result with content[0].text JSON (spec v2 fallback)', async () => {
            const paymentRequired = {
                x402Version: 2,
                accepts: [
                    { scheme: 'exact', network: 'eip155:8453', amount: '50000' }
                ]
            }

            const mockClient = {
                callTool: jest.fn()
                    .mockResolvedValueOnce( {
                        content: [ { type: 'text', text: JSON.stringify( paymentRequired ) } ],
                        isError: true
                    } )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { restrictedCalls, paymentOptions } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toHaveLength( 1 )
            expect( restrictedCalls[ 0 ].paymentRequired.x402Version ).toBe( 2 )
            expect( paymentOptions ).toHaveLength( 1 )
        } )


        test( 'ignores isError result without x402 payment data', async () => {
            const mockClient = {
                callTool: jest.fn()
                    .mockResolvedValueOnce( {
                        content: [ { type: 'text', text: 'Some other error occurred' } ],
                        isError: true
                    } )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toEqual( [] )
        } )


        test( 'legacy 402 error detection produces PRB-006 info message', async () => {
            const error402 = new Error( 'Payment Required' )
            error402.code = -32402
            error402.data = {
                x402Version: 2,
                accepts: [ { scheme: 'exact', network: 'eip155:84532', amount: '100000' } ]
            }

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error402 )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { messages, restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toHaveLength( 1 )
            expect( messages.some( ( m ) => m.includes( 'PRB-006' ) ) ).toBe( true )
            expect( messages.some( ( m ) => m.includes( 'not be spec-compliant' ) ) ).toBe( true )
        } )


        test( 'PRB-007 message for spec-konform detection', async () => {
            const mockClient = {
                callTool: jest.fn()
                    .mockResolvedValueOnce( {
                        structuredContent: { x402Version: 2, accepts: [ { scheme: 'exact' } ] },
                        content: [ { type: 'text', text: '{"x402Version":2,"accepts":[{"scheme":"exact"}]}' } ],
                        isError: true
                    } )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { messages } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( messages.some( ( m ) => m.includes( 'PRB-007' ) ) ).toBe( true )
            expect( messages.some( ( m ) => m.includes( 'spec-konform' ) ) ).toBe( true )
        } )


        test( 'PRB-008 extracts payment from error.message JSON (transport mixing)', async () => {
            const paymentJson = '{"x402Version":1,"error":"Payment Required","accepts":[{"scheme":"exact","network":"eip155:8453","amount":"10000"}]}'
            const error = new Error( 'Streamable HTTP error: Error POSTing to endpoint: ' + paymentJson )
            error.code = 402

            const mockClient = {
                callTool: jest.fn()
                    .mockRejectedValueOnce( error )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { messages, restrictedCalls, paymentOptions } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toHaveLength( 1 )
            expect( restrictedCalls[ 0 ].paymentRequired.x402Version ).toBe( 1 )
            expect( restrictedCalls[ 0 ].paymentRequired.accepts ).toHaveLength( 1 )
            expect( paymentOptions ).toHaveLength( 1 )
            expect( messages.some( ( m ) => m.includes( 'PRB-008' ) ) ).toBe( true )
            expect( messages.some( ( m ) => m.includes( 'transport mixing' ) ) ).toBe( true )
        } )


        test( 'PRB-009 detects Base64 paymentRequired in structuredContent', async () => {
            const payment = { x402Version: 2, accepts: [ { scheme: 'exact', network: 'eip155:8453', amount: '1000000' } ] }
            const b64 = Buffer.from( JSON.stringify( payment ) ).toString( 'base64' )

            const mockClient = {
                callTool: jest.fn()
                    .mockResolvedValueOnce( {
                        content: [ { type: 'text', text: 'Payment required' } ],
                        structuredContent: { ok: true, status: 402, paymentRequired: b64 },
                        isError: false
                    } )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { messages, restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toHaveLength( 1 )
            expect( restrictedCalls[ 0 ].paymentRequired.x402Version ).toBe( 2 )
            expect( messages.some( ( m ) => m.includes( 'PRB-009' ) ) ).toBe( true )
        } )


        test( 'PRB-010 detects x402 API redirect in tool result', async () => {
            const mockClient = {
                callTool: jest.fn()
                    .mockResolvedValueOnce( {
                        content: [ { type: 'text', text: '{"endpoint":"https://x402.server.com/api/tool","payment":"x402 protocol","price":"$0.05"}' } ],
                        structuredContent: { endpoint: 'https://x402.server.com/api/tool', payment: 'x402 protocol' },
                        isError: false
                    } )
                    .mockResolvedValueOnce( { content: [] } )
            }

            const { messages, restrictedCalls } = await X402Prober
                .probe( { client: mockClient, tools: MOCK_TOOLS, timeout: 5000 } )

            expect( restrictedCalls ).toHaveLength( 1 )
            expect( restrictedCalls[ 0 ].paymentRequired.redirect ).toBeDefined()
            expect( messages.some( ( m ) => m.includes( 'PRB-010' ) ) ).toBe( true )
        } )


        test( 'handles required field with unknown type', async () => {
            const toolsUnknown = [
                {
                    name: 'unknown_type_tool',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            data: { type: 'custom' }
                        },
                        required: [ 'data' ]
                    }
                }
            ]

            const mockClient = {
                callTool: jest.fn().mockResolvedValue( { content: [] } )
            }

            await X402Prober.probe( { client: mockClient, tools: toolsUnknown, timeout: 5000 } )

            expect( mockClient.callTool ).toHaveBeenCalledWith(
                { name: 'unknown_type_tool', arguments: { data: '' } },
                { timeout: 5000 }
            )
        } )
    } )
} )
