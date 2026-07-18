import { EMPTY_OAUTH_ENTRIES } from './OAuthProber.mjs'


const EMPTY_CATEGORIES = {
    isReachable: false,
    supportsMcp: false,
    hasTools: false,
    hasResources: false,
    hasPrompts: false,
    supportsX402: false,
    hasValidPaymentRequirements: false,
    supportsExactScheme: false,
    supportsEvm: false,
    supportsSolana: false,
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
    supportsStatelessDiscover: false,
    hasExperimentalCapabilities: false,
    supportsSampling: false,
    supportsElicitation: false,
    specVersion: null,
    supportsOAuth: false,
    hasProtectedResourceMetadata: false,
    hasAuthServerMetadata: false,
    supportsPkce: false,
    hasDynamicRegistration: false,
    hasValidOAuthConfig: false
}


// AgentProbe-owned trust-model badge (F12) — NOT a literal x402 spec field. Derived from settlement timing:
// exact / batch-settlement bind funds at pledge time (capital-backed); upto / auth-capture pledge before
// the amount/release is finalized (credit-backed). Unknown schemes map to null (forward-compat).
const TRUST_MODEL_BY_SCHEME = {
    exact: 'capital-backed',
    'batch-settlement': 'capital-backed',
    upto: 'credit-backed',
    'auth-capture': 'credit-backed'
}


class SnapshotBuilder {


    static build( { endpoint, serverInfo, tools, resources, prompts, capabilities, partialCategories, restrictedCalls, paymentOptions, validPaymentOptions, latency, oauthEntries, supportsOAuth, versionBranch } ) {
        const { categories } = SnapshotBuilder.#buildCategories( { partialCategories, restrictedCalls, paymentOptions, validPaymentOptions, oauthEntries, supportsOAuth, versionBranch } )
        const { entries } = SnapshotBuilder.#buildEntries( { endpoint, serverInfo, tools, resources, prompts, capabilities, partialCategories, restrictedCalls, paymentOptions, validPaymentOptions, latency, oauthEntries, versionBranch } )

        return { categories, entries }
    }


    static buildEmpty( { endpoint, oauthEntries = null, supportsOAuth = false } ) {
        const oauthCategories = SnapshotBuilder.#buildOAuthCategories( { oauthEntries, supportsOAuth } )
        const categories = { ...EMPTY_CATEGORIES, ...oauthCategories }

        const entries = {
            endpoint,
            serverName: null,
            serverVersion: null,
            serverDescription: null,
            protocolVersion: null,
            capabilities: {},
            instructions: null,
            tools: [],
            resources: [],
            prompts: [],
            specVersion: null,
            experimentalCapabilities: null,
            taskCapabilities: null,
            versionBranch: {
                legacyStateful: false,
                statelessRc: false,
                sessionId: null
            },
            x402: {
                version: null,
                restrictedCalls: [],
                paymentOptions: [],
                networks: [],
                schemes: [],
                trustModels: [],
                perTool: {}
            },
            oauth: oauthEntries || { ...EMPTY_OAUTH_ENTRIES },
            latency: {
                ping: null,
                listTools: null
            },
            timestamp: new Date().toISOString()
        }

        return { categories, entries }
    }


    static #buildCategories( { partialCategories, restrictedCalls, paymentOptions, validPaymentOptions, oauthEntries, supportsOAuth, versionBranch } ) {
        const supportsX402 = restrictedCalls.length > 0
        const hasValidPaymentRequirements = validPaymentOptions.length > 0
        const { hasExact: supportsExactScheme } = SnapshotBuilder.#detectScheme( { paymentOptions: validPaymentOptions, scheme: 'exact' } )
        const { hasNetwork: supportsEvm } = SnapshotBuilder.#detectNetworkPrefix( { paymentOptions: validPaymentOptions, prefix: 'eip155:' } )
        const { hasNetwork: supportsSolana } = SnapshotBuilder.#detectNetworkPrefix( { paymentOptions: validPaymentOptions, prefix: 'solana:' } )

        const oauthCategories = SnapshotBuilder.#buildOAuthCategories( { oauthEntries, supportsOAuth } )

