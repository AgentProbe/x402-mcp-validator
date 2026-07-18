// --- MCP Server Info ---

const MOCK_SERVER_INFO = {
    serverInfo: {
        name: 'test-mcp-server',
        version: '1.0.0',
        description: 'A test MCP server'
    },
    protocolVersion: '2025-03-26',
    instructions: null
}


// --- MCP Capabilities ---

const MOCK_TOOLS = [
    {
        name: 'get_weather',
        description: 'Get weather for a location',
        inputSchema: {
            type: 'object',
            properties: {
                location: { type: 'string' }
            },
            required: [ 'location' ]
        }
    },
    {
        name: 'search_web',
        description: 'Search the web',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' }
            },
            required: [ 'query' ]
        }
    }
]

const MOCK_RESOURCES = [
    {
        uri: 'resource://docs',
        name: 'Documentation',
        description: 'API documentation'
    }
]

const MOCK_PROMPTS = [
    {
        name: 'summarize',
        description: 'Summarize text'
    }
]

const MOCK_CAPABILITIES = {
    tools: {},
    resources: {},
    prompts: {}
}

const MOCK_CAPABILITIES_WITH_TASKS = {
    tools: {},
    tasks: { supported: true }
}

const MOCK_CAPABILITIES_WITH_LOGGING_COMPLETIONS = {
    tools: {},
    logging: {},
    completions: {}
}

const MOCK_CAPABILITIES_WITH_EXPERIMENTAL = {
    tools: {},
    experimental: {
        customFeatureA: true,
        customFeatureB: { enabled: true }
    }
}

const MOCK_CAPABILITIES_WITH_TASK_SUB_CAPABILITIES = {
    tools: {},
    tasks: {
        list: true,
        cancel: true,
        requests: {
            tools: {
                call: true
            }
        }
    }
}

const MOCK_CAPABILITIES_WITH_RESOURCE_SUB_PROPERTIES = {
    tools: {},
    resources: {
        subscribe: true,
        listChanged: true
    },
    prompts: {
        listChanged: true
    },
    tools: {
        listChanged: true
    }
}

const MOCK_CAPABILITIES_WITH_SAMPLING = {
    tools: {},
    sampling: {}
}

const MOCK_CAPABILITIES_WITH_ELICITATION = {
    tools: {},
    elicitation: {}
}


// --- Valid Payment Required ---

const VALID_PAYMENT_REQUIRED = {
    x402Version: 2,
    resource: {
        url: 'https://mcp.example.com/tool/get_weather'
    },
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300,
            extra: {
                name: 'USDC',
                version: '2'
            }
        }
    ]
}

const VALID_PAYMENT_REQUIRED_MULTI_NETWORK = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300,
            extra: {
                name: 'USDC',
                version: '2'
            }
        },
        {
            scheme: 'exact',
            network: 'solana:mainnet',
            amount: '200000',
            asset: '0xAbCdEf0123456789AbCdEf0123456789AbCdEf01',
            payTo: '0x1234567890AbCdEf1234567890AbCdEf12345678',
            maxTimeoutSeconds: 600
        }
    ]
}


// --- Invalid Payment Required Variants ---

const INVALID_PAYMENT_MISSING_VERSION = {
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}

const INVALID_PAYMENT_WRONG_VERSION = {
    x402Version: 1,
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}

const INVALID_PAYMENT_EMPTY_ACCEPTS = {
    x402Version: 2,
    accepts: []
}

const INVALID_PAYMENT_BAD_SCHEME = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'flexible',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}

const INVALID_PAYMENT_BAD_NETWORK = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'exact',
            network: 'bitcoin',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}

const INVALID_PAYMENT_BAD_AMOUNT = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: 'not-a-number',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}

const INVALID_PAYMENT_BAD_ADDRESS = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0xinvalid',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}


// --- Valid Payment Required — the 3 additional x402 schemes (F12) ---

