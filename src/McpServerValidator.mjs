import { CapabilityClassifier } from './task/CapabilityClassifier.mjs'
import { McpConnector } from './task/McpConnector.mjs'
import { OAuthProber } from './task/OAuthProber.mjs'
import { PaymentValidator } from './task/PaymentValidator.mjs'
import { SnapshotBuilder } from './task/SnapshotBuilder.mjs'
import { Validation } from './task/Validation.mjs'
import { X402Prober } from './task/X402Prober.mjs'


class McpServerValidator {


    static async start( { endpoint, timeout = 10000 } ) {
        const { status: validationStatus, findings: validationFindings } = Validation.validationStart( { endpoint, timeout } )
        if( !validationStatus ) {
            const messages = validationFindings
                .map( ( finding ) => `${finding['code']} ${finding['location']}: ${finding['message']}` )

            Validation.error( { messages } )
        }

        const [ oauthResult, connectResult, versionBranchResult ] = await Promise.all( [
            OAuthProber.probe( { endpoint, timeout } ),
            McpConnector.connect( { endpoint, timeout } ),
            McpConnector.probeVersionBranch( { endpoint, timeout } )
        ] )

        const { findings: oauthFindings, supportsOAuth, oauthEntries } = oauthResult
        const { status: connectStatus, findings: connectFindings, client, serverInfo } = connectResult
        const { versionBranch, findings: versionBranchFindings } = versionBranchResult

        if( !connectStatus ) {
            const { categories, entries } = SnapshotBuilder.buildEmpty( { endpoint, oauthEntries, supportsOAuth } )
            const findings = [ ...connectFindings, ...oauthFindings, ...versionBranchFindings ]

            return { status: false, findings, categories, entries }
        }

        const { findings: pipelineFindings, categories, entries } = await McpServerValidator.#runPipeline( { endpoint, client, serverInfo, timeout, oauthEntries, supportsOAuth, versionBranch } )

        await McpConnector.disconnect( { client } )

        const allFindings = [ ...connectFindings, ...oauthFindings, ...versionBranchFindings, ...pipelineFindings ]
        const status = allFindings.length === 0

        return { status, findings: allFindings, categories, entries }
    }


    static compare( { before, after } ) {
        const { status: validationStatus, messages: validationMessages } = Validation.validationCompare( { before, after } )
        if( !validationStatus ) { Validation.error( { messages: validationMessages } ) }

        const findings = []

        McpServerValidator.#checkSnapshotIntegrity( { before, after, findings } )

        const { diff: serverDiff } = McpServerValidator.#diffServer( { before: before['entries'], after: after['entries'] } )
        const { diff: capabilitiesDiff } = McpServerValidator.#diffCapabilities( { before: before['entries']['capabilities'] || {}, after: after['entries']['capabilities'] || {} } )
        const { diff: toolsDiff } = McpServerValidator.#diffTools( { before: before['entries']['tools'], after: after['entries']['tools'] } )
        const { diff: x402Diff } = McpServerValidator.#diffX402( { before: before['entries']['x402'], after: after['entries']['x402'] } )
        const { diff: latencyDiff } = McpServerValidator.#diffLatency( { before: before['entries']['latency'], after: after['entries']['latency'] } )
        const { diff: categoriesDiff } = McpServerValidator.#diffCategories( { before: before['categories'], after: after['categories'] } )

        const hasChanges = McpServerValidator.#hasAnyChanges( { serverDiff, capabilitiesDiff, toolsDiff, x402Diff, latencyDiff, categoriesDiff } )

        const diff = {
            server: serverDiff,
            capabilities: capabilitiesDiff,
            tools: toolsDiff,
            x402: x402Diff,
            latency: latencyDiff,
            categories: categoriesDiff
        }

        const status = true

        return { status, findings, hasChanges, diff }
    }


    static async #runPipeline( { endpoint, client, serverInfo, timeout, oauthEntries, supportsOAuth, versionBranch } ) {
        const allFindings = []

        const { findings: discoverFindings, tools, resources, prompts, capabilities } = await McpConnector.discover( { client } )
        allFindings.push( ...discoverFindings )

        const { categories: partialCategories } = CapabilityClassifier.classify( { serverInfo, tools, resources, prompts, capabilities } )

        const { findings: probeFindings, restrictedCalls, paymentOptions } = await X402Prober.probe( { client, tools, timeout } )
        allFindings.push( ...probeFindings )