        const categories = {
            isReachable: true,
            supportsMcp: true,
            hasTools: partialCategories['hasTools'],
            hasResources: partialCategories['hasResources'],
            hasPrompts: partialCategories['hasPrompts'],
            supportsX402,
            hasValidPaymentRequirements,
            supportsExactScheme,
            supportsEvm,
            supportsSolana,
            supportsTasks: partialCategories['supportsTasks'],
            supportsMcpApps: partialCategories['supportsMcpApps'],
            supportsLogging: partialCategories['supportsLogging'],
            supportsCompletions: partialCategories['supportsCompletions'],
            supportsResourceSubscription: partialCategories['supportsResourceSubscription'],
            supportsResourceListChanged: partialCategories['supportsResourceListChanged'],
            supportsPromptListChanged: partialCategories['supportsPromptListChanged'],
            supportsToolListChanged: partialCategories['supportsToolListChanged'],
            supportsTaskList: partialCategories['supportsTaskList'],
            supportsTaskCancel: partialCategories['supportsTaskCancel'],
            supportsTaskAugmentedToolCall: partialCategories['supportsTaskAugmentedToolCall'],
            supportsStatelessDiscover: versionBranch?.['statelessRc'] ?? false,
            hasExperimentalCapabilities: partialCategories['hasExperimentalCapabilities'],
            supportsSampling: partialCategories['supportsSampling'] || false,
            supportsElicitation: partialCategories['supportsElicitation'] || false,
            specVersion: partialCategories['specVersion'],
            ...oauthCategories
        }