const VALID_PAYMENT_REQUIRED_UPTO = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'upto',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300,
            extra: {
                name: 'USDC',
                version: '2'
            }
        }
    ]
}

const VALID_PAYMENT_REQUIRED_BATCH_SETTLEMENT = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'batch-settlement',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300,
            extra: {
                name: 'USDC',
                version: '2'
            }
        }
    ]
}

const VALID_PAYMENT_REQUIRED_AUTH_CAPTURE = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'auth-capture',
            network: 'eip155:84532',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300,
            extra: {
                name: 'USDC',
                version: '2'
            }
        }
    ]
}

const VALID_PAYMENT_REQUIRED_GENERIC_CAIP2_NETWORK = {
    x402Version: 2,
    accepts: [
        {
            scheme: 'exact',
            network: 'cosmos:cosmoshub-4',
            amount: '100000',
            asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
            maxTimeoutSeconds: 300
        }
    ]
}


// --- Mock Restricted Calls ---

const MOCK_RESTRICTED_CALLS = [
    {
        toolName: 'get_weather',
        paymentRequired: VALID_PAYMENT_REQUIRED
    }
]

const MOCK_RESTRICTED_CALLS_MULTI = [
    {
        toolName: 'get_weather',
        paymentRequired: VALID_PAYMENT_REQUIRED
    },
    {
        toolName: 'search_web',
        paymentRequired: VALID_PAYMENT_REQUIRED_MULTI_NETWORK
    }
]


// --- Valid Payment Options (extracted from accepts) ---

const VALID_PAYMENT_OPTIONS = VALID_PAYMENT_REQUIRED['accepts']

const VALID_PAYMENT_OPTIONS_MULTI = [
    ...VALID_PAYMENT_REQUIRED['accepts'],
    ...VALID_PAYMENT_REQUIRED_MULTI_NETWORK['accepts']
]


// --- Expected Category Keys (31) ---

const EXPECTED_CATEGORY_KEYS = [
    'isReachable',
    'supportsMcp',
    'hasTools',
    'hasResources',
    'hasPrompts',
    'supportsX402',
    'hasValidPaymentRequirements',
    'supportsExactScheme',
    'supportsEvm',
    'supportsSolana',
    'supportsTasks',
    'supportsMcpApps',
    'supportsLogging',
    'supportsCompletions',
    'supportsResourceSubscription',
    'supportsResourceListChanged',
    'supportsPromptListChanged',
    'supportsToolListChanged',
    'supportsTaskList',
    'supportsTaskCancel',
    'supportsTaskAugmentedToolCall',
    'supportsStatelessDiscover',
    'hasExperimentalCapabilities',
    'supportsSampling',
    'supportsElicitation',
    'specVersion',
    'supportsOAuth',
    'hasProtectedResourceMetadata',
    'hasAuthServerMetadata',
    'supportsPkce',
    'hasDynamicRegistration',
    'hasValidOAuthConfig'
]


// --- Expected Entry Keys (18) ---

const EXPECTED_ENTRY_KEYS = [
    'endpoint',
    'serverName',
    'serverVersion',
    'serverDescription',
    'protocolVersion',
    'capabilities',
    'instructions',
    'tools',
    'resources',
    'prompts',
    'specVersion',
    'experimentalCapabilities',
    'taskCapabilities',
    'versionBranch',
    'x402',
    'oauth',
    'latency',
    'timestamp'
]


// --- Full Valid Categories ---

const FULL_VALID_CATEGORIES = {
    isReachable: true,
    supportsMcp: true,
    hasTools: true,
    hasResources: true,
    hasPrompts: true,
    supportsX402: true,
    hasValidPaymentRequirements: true,
    supportsExactScheme: true,
    supportsEvm: true,
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
    specVersion: '2025-03-26',
    supportsOAuth: false,
    hasProtectedResourceMetadata: false,
    hasAuthServerMetadata: false,
    supportsPkce: false,
    hasDynamicRegistration: false,
    hasValidOAuthConfig: false
}


