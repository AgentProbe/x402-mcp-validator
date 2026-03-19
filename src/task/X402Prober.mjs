class X402Prober {


    static async probe( { client, tools, timeout } ) {
        const messages = []
        const restrictedCalls = []
        const paymentOptions = []

        if( !Array.isArray( tools ) || tools.length === 0 ) {
            messages.push( 'PRB-005 probe: No tools available to probe' )

            return { status: false, messages, restrictedCalls, paymentOptions }
        }

        await X402Prober.#probeSequentially( { client, toolsToProbe: tools, index: 0, messages, restrictedCalls, paymentOptions, timeout } )

        const status = true

        return { status, messages, restrictedCalls, paymentOptions }
    }


    static async #probeSequentially( { client, toolsToProbe, index, messages, restrictedCalls, paymentOptions, timeout } ) {
        if( index >= toolsToProbe.length ) {
            return
        }

        const tool = toolsToProbe[index]
        const { restricted, paymentRequired, detectionCode } = await X402Prober.#probeTool( { client, tool, timeout } )

        if( restricted && paymentRequired ) {
            const toolName = tool['name']
            restrictedCalls.push( { toolName, paymentRequired } )

            const accepts = paymentRequired['accepts']

            if( Array.isArray( accepts ) ) {
                accepts
                    .forEach( ( option ) => {
                        paymentOptions.push( option )
                    } )
            }

            if( detectionCode === 'PRB-007' ) {
                messages.push( `PRB-007 probe(${toolName}): x402 payment detected (spec-konform)` )
            } else if( detectionCode === 'PRB-008' ) {
                messages.push( `PRB-008 probe(${toolName}): x402 payment detected via HTTP 402 response (transport mixing)` )
            } else if( detectionCode === 'PRB-009' ) {
                messages.push( `PRB-009 probe(${toolName}): x402 payment detected via non-standard structuredContent` )
            } else if( detectionCode === 'PRB-010' ) {
                messages.push( `PRB-010 probe(${toolName}): x402 API endpoint redirect detected` )
            } else if( detectionCode === 'PRB-006' ) {
                messages.push( `PRB-006 probe(${toolName}): x402 detected via legacy error code — server may not be spec-compliant` )
            }
        } else if( restricted === null ) {
            const toolName = tool['name']
            messages.push( `PRB-004 probe(${toolName}): Unexpected exception` )
        }

        await X402Prober.#probeSequentially( { client, toolsToProbe, index: index + 1, messages, restrictedCalls, paymentOptions, timeout } )
    }


    static async #probeTool( { client, tool, timeout } ) {
        const toolName = tool['name']
        const args = X402Prober.#buildMinimalArgs( { tool } )

        try {
            const result = await client.callTool( { name: toolName, arguments: args }, { timeout } )

            const { paymentRequired, detectionCode } = X402Prober.#extractPaymentFromResult( { result } )

            if( paymentRequired ) {
                return { restricted: true, paymentRequired, detectionCode }
            }

            return { restricted: false, paymentRequired: null, detectionCode: null }
        } catch( error ) {
            const { is402, paymentRequired, detectionCode } = X402Prober.#parse402Error( { error } )

            if( is402 ) {
                return { restricted: true, paymentRequired, detectionCode }
            }

            return { restricted: null, paymentRequired: null, detectionCode: null }
        }
    }


    static #extractPaymentFromResult( { result } ) {
        if( !result ) {
            return { paymentRequired: null, detectionCode: null }
        }

        /* PRB-007: Spec-konform — isError:true + structuredContent/content[0].text */

        if( result.isError ) {
            if( result.structuredContent ) {
                const sc = result.structuredContent

                if( sc.x402Version !== undefined && Array.isArray( sc.accepts ) ) {
                    return { paymentRequired: sc, detectionCode: 'PRB-007' }
                }
            }

            const content = result.content

            if( Array.isArray( content ) && content.length > 0 ) {
                const first = content[0]

                if( first && first.type === 'text' && first.text ) {
                    try {
                        const parsed = JSON.parse( first.text )

                        if( parsed && parsed.x402Version !== undefined && Array.isArray( parsed.accepts ) ) {
                            return { paymentRequired: parsed, detectionCode: 'PRB-007' }
                        }
                    } catch( _e ) {
                    }
                }
            }
        }

        /* PRB-009: structuredContent.paymentRequired Base64 (isError may be false) */

        if( result.structuredContent ) {
            const sc = result.structuredContent
            const b64 = sc.paymentRequired || sc.payment_required

            if( typeof b64 === 'string' && b64.length > 20 ) {
                try {
                    const padded = b64 + '='.repeat( ( 4 - b64.length % 4 ) % 4 )
                    const decoded = JSON.parse( Buffer.from( padded, 'base64' ).toString( 'utf-8' ) )

                    if( decoded && decoded.x402Version !== undefined && Array.isArray( decoded.accepts ) ) {
                        return { paymentRequired: decoded, detectionCode: 'PRB-009' }
                    }
                } catch( _e ) {
                }
            }

            if( sc.status === 402 && sc.x402Version !== undefined ) {
                return { paymentRequired: sc, detectionCode: 'PRB-009' }
            }
        }

        /* PRB-010: x402 API URL redirect in content */

        if( !result.isError && result.content && Array.isArray( result.content ) ) {
            const text = result.content.map( ( c ) => c.text || '' ).join( ' ' )

            if( text.includes( 'x402' ) && ( text.includes( 'endpoint' ) || text.includes( 'payment' ) ) ) {
                try {
                    const parsed = JSON.parse( result.content[0].text )

                    if( parsed.endpoint && parsed.payment ) {
                        return { paymentRequired: { redirect: parsed.endpoint, info: parsed }, detectionCode: 'PRB-010' }
                    }
                } catch( _e ) {
                }
            }
        }

        return { paymentRequired: null, detectionCode: null }
    }


    static #buildMinimalArgs( { tool } ) {
        const schema = tool['inputSchema']

        if( !schema || typeof schema !== 'object' ) {
            return {}
        }

        const properties = schema['properties'] || {}
        const required = schema['required'] || []
        const args = {}

        required
            .forEach( ( key ) => {
                const prop = properties[key]

                if( !prop ) {
                    args[key] = ''

                    return
                }

                const type = prop['type']

                if( type === 'string' ) {
                    args[key] = 'test'
                } else if( type === 'number' || type === 'integer' ) {
                    args[key] = 0
                } else if( type === 'boolean' ) {
                    args[key] = false
                } else if( type === 'array' ) {
                    args[key] = []
                } else if( type === 'object' ) {
                    args[key] = {}
                } else {
                    args[key] = ''
                }
            } )

        return args
    }


    static #parse402Error( { error } ) {
        const code = error['code'] || error['statusCode']
        const is402Code = code === 402 || code === -32402

        if( !is402Code ) {
            return { is402: false, paymentRequired: null, detectionCode: null }
        }

        /* PRB-006: Legacy — error.data has payment object */

        const data = error['data']

        if( data !== undefined && data !== null && typeof data === 'object' && !Array.isArray( data ) ) {
            if( data.x402Version !== undefined || data.accepts ) {
                return { is402: true, paymentRequired: data, detectionCode: 'PRB-006' }
            }
        }

        /* PRB-008: error.message contains JSON from HTTP 402 body (transport mixing) */

        const message = error['message'] || ''
        const prefix = 'Streamable HTTP error: Error POSTing to endpoint: '
        const jsonStart = message.indexOf( prefix )

        if( jsonStart !== -1 ) {
            const jsonStr = message.slice( jsonStart + prefix.length )

            try {
                const parsed = JSON.parse( jsonStr )

                if( parsed && ( parsed.x402Version !== undefined || parsed.accepts || parsed.error === 'Payment Required' ) ) {
                    return { is402: true, paymentRequired: parsed, detectionCode: 'PRB-008' }
                }
            } catch( _e ) {
            }
        }

        /* Fallback: try to find any JSON object in message */

        const braceStart = message.indexOf( '{' )

        if( braceStart !== -1 ) {
            try {
                const parsed = JSON.parse( message.slice( braceStart ) )

                if( parsed && ( parsed.x402Version !== undefined || parsed.accepts ) ) {
                    return { is402: true, paymentRequired: parsed, detectionCode: 'PRB-008' }
                }
            } catch( _e ) {
            }
        }

        return { is402: true, paymentRequired: null, detectionCode: 'PRB-006' }
    }
}


export { X402Prober }