        return { categories }
    }


    static #buildEntries( { endpoint, serverInfo, tools, resources, prompts, capabilities, partialCategories, restrictedCalls, paymentOptions, validPaymentOptions, latency, oauthEntries, versionBranch } ) {
        const { serverName, serverVersion, serverDescription, protocolVersion, instructions } = SnapshotBuilder.#extractServerInfo( { serverInfo } )
        const { networks } = SnapshotBuilder.#extractUniqueNetworks( { paymentOptions: validPaymentOptions } )
        const { schemes } = SnapshotBuilder.#extractUniqueSchemes( { paymentOptions: validPaymentOptions } )
        const { trustModels } = SnapshotBuilder.#extractUniqueTrustModels( { paymentOptions: validPaymentOptions } )
        const { perTool } = SnapshotBuilder.#buildPerToolPayments( { restrictedCalls } )
        const { experimentalCapabilities } = SnapshotBuilder.#extractExperimentalKeys( { capabilities } )
        const { taskCapabilities } = SnapshotBuilder.#extractTaskCapabilities( { capabilities } )
        const { versionBranchEntry } = SnapshotBuilder.#buildVersionBranchEntry( { serverInfo, versionBranch } )

        const version = restrictedCalls.length > 0 && restrictedCalls[ 0 ][ 'paymentRequired' ] && typeof restrictedCalls[ 0 ][ 'paymentRequired' ][ 'x402Version' ] === 'number'
            ? restrictedCalls[ 0 ][ 'paymentRequired' ][ 'x402Version' ]
            : null
        const specVersion = partialCategories['specVersion'] || null

        const entries = {
            endpoint,
            serverName,
            serverVersion,
            serverDescription,
            protocolVersion,
            capabilities: capabilities || {},
            instructions,
            tools,
            resources,
            prompts,
            specVersion,
            experimentalCapabilities,
            taskCapabilities,
            versionBranch: versionBranchEntry,
            x402: {
                version,
                restrictedCalls,
                paymentOptions,
                networks,
                schemes,
                trustModels,
                perTool
            },
            oauth: oauthEntries || { ...EMPTY_OAUTH_ENTRIES },
            latency,
            timestamp: new Date().toISOString()
        }

        return { entries }
    }


    static #buildOAuthCategories( { oauthEntries, supportsOAuth } ) {
        if( !oauthEntries || !supportsOAuth ) {
            return {
                supportsOAuth: false,
                hasProtectedResourceMetadata: false,
                hasAuthServerMetadata: false,
                supportsPkce: false,
                hasDynamicRegistration: false,
                hasValidOAuthConfig: false
            }
        }

        const hasProtectedResourceMetadata = oauthEntries['protectedResourceMetadataUrl'] !== null
        const hasAuthServerMetadata = oauthEntries['authorizationEndpoint'] !== null
        const supportsPkce = Array.isArray( oauthEntries['pkceMethodsSupported'] ) && oauthEntries['pkceMethodsSupported'].includes( 'S256' )
        const hasDynamicRegistration = oauthEntries['registrationEndpoint'] !== null || oauthEntries['clientIdMetadataDocumentSupported'] === true
        const hasValidOAuthConfig = hasProtectedResourceMetadata && hasAuthServerMetadata && supportsPkce

        return {
            supportsOAuth: true,
            hasProtectedResourceMetadata,
            hasAuthServerMetadata,
            supportsPkce,
            hasDynamicRegistration,
            hasValidOAuthConfig
        }
    }


    static #extractServerInfo( { serverInfo } ) {
        if( !serverInfo || typeof serverInfo !== 'object' ) {
            return { serverName: null, serverVersion: null, serverDescription: null, protocolVersion: null, instructions: null }
        }

        const inner = serverInfo['serverInfo'] || {}
        const serverName = inner['name'] || null
        const serverVersion = inner['version'] || null
        const serverDescription = inner['description'] || null
        const protocolVersion = serverInfo['protocolVersion'] || null
        const instructions = serverInfo['instructions'] || null

        return { serverName, serverVersion, serverDescription, protocolVersion, instructions }
    }


    static #buildPerToolPayments( { restrictedCalls } ) {
        const perTool = {}

        restrictedCalls
            .forEach( ( call ) => {
                const { toolName, paymentRequired } = call

                if( !paymentRequired ) {
                    return
                }

                const accepts = paymentRequired['accepts'] || []
                const resource = paymentRequired['resource'] || null
                const x402Version = paymentRequired['x402Version'] || null

                const byNetwork = {}

                accepts
                    .forEach( ( option ) => {
                        const network = option['network']

                        if( !network ) {
                            return
                        }

                        const { trustModel } = SnapshotBuilder.#classifyTrustModel( { scheme: option['scheme'] } )

                        byNetwork[network] = {
                            scheme: option['scheme'] || null,
                            amount: option['amount'] || null,
                            asset: option['asset'] || null,
                            payTo: option['payTo'] || null,
                            maxTimeoutSeconds: option['maxTimeoutSeconds'] || null,
                            extra: option['extra'] || null,
                            trustModel
                        }
                    } )

                perTool[toolName] = {
                    x402Version,
                    resource,
                    networks: Object.keys( byNetwork ),
                    byNetwork
                }
            } )

        return { perTool }
    }


    static #extractUniqueNetworks( { paymentOptions } ) {
        const networkSet = new Set()

        paymentOptions
            .forEach( ( option ) => {
                const network = option['network']

                if( typeof network === 'string' ) {
                    networkSet.add( network )
                }
            } )

        const networks = Array.from( networkSet )

        return { networks }
    }


    static #extractUniqueSchemes( { paymentOptions } ) {
        const schemeSet = new Set()

        paymentOptions
            .forEach( ( option ) => {
                const scheme = option['scheme']

                if( typeof scheme === 'string' ) {
                    schemeSet.add( scheme )
                }
            } )

        const schemes = Array.from( schemeSet )

        return { schemes }
    }


    static #classifyTrustModel( { scheme } ) {
        const trustModel = TRUST_MODEL_BY_SCHEME[scheme] || null

        return { trustModel }
    }


    static #extractUniqueTrustModels( { paymentOptions } ) {
        const trustModelSet = new Set()

        paymentOptions
            .forEach( ( option ) => {
                const { trustModel } = SnapshotBuilder.#classifyTrustModel( { scheme: option['scheme'] } )

                if( typeof trustModel === 'string' ) {
                    trustModelSet.add( trustModel )
                }
            } )

        const trustModels = Array.from( trustModelSet )

        return { trustModels }
    }


    static #detectScheme( { paymentOptions, scheme } ) {
        const hasExact = paymentOptions
            .some( ( option ) => option['scheme'] === scheme )

        return { hasExact }
    }


    static #detectNetworkPrefix( { paymentOptions, prefix } ) {
        const hasNetwork = paymentOptions
            .some( ( option ) => typeof option['network'] === 'string' && option['network'].startsWith( prefix ) )

        return { hasNetwork }
    }


    static #extractExperimentalKeys( { capabilities } ) {
        if( !capabilities || typeof capabilities !== 'object' ) {
            return { experimentalCapabilities: null }
        }

        const experimental = capabilities['experimental']

        if( !experimental || typeof experimental !== 'object' ) {
            return { experimentalCapabilities: null }
        }

        const experimentalCapabilities = Object.keys( experimental )

        return { experimentalCapabilities }
    }


    static #extractTaskCapabilities( { capabilities } ) {
        if( !capabilities || typeof capabilities !== 'object' ) {
            return { taskCapabilities: null }
        }

        const tasks = capabilities['tasks']

        if( !tasks || typeof tasks !== 'object' ) {
            return { taskCapabilities: null }
        }

        const list = tasks['list'] === true
        const cancel = tasks['cancel'] === true
        const augmentedToolCall = tasks['requests']?.['tools']?.['call'] === true

        const taskCapabilities = { list, cancel, augmentedToolCall }

        return { taskCapabilities }
    }


    static #buildVersionBranchEntry( { serverInfo, versionBranch } ) {
        const versionBranchEntry = {
            legacyStateful: serverInfo?.['protocolVersion'] != null,
            statelessRc: versionBranch?.['statelessRc'] ?? false,
            sessionId: serverInfo?.['sessionId'] ?? null
        }

        return { versionBranchEntry }
    }
}


export { SnapshotBuilder }