// --- Empty Categories ---

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


// --- Mock OAuth Entries ---

const MOCK_OAUTH_ENTRIES_EMPTY = {
    issuer: null,
    authorizationEndpoint: null,
    tokenEndpoint: null,
    registrationEndpoint: null,
    revocationEndpoint: null,
    scopesSupported: [],
    grantTypesSupported: [],
    responseTypesSupported: [],
    pkceMethodsSupported: [],
    clientIdMetadataDocumentSupported: false,
    protectedResourceMetadataUrl: null,
    mcpVersion: null
}

const MOCK_OAUTH_ENTRIES_FULL = {
    issuer: 'https://auth.example.com',
    authorizationEndpoint: 'https://auth.example.com/oauth/authorize',
    tokenEndpoint: 'https://auth.example.com/oauth/token',
    registrationEndpoint: 'https://auth.example.com/oauth/register',
    revocationEndpoint: 'https://auth.example.com/oauth/revoke',
    scopesSupported: [ 'mcp:tools', 'mcp:resources' ],
    grantTypesSupported: [ 'authorization_code', 'refresh_token' ],
    responseTypesSupported: [ 'code' ],
    pkceMethodsSupported: [ 'S256' ],
    clientIdMetadataDocumentSupported: true,
    protectedResourceMetadataUrl: 'https://mcp.example.com/.well-known/oauth-protected-resource/mcp',
    mcpVersion: '2025-11-25'
}


// --- Mock Latency ---

const MOCK_LATENCY = {
    ping: 120,
    listTools: 250
}


// --- Test Endpoint ---

const TEST_ENDPOINT = 'https://mcp.example.com/mcp'


export {
    MOCK_SERVER_INFO,
    MOCK_TOOLS,
    MOCK_RESOURCES,
    MOCK_PROMPTS,
    MOCK_CAPABILITIES,
    MOCK_CAPABILITIES_WITH_TASKS,
    MOCK_CAPABILITIES_WITH_LOGGING_COMPLETIONS,
    MOCK_CAPABILITIES_WITH_EXPERIMENTAL,
    MOCK_CAPABILITIES_WITH_TASK_SUB_CAPABILITIES,
    MOCK_CAPABILITIES_WITH_RESOURCE_SUB_PROPERTIES,
    MOCK_CAPABILITIES_WITH_SAMPLING,
    MOCK_CAPABILITIES_WITH_ELICITATION,
    VALID_PAYMENT_REQUIRED,
    VALID_PAYMENT_REQUIRED_MULTI_NETWORK,
    VALID_PAYMENT_REQUIRED_UPTO,
    VALID_PAYMENT_REQUIRED_BATCH_SETTLEMENT,
    VALID_PAYMENT_REQUIRED_AUTH_CAPTURE,
    VALID_PAYMENT_REQUIRED_GENERIC_CAIP2_NETWORK,
    INVALID_PAYMENT_MISSING_VERSION,
    INVALID_PAYMENT_WRONG_VERSION,
    INVALID_PAYMENT_EMPTY_ACCEPTS,
    INVALID_PAYMENT_BAD_SCHEME,
    INVALID_PAYMENT_BAD_NETWORK,
    INVALID_PAYMENT_BAD_AMOUNT,
    INVALID_PAYMENT_BAD_ADDRESS,
    MOCK_RESTRICTED_CALLS,
    MOCK_RESTRICTED_CALLS_MULTI,
    VALID_PAYMENT_OPTIONS,
    VALID_PAYMENT_OPTIONS_MULTI,
    EXPECTED_CATEGORY_KEYS,
    EXPECTED_ENTRY_KEYS,
    FULL_VALID_CATEGORIES,
    EMPTY_CATEGORIES,
    MOCK_OAUTH_ENTRIES_EMPTY,
    MOCK_OAUTH_ENTRIES_FULL,
    MOCK_LATENCY,
    TEST_ENDPOINT
}