        const { findings: paymentFindings, validPaymentOptions } = PaymentValidator.validate( { restrictedCalls, paymentOptions } )
        allFindings.push( ...paymentFindings )

        const { latency } = await McpConnector.measureLatency( { client, tools } )

        const { categories, entries } = SnapshotBuilder.build( {
            endpoint,
            serverInfo,
            tools,
            resources,
            prompts,
            capabilities,
            partialCategories,
            restrictedCalls,
            paymentOptions,
            validPaymentOptions,
            latency,
            oauthEntries,
            supportsOAuth,
            versionBranch
        } )

        return { findings: allFindings, categories, entries }
    }


    static #checkSnapshotIntegrity( { before, after, findings } ) {
        const beforeUrl = before['entries']['endpoint']
        const afterUrl = after['entries']['endpoint']

        if( beforeUrl !== afterUrl ) {
            findings.push( { code: 'CMP-001', severity: 'warning', location: 'compare', message: 'Snapshots are from different servers' } )
        }

        const beforeTimestamp = before['entries']['timestamp']
        const afterTimestamp = after['entries']['timestamp']

        if( !beforeTimestamp ) {
            findings.push( { code: 'CMP-002', severity: 'warning', location: 'compare', message: 'Before snapshot has no timestamp' } )
        }

        if( beforeTimestamp && afterTimestamp && afterTimestamp < beforeTimestamp ) {
            findings.push( { code: 'CMP-003', severity: 'warning', location: 'compare', message: 'After snapshot is older than before' } )
        }
    }


    static #diffServer( { before, after } ) {
        const changed = {}

        const fields = [ 'serverName', 'serverVersion', 'serverDescription', 'protocolVersion', 'instructions' ]

        fields
            .forEach( ( field ) => {
                const beforeVal = before[field] || null
                const afterVal = after[field] || null

                if( beforeVal !== afterVal ) {
                    changed[field] = { before: beforeVal, after: afterVal }
                }
            } )

        return { diff: { changed } }
    }


    static #diffCapabilities( { before, after } ) {
        const added = {}
        const removed = {}
        const modified = {}

        Object.keys( after )
            .forEach( ( key ) => {
                if( before[key] === undefined ) {
                    added[key] = after[key]
                } else if( JSON.stringify( before[key] ) !== JSON.stringify( after[key] ) ) {
                    modified[key] = { before: before[key], after: after[key] }
                }
            } )

        Object.keys( before )
            .forEach( ( key ) => {
                if( after[key] === undefined ) {
                    removed[key] = before[key]
                }
            } )

        const diff = { added, removed, modified }

        return { diff }
    }


    static #diffTools( { before, after } ) {
        const beforeNames = before.map( ( t ) => t['name'] )
        const afterNames = after.map( ( t ) => t['name'] )

        const added = afterNames
            .filter( ( name ) => !beforeNames.includes( name ) )

        const removed = beforeNames
            .filter( ( name ) => !afterNames.includes( name ) )

        const modified = []

        afterNames
            .filter( ( name ) => beforeNames.includes( name ) )
            .forEach( ( name ) => {
                const beforeTool = before.find( ( t ) => t['name'] === name )
                const afterTool = after.find( ( t ) => t['name'] === name )
                const { changes } = McpServerValidator.#diffSingleTool( { beforeTool, afterTool } )

                if( changes.length > 0 ) {
                    modified.push( { name, changes } )
                }
            } )

        const diff = { added, removed, modified }

        return { diff }
    }


    static #diffSingleTool( { beforeTool, afterTool } ) {
        const changes = []

        const beforeDesc = beforeTool['description'] || null
        const afterDesc = afterTool['description'] || null

        if( beforeDesc !== afterDesc ) {
            changes.push( { field: 'description', before: beforeDesc, after: afterDesc } )
        }

        const beforeSchema = beforeTool['inputSchema'] || {}
        const afterSchema = afterTool['inputSchema'] || {}

        McpServerValidator.#diffInputSchema( { beforeSchema, afterSchema, changes } )

        return { changes }
    }


    static #diffInputSchema( { beforeSchema, afterSchema, changes } ) {
        const beforeProps = beforeSchema['properties'] || {}
        const afterProps = afterSchema['properties'] || {}
        const beforeRequired = beforeSchema['required'] || []
        const afterRequired = afterSchema['required'] || []

        const beforePropKeys = Object.keys( beforeProps )
        const afterPropKeys = Object.keys( afterProps )

        const addedProps = afterPropKeys
            .filter( ( k ) => !beforePropKeys.includes( k ) )

        const removedProps = beforePropKeys
            .filter( ( k ) => !afterPropKeys.includes( k ) )

        if( addedProps.length > 0 ) {
            changes.push( { field: 'inputSchema.properties', type: 'added', keys: addedProps } )
        }

        if( removedProps.length > 0 ) {
            changes.push( { field: 'inputSchema.properties', type: 'removed', keys: removedProps } )
        }

        afterPropKeys
            .filter( ( k ) => beforePropKeys.includes( k ) )
            .forEach( ( key ) => {
                const bProp = beforeProps[key]
                const aProp = afterProps[key]

                if( bProp['type'] !== aProp['type'] ) {
                    changes.push( { field: `inputSchema.properties.${key}.type`, before: bProp['type'], after: aProp['type'] } )
                }

                const bEnum = bProp['enum'] || null
                const aEnum = aProp['enum'] || null

                if( JSON.stringify( bEnum ) !== JSON.stringify( aEnum ) ) {
                    changes.push( { field: `inputSchema.properties.${key}.enum`, before: bEnum, after: aEnum } )
                }

                const bDefault = bProp['default']
                const aDefault = aProp['default']

                if( JSON.stringify( bDefault ) !== JSON.stringify( aDefault ) ) {
                    changes.push( { field: `inputSchema.properties.${key}.default`, before: bDefault, after: aDefault } )
                }

                const bMin = bProp['minimum']
                const aMin = aProp['minimum']

                if( bMin !== aMin ) {
                    changes.push( { field: `inputSchema.properties.${key}.minimum`, before: bMin, after: aMin } )
                }

                const bMax = bProp['maximum']
                const aMax = aProp['maximum']

                if( bMax !== aMax ) {
                    changes.push( { field: `inputSchema.properties.${key}.maximum`, before: bMax, after: aMax } )
                }

                const bDescription = bProp['description'] || null
                const aDescription = aProp['description'] || null

                if( bDescription !== aDescription ) {
                    changes.push( { field: `inputSchema.properties.${key}.description`, before: bDescription, after: aDescription } )
                }
            } )

        if( JSON.stringify( beforeRequired ) !== JSON.stringify( afterRequired ) ) {
            const addedReq = afterRequired
                .filter( ( k ) => !beforeRequired.includes( k ) )

            const removedReq = beforeRequired
                .filter( ( k ) => !afterRequired.includes( k ) )

            changes.push( { field: 'inputSchema.required', before: beforeRequired, after: afterRequired, added: addedReq, removed: removedReq } )
        }
    }


    static #diffX402( { before, after } ) {
        const beforePerTool = before['perTool'] || {}
        const afterPerTool = after['perTool'] || {}

        const beforeToolNames = Object.keys( beforePerTool )
        const afterToolNames = Object.keys( afterPerTool )

        const toolsAdded = afterToolNames
            .filter( ( name ) => !beforeToolNames.includes( name ) )

        const toolsRemoved = beforeToolNames
            .filter( ( name ) => !afterToolNames.includes( name ) )

        const toolsModified = []

        afterToolNames
            .filter( ( name ) => beforeToolNames.includes( name ) )
            .forEach( ( toolName ) => {
                const { changes } = McpServerValidator.#diffPerToolPayment( {
                    before: beforePerTool[toolName],
                    after: afterPerTool[toolName]
                } )

                if( changes.length > 0 ) {
                    toolsModified.push( { toolName, changes } )
                }
            } )

        const globalChanged = {}

        const beforeNetworks = JSON.stringify( before['networks'] || [] )
        const afterNetworks = JSON.stringify( after['networks'] || [] )

        if( beforeNetworks !== afterNetworks ) {
            globalChanged['networks'] = { before: before['networks'], after: after['networks'] }
        }

        const beforeSchemes = JSON.stringify( before['schemes'] || [] )
        const afterSchemes = JSON.stringify( after['schemes'] || [] )

        if( beforeSchemes !== afterSchemes ) {
            globalChanged['schemes'] = { before: before['schemes'], after: after['schemes'] }
        }

        const beforeTrustModels = JSON.stringify( before['trustModels'] || [] )
        const afterTrustModels = JSON.stringify( after['trustModels'] || [] )

        if( beforeTrustModels !== afterTrustModels ) {
            globalChanged['trustModels'] = { before: before['trustModels'], after: after['trustModels'] }
        }

        const diff = { toolsAdded, toolsRemoved, toolsModified, changed: globalChanged }

        return { diff }
    }


    static #diffPerToolPayment( { before, after } ) {
        const changes = []

        if( before['resource'] !== after['resource'] ) {
            changes.push( { field: 'resource', before: before['resource'], after: after['resource'] } )
        }

        if( before['x402Version'] !== after['x402Version'] ) {
            changes.push( { field: 'x402Version', before: before['x402Version'], after: after['x402Version'] } )
        }

        const beforeNetworks = before['networks'] || []
        const afterNetworks = after['networks'] || []

        const networksAdded = afterNetworks
            .filter( ( n ) => !beforeNetworks.includes( n ) )

        const networksRemoved = beforeNetworks
            .filter( ( n ) => !afterNetworks.includes( n ) )

        if( networksAdded.length > 0 ) {
            changes.push( { field: 'networks', type: 'added', networks: networksAdded } )
        }

        if( networksRemoved.length > 0 ) {
            changes.push( { field: 'networks', type: 'removed', networks: networksRemoved } )
        }

        const beforeByNetwork = before['byNetwork'] || {}
        const afterByNetwork = after['byNetwork'] || {}

        afterNetworks
            .filter( ( n ) => beforeNetworks.includes( n ) )
            .forEach( ( network ) => {
                const bNet = beforeByNetwork[network] || {}
                const aNet = afterByNetwork[network] || {}

                const fields = [ 'scheme', 'amount', 'asset', 'payTo', 'maxTimeoutSeconds', 'trustModel' ]

                fields
                    .forEach( ( f ) => {
                        const bVal = bNet[f] || null
                        const aVal = aNet[f] || null

                        if( JSON.stringify( bVal ) !== JSON.stringify( aVal ) ) {
                            changes.push( { field: `byNetwork.${network}.${f}`, before: bVal, after: aVal } )
                        }
                    } )

                const bExtra = JSON.stringify( bNet['extra'] || null )
                const aExtra = JSON.stringify( aNet['extra'] || null )

                if( bExtra !== aExtra ) {
                    changes.push( { field: `byNetwork.${network}.extra`, before: bNet['extra'], after: aNet['extra'] } )
                }
            } )

        return { changes }
    }


    static #diffLatency( { before, after } ) {
        const changed = {}

        if( before['ping'] !== null && after['ping'] !== null && before['ping'] !== after['ping'] ) {
            const delta = after['ping'] - before['ping']
            changed['ping'] = { before: before['ping'], after: after['ping'], delta }
        }

        if( before['listTools'] !== null && after['listTools'] !== null && before['listTools'] !== after['listTools'] ) {
            const delta = after['listTools'] - before['listTools']
            changed['listTools'] = { before: before['listTools'], after: after['listTools'], delta }
        }

        const diff = { changed }

        return { diff }
    }


    static #diffCategories( { before, after } ) {
        const changed = {}

        Object.keys( before )
            .forEach( ( key ) => {
                if( before[key] !== after[key] ) {
                    changed[key] = { before: before[key], after: after[key] }
                }
            } )

        const diff = { changed }

        return { diff }
    }


    static #hasAnyChanges( { serverDiff, capabilitiesDiff, toolsDiff, x402Diff, latencyDiff, categoriesDiff } ) {
        const serverChanged = Object.keys( serverDiff['changed'] ).length > 0
        const capsAdded = Object.keys( capabilitiesDiff['added'] ).length > 0
        const capsRemoved = Object.keys( capabilitiesDiff['removed'] ).length > 0
        const capsModified = Object.keys( capabilitiesDiff['modified'] ).length > 0
        const toolsChanged = toolsDiff['added'].length > 0 || toolsDiff['removed'].length > 0 || toolsDiff['modified'].length > 0
        const x402ToolsChanged = x402Diff['toolsAdded'].length > 0 || x402Diff['toolsRemoved'].length > 0 || x402Diff['toolsModified'].length > 0
        const x402GlobalChanged = Object.keys( x402Diff['changed'] ).length > 0
        const latencyChanged = Object.keys( latencyDiff['changed'] ).length > 0
        const categoriesChanged = Object.keys( categoriesDiff['changed'] ).length > 0

        const hasChanges = serverChanged || capsAdded || capsRemoved || capsModified || toolsChanged || x402ToolsChanged || x402GlobalChanged || latencyChanged || categoriesChanged

        return hasChanges
    }
}


export { McpServerValidator }
