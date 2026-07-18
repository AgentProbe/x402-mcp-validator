import { describe, test, expect } from '@jest/globals'
import { SnapshotBuilder } from '../../src/task/SnapshotBuilder.mjs'
import {
    MOCK_SERVER_INFO,
    MOCK_TOOLS,
    MOCK_RESOURCES,
    MOCK_PROMPTS,
    MOCK_CAPABILITIES,
    MOCK_CAPABILITIES_WITH_EXPERIMENTAL,
    MOCK_CAPABILITIES_WITH_TASK_SUB_CAPABILITIES,
    MOCK_RESTRICTED_CALLS,
    VALID_PAYMENT_OPTIONS,
    MOCK_OAUTH_ENTRIES_EMPTY,
    MOCK_OAUTH_ENTRIES_FULL,
    MOCK_LATENCY,
    TEST_ENDPOINT,
    EXPECTED_CATEGORY_KEYS,
    EXPECTED_ENTRY_KEYS
} from '../helpers/config.mjs'


describe( 'SnapshotBuilder', () => {
    const buildArgs = {
        endpoint: TEST_ENDPOINT,
        serverInfo: MOCK_SERVER_INFO,
        tools: MOCK_TOOLS,
        resources: MOCK_RESOURCES,
        prompts: MOCK_PROMPTS,
        capabilities: MOCK_CAPABILITIES,
        partialCategories: {
            hasTools: true,
            hasResources: true,
            hasPrompts: true,
            supportsTasks: false,
            supportsMcpApps: false,
            supportsLogging: false,
            supportsCompletions: false,
            supportsResourceSubscription: false,
            supportsResourceListChanged: false,
            supportsPromptListChanged: false,
            supportsToolListChanged: false,
            supportsTaskList: false,
            supportsTaskCancel: false,
            supportsTaskAugmentedToolCall: false,
            hasExperimentalCapabilities: false,
            supportsSampling: false,
            supportsElicitation: false,
            specVersion: '2025-03-26'
        },
        restrictedCalls: MOCK_RESTRICTED_CALLS,
        paymentOptions: VALID_PAYMENT_OPTIONS,
        validPaymentOptions: VALID_PAYMENT_OPTIONS,
        latency: MOCK_LATENCY,
        oauthEntries: MOCK_OAUTH_ENTRIES_EMPTY,
        supportsOAuth: false
    }


    describe( 'build', () => {
        test( 'returns all 32 category keys', () => {
            const { categories } = SnapshotBuilder.build( buildArgs )

            EXPECTED_CATEGORY_KEYS
                .forEach( ( key ) => {
                    expect( categories ).toHaveProperty( key )
                } )
        } )


        test( 'returns all 18 entry keys', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            EXPECTED_ENTRY_KEYS
                .forEach( ( key ) => {
                    expect( entries ).toHaveProperty( key )
                } )
        } )


        test( 'sets isReachable and supportsMcp to true', () => {
            const { categories } = SnapshotBuilder.build( buildArgs )

            expect( categories.isReachable ).toBe( true )
            expect( categories.supportsMcp ).toBe( true )
        } )


        test( 'detects x402 support', () => {
            const { categories } = SnapshotBuilder.build( buildArgs )

            expect( categories.supportsX402 ).toBe( true )
            expect( categories.hasValidPaymentRequirements ).toBe( true )
        } )


        test( 'detects exact scheme', () => {
            const { categories } = SnapshotBuilder.build( buildArgs )

            expect( categories.supportsExactScheme ).toBe( true )
        } )


        test( 'detects EVM network', () => {
            const { categories } = SnapshotBuilder.build( buildArgs )

            expect( categories.supportsEvm ).toBe( true )
        } )


        test( 'extracts server info into entries', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries.serverName ).toBe( 'test-mcp-server' )
            expect( entries.serverVersion ).toBe( '1.0.0' )
            expect( entries.protocolVersion ).toBe( '2025-03-26' )
        } )


        test( 'includes x402 details in entries', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries.x402.version ).toBe( 2 )
            expect( entries.x402.networks ).toContain( 'eip155:84532' )
            expect( entries.x402.schemes ).toContain( 'exact' )
        } )


        test( 'builds perTool payments', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries.x402.perTool ).toHaveProperty( 'get_weather' )
            expect( entries.x402.perTool[ 'get_weather' ].networks ).toContain( 'eip155:84532' )
        } )


        test( 'tags each byNetwork entry with its trust model', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries.x402.perTool[ 'get_weather' ].byNetwork[ 'eip155:84532' ].trustModel ).toBe( 'capital-backed' )
        } )


        test( 'classifies trust model per scheme for all 4 schemes', () => {
            const fourSchemeOptions = [
                { scheme: 'exact', network: 'eip155:84532' },
                { scheme: 'upto', network: 'eip155:84532' },
                { scheme: 'batch-settlement', network: 'eip155:84532' },
                { scheme: 'auth-capture', network: 'eip155:84532' }
            ]

            const { entries } = SnapshotBuilder.build( {
                ...buildArgs,
                paymentOptions: fourSchemeOptions,
                validPaymentOptions: fourSchemeOptions
            } )

            expect( entries.x402.trustModels ).toContain( 'capital-backed' )
            expect( entries.x402.trustModels ).toContain( 'credit-backed' )
            expect( entries.x402.trustModels ).toHaveLength( 2 )
        } )


        test( 'exposes versionBranch entry shape (3 fields)', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries.versionBranch ).toEqual( {
                legacyStateful: true,
                statelessRc: false,
                sessionId: null
            } )
        } )


        test( 'reflects a stateless RC version branch into entry and category', () => {
            const { categories, entries } = SnapshotBuilder.build( {
                ...buildArgs,
                versionBranch: { statelessRc: true, statelessDiscoverError: null, sessionId: null }
            } )

            expect( entries.versionBranch.statelessRc ).toBe( true )
            expect( categories.supportsStatelessDiscover ).toBe( true )
        } )


        test( 'includes timestamp', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries.timestamp ).toBeDefined()
            expect( typeof entries.timestamp ).toBe( 'string' )
        } )


        test( 'includes oauth entries', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries ).toHaveProperty( 'oauth' )
            expect( entries['oauth']['issuer'] ).toBeNull()
        } )


        test( 'sets OAuth categories to false when no OAuth', () => {
            const { categories } = SnapshotBuilder.build( buildArgs )

            expect( categories['supportsOAuth'] ).toBe( false )
            expect( categories['hasValidOAuthConfig'] ).toBe( false )
        } )


        test( 'sets OAuth categories when OAuth is present', () => {
            const argsWithOAuth = {
                ...buildArgs,
                oauthEntries: MOCK_OAUTH_ENTRIES_FULL,
                supportsOAuth: true
            }

            const { categories } = SnapshotBuilder.build( argsWithOAuth )

            expect( categories['supportsOAuth'] ).toBe( true )
            expect( categories['hasProtectedResourceMetadata'] ).toBe( true )
            expect( categories['hasAuthServerMetadata'] ).toBe( true )
            expect( categories['supportsPkce'] ).toBe( true )
            expect( categories['hasDynamicRegistration'] ).toBe( true )
            expect( categories['hasValidOAuthConfig'] ).toBe( true )
        } )


        test( 'includes specVersion entry from partialCategories', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries['specVersion'] ).toBe( '2025-03-26' )
        } )


        test( 'sets experimentalCapabilities to null when no experimental', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries['experimentalCapabilities'] ).toBeNull()
        } )


        test( 'extracts experimental capability keys', () => {
            const argsWithExperimental = {
                ...buildArgs,
                capabilities: MOCK_CAPABILITIES_WITH_EXPERIMENTAL,
                partialCategories: {
                    ...buildArgs['partialCategories'],
                    hasExperimentalCapabilities: true
                }
            }

            const { entries } = SnapshotBuilder.build( argsWithExperimental )

            expect( entries['experimentalCapabilities'] ).toEqual( [ 'customFeatureA', 'customFeatureB' ] )
        } )


        test( 'sets taskCapabilities to null when no task capabilities', () => {
            const { entries } = SnapshotBuilder.build( buildArgs )

            expect( entries['taskCapabilities'] ).toBeNull()
        } )


        test( 'extracts task sub-capabilities', () => {
            const argsWithTasks = {
                ...buildArgs,
                capabilities: MOCK_CAPABILITIES_WITH_TASK_SUB_CAPABILITIES,
                partialCategories: {
                    ...buildArgs['partialCategories'],
                    supportsTasks: true,
                    supportsTaskList: true,
                    supportsTaskCancel: true,
                    supportsTaskAugmentedToolCall: true
                }
            }

            const { entries } = SnapshotBuilder.build( argsWithTasks )

            expect( entries['taskCapabilities'] ).toEqual( {
                list: true,
                cancel: true,
                augmentedToolCall: true
            } )
        } )
    } )


    describe( 'buildEmpty', () => {
        test( 'returns all categories with expected defaults', () => {
            const { categories } = SnapshotBuilder.buildEmpty( { endpoint: TEST_ENDPOINT } )

            EXPECTED_CATEGORY_KEYS
                .forEach( ( key ) => {
                    if( key === 'specVersion' ) {
                        expect( categories[key] ).toBeNull()
                    } else {
                        expect( categories[key] ).toBe( false )
                    }
                } )
        } )


        test( 'returns empty entries with endpoint', () => {
            const { entries } = SnapshotBuilder.buildEmpty( { endpoint: TEST_ENDPOINT } )

            expect( entries.endpoint ).toBe( TEST_ENDPOINT )
            expect( entries.serverName ).toBeNull()
            expect( entries.tools ).toEqual( [] )
            expect( entries.x402.restrictedCalls ).toEqual( [] )
            expect( entries.oauth.issuer ).toBeNull()
        } )


        test( 'returns null for new entries in empty snapshot', () => {
            const { entries } = SnapshotBuilder.buildEmpty( { endpoint: TEST_ENDPOINT } )

            expect( entries['specVersion'] ).toBeNull()
            expect( entries['experimentalCapabilities'] ).toBeNull()
            expect( entries['taskCapabilities'] ).toBeNull()
        } )


        test( 'returns empty trustModels and a false version branch', () => {
            const { entries } = SnapshotBuilder.buildEmpty( { endpoint: TEST_ENDPOINT } )

            expect( entries['x402']['trustModels'] ).toEqual( [] )
            expect( entries['versionBranch'] ).toEqual( {
                legacyStateful: false,
                statelessRc: false,
                sessionId: null
            } )
        } )
    } )
} )
