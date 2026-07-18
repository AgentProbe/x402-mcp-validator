import { McpServerValidator } from '../../src/index.mjs'


const MCP_URL = process.env.MCP_SERVER_URL || 'https://your-mcp-server.example.com/mcp'


const runStart = async () => {
    console.log( `\n  Validating MCP Server: ${MCP_URL}\n` )

    try {
        const { status, findings, categories, entries } = await McpServerValidator.start( { endpoint: MCP_URL, timeout: 15000 } )

        console.log( `  Status: ${status ? 'PASS' : 'FAIL'}` )
        console.log( `  Findings: ${findings.length === 0 ? 'none' : ''}` )

        findings
            .forEach( ( finding ) => {
                console.log( `    - [${finding['severity']}] ${finding['code']} ${finding['location']}: ${finding['message']}` )
            } )

        console.log( '\n  Categories:' )

        Object.entries( categories )
            .forEach( ( [ key, value ] ) => {
                console.log( `    ${key}: ${value}` )
            } )

        console.log( '\n  Server Info:' )
        console.log( `    Name: ${entries['serverName']}` )
        console.log( `    Version: ${entries['serverVersion']}` )
        console.log( `    Protocol: ${entries['protocolVersion']}` )

        console.log( `\n  Tools: ${entries['tools'].length}` )

        entries['tools']
            .forEach( ( tool ) => {
                console.log( `    - ${tool['name']}: ${tool['description']}` )
            } )

        console.log( `\n  Resources: ${entries['resources'].length}` )
        console.log( `  Prompts: ${entries['prompts'].length}` )

        console.log( '\n  x402:' )
        console.log( `    Version: ${entries['x402']['version']}` )
        console.log( `    Restricted Calls: ${entries['x402']['restrictedCalls'].length}` )
        console.log( `    Networks: ${JSON.stringify( entries['x402']['networks'] )}` )
        console.log( `    Schemes: ${JSON.stringify( entries['x402']['schemes'] )}` )

        console.log( '\n  Version Branch:' )
        console.log( `    Legacy Stateful: ${entries['versionBranch']['legacyStateful']}` )
        console.log( `    Stateless RC: ${entries['versionBranch']['statelessRc']}` )
        console.log( `    Session ID: ${entries['versionBranch']['sessionId']}` )

        console.log( '\n  Task Capabilities:' )
        console.log( `    ${entries['taskCapabilities'] ? JSON.stringify( entries['taskCapabilities'] ) : 'none'}` )

        console.log( '\n  Latency:' )
        console.log( `    Ping: ${entries['latency']['ping']}ms` )
        console.log( `    ListTools: ${entries['latency']['listTools']}ms` )

        console.log( `\n  Timestamp: ${entries['timestamp']}\n` )
    } catch( error ) {
        console.error( `\n  Error: ${error['message']}\n` )
    }
}


runStart()
