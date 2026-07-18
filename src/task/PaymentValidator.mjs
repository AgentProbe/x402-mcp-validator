const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/
const ALLOWED_SCHEMES = [ 'exact', 'upto', 'batch-settlement', 'auth-capture' ]
const KNOWN_NETWORK_PREFIXES = [ 'eip155:', 'solana:' ]
const GENERIC_CAIP2_REGEX = /^[-a-z0-9]{3,8}:[-a-zA-Z0-9._%-]{1,64}$/


class PaymentValidator {


    static validate( { restrictedCalls, paymentOptions } ) {
        const findings = []
        const validPaymentOptions = []

        restrictedCalls
            .forEach( ( restrictedCall, i ) => {
                const { paymentRequired } = restrictedCall

                if( paymentRequired === undefined || paymentRequired === null ) {
                    findings.push( { code: 'PAY-001', severity: 'error', location: `restrictedCalls[${i}]`, message: 'PaymentRequired data is missing' } )

                    return
                }

                if( typeof paymentRequired !== 'object' || Array.isArray( paymentRequired ) ) {
                    findings.push( { code: 'PAY-002', severity: 'error', location: `restrictedCalls[${i}]`, message: 'PaymentRequired is not an object' } )

                    return
                }

                PaymentValidator.#validateVersion( { paymentRequired, index: i, findings } )
                PaymentValidator.#validateResource( { paymentRequired, index: i, findings } )
                PaymentValidator.#validateAccepts( { paymentRequired, index: i, findings, validPaymentOptions } )
            } )

        return { findings, validPaymentOptions }
    }


    static #validateVersion( { paymentRequired, index, findings } ) {
        const prefix = `restrictedCalls[${index}]`

        if( paymentRequired['x402Version'] === undefined ) {
            findings.push( { code: 'PAY-010', severity: 'error', location: `${prefix}.x402Version`, message: 'Missing required field' } )

            return
        }

        if( typeof paymentRequired['x402Version'] !== 'number' ) {
            findings.push( { code: 'PAY-011', severity: 'error', location: `${prefix}.x402Version`, message: 'Must be a number' } )

            return
        }

        if( paymentRequired['x402Version'] !== 2 ) {
            findings.push( { code: 'PAY-012', severity: 'error', location: `${prefix}.x402Version`, message: `Expected 2, got ${paymentRequired['x402Version']}` } )
        }
    }


    static #validateResource( { paymentRequired, index, findings } ) {
        const prefix = `restrictedCalls[${index}]`
        const resource = paymentRequired['resource']

        if( resource === undefined || resource === null ) {
            return
        }

        if( typeof resource === 'string' ) {
            PaymentValidator.#validateResourceString( { resource, prefix, findings } )

            return
        }

        if( typeof resource !== 'object' || Array.isArray( resource ) ) {
            findings.push( { code: 'PAY-020', severity: 'error', location: `${prefix}.resource`, message: 'Must be a string or object' } )

            return
        }

        PaymentValidator.#validateResourceObject( { resource, prefix, findings } )
    }


    static #validateResourceString( { resource, prefix, findings } ) {
        if( resource.trim() === '' ) {
            findings.push( { code: 'PAY-021', severity: 'error', location: `${prefix}.resource`, message: 'Must not be empty' } )
        }
    }


    static #validateResourceObject( { resource, prefix, findings } ) {
        const url = resource['url']

        if( url === undefined ) {
            findings.push( { code: 'PAY-021', severity: 'error', location: `${prefix}.resource.url`, message: 'Missing value' } )
        } else if( typeof url !== 'string' ) {
            findings.push( { code: 'PAY-022', severity: 'error', location: `${prefix}.resource.url`, message: 'Must be a string' } )
        } else {
            try {
                new URL( url )
            } catch( _e ) {
                findings.push( { code: 'PAY-023', severity: 'error', location: `${prefix}.resource.url`, message: 'Invalid URL format' } )
            }
        }

        const knownFields = [ 'url' ]

        Object.keys( resource )
            .filter( ( key ) => !knownFields.includes( key ) )
            .forEach( ( key ) => {
                findings.push( { code: 'PAY-024', severity: 'warning', location: `${prefix}.resource.${key}`, message: 'Unknown field' } )
            } )
    }


    static #validateAccepts( { paymentRequired, index, findings, validPaymentOptions } ) {
        const prefix = `restrictedCalls[${index}]`
        const accepts = paymentRequired['accepts']

        if( accepts === undefined ) {
            findings.push( { code: 'PAY-030', severity: 'error', location: `${prefix}.accepts`, message: 'Missing required field' } )

            return
        }

        if( !Array.isArray( accepts ) ) {
            findings.push( { code: 'PAY-031', severity: 'error', location: `${prefix}.accepts`, message: 'Must be an array' } )

            return
        }

        if( accepts.length === 0 ) {
            findings.push( { code: 'PAY-032', severity: 'error', location: `${prefix}.accepts`, message: 'Is empty array' } )

            return
        }

        accepts
            .forEach( ( option, j ) => {
                const { valid } = PaymentValidator.#validatePaymentOption( { option, callIndex: index, optIndex: j, findings } )

                if( valid ) {
                    validPaymentOptions.push( option )
                }
            } )
    }


    static #validatePaymentOption( { option, callIndex, optIndex, findings } ) {
        const prefix = `restrictedCalls[${callIndex}].accepts[${optIndex}]`
        const initialLength = findings.length

        PaymentValidator.#validateScheme( { option, prefix, findings } )
        PaymentValidator.#validateNetworkField( { option, prefix, findings } )
        PaymentValidator.#validateAmount( { amount: option['amount'], prefix: `${prefix}.amount`, findings } )
        PaymentValidator.#validateAsset( { option, prefix, findings } )
        PaymentValidator.#validatePayTo( { option, prefix, findings } )
        PaymentValidator.#validateMaxTimeout( { option, prefix, findings } )
        PaymentValidator.#validateExtra( { option, prefix, findings } )

        const valid = findings.length === initialLength

        return { valid }
    }


    static #validateScheme( { option, prefix, findings } ) {
        const scheme = option['scheme']

        if( scheme === undefined ) {
            findings.push( { code: 'PAY-040', severity: 'error', location: `${prefix}.scheme`, message: 'Missing value' } )

            return
        }

        if( typeof scheme !== 'string' ) {
            findings.push( { code: 'PAY-041', severity: 'error', location: `${prefix}.scheme`, message: 'Must be a string' } )

            return
        }

        if( !ALLOWED_SCHEMES.includes( scheme ) ) {
            findings.push( { code: 'PAY-042', severity: 'error', location: `${prefix}.scheme`, message: `Invalid value "${scheme}". Allowed are ${ALLOWED_SCHEMES.join( ', ' )}` } )
        }
    }


    static #validateNetworkField( { option, prefix, findings } ) {
        const network = option['network']

        if( network === undefined ) {
            findings.push( { code: 'PAY-050', severity: 'error', location: `${prefix}.network`, message: 'Missing value' } )

            return
        }

        if( typeof network !== 'string' ) {
            findings.push( { code: 'PAY-051', severity: 'error', location: `${prefix}.network`, message: 'Must be a string' } )

            return
        }

        PaymentValidator.#validateNetwork( { network, prefix: `${prefix}.network`, findings } )
    }


    static #validateNetwork( { network, prefix, findings } ) {
        const matchedPrefix = KNOWN_NETWORK_PREFIXES
            .find( ( p ) => network.startsWith( p ) )

        if( matchedPrefix ) {
            const afterPrefix = network.slice( matchedPrefix.length )

            if( afterPrefix === '' ) {
                findings.push( { code: 'PAY-053', severity: 'error', location: prefix, message: 'Missing chain ID after prefix' } )
            }

            return
        }

        // Unknown namespace: syntactically valid CAIP-2 is accepted as info (PAY-054); malformed stays a hard error (PAY-052)
        if( GENERIC_CAIP2_REGEX.test( network ) ) {
            findings.push( { code: 'PAY-054', severity: 'info', location: prefix, message: `Unknown prefix but valid generic CAIP-2 syntax "${network}"` } )

            return
        }

        findings.push( { code: 'PAY-052', severity: 'error', location: prefix, message: `Unknown prefix "${network}". Expected "eip155:*" or "solana:*"` } )
    }


    static #validateAmount( { amount, prefix, findings } ) {
        if( amount === undefined ) {
            findings.push( { code: 'PAY-060', severity: 'error', location: prefix, message: 'Missing value' } )

            return
        }

        if( typeof amount !== 'string' ) {
            findings.push( { code: 'PAY-061', severity: 'error', location: prefix, message: 'Must be a string' } )

            return
        }

        const parsed = Number( amount )

        if( Number.isNaN( parsed ) ) {
            findings.push( { code: 'PAY-062', severity: 'error', location: prefix, message: 'Must be a numeric string' } )

            return
        }

        if( parsed <= 0 ) {
            findings.push( { code: 'PAY-063', severity: 'error', location: prefix, message: 'Must be positive' } )
        }
    }


    static #validateAsset( { option, prefix, findings } ) {
        const asset = option['asset']

        if( asset === undefined ) {
            findings.push( { code: 'PAY-070', severity: 'error', location: `${prefix}.asset`, message: 'Missing value' } )

            return
        }

        if( typeof asset !== 'string' ) {
            findings.push( { code: 'PAY-071', severity: 'error', location: `${prefix}.asset`, message: 'Must be a string' } )

            return
        }

        PaymentValidator.#validateEvmAddress( { address: asset, field: 'asset', prefix, findings } )
    }


    static #validatePayTo( { option, prefix, findings } ) {
        const payTo = option['payTo']

        if( payTo === undefined ) {
            findings.push( { code: 'PAY-080', severity: 'error', location: `${prefix}.payTo`, message: 'Missing value' } )

            return
        }

        if( typeof payTo !== 'string' ) {
            findings.push( { code: 'PAY-081', severity: 'error', location: `${prefix}.payTo`, message: 'Must be a string' } )

            return
        }

        PaymentValidator.#validateEvmAddress( { address: payTo, field: 'payTo', prefix, findings } )

        if( EVM_ADDRESS_REGEX.test( payTo ) ) {
            const { checksummed } = PaymentValidator.#isChecksummed( { address: payTo } )

            if( !checksummed ) {
                findings.push( { code: 'PAY-083', severity: 'warning', location: `${prefix}.payTo`, message: 'Not checksummed' } )
            }
        }
    }


    static #validateEvmAddress( { address, field, prefix, findings } ) {
        if( !EVM_ADDRESS_REGEX.test( address ) ) {
            const code = field === 'asset' ? 'PAY-072' : 'PAY-082'
            findings.push( { code, severity: 'error', location: `${prefix}.${field}`, message: 'Invalid EVM address format' } )
        }
    }


    static #isChecksummed( { address } ) {
        const checksummed = address !== address.toLowerCase() && address !== address.toUpperCase()

        return { checksummed }
    }


    static #validateMaxTimeout( { option, prefix, findings } ) {
        const maxTimeoutSeconds = option['maxTimeoutSeconds']

        if( maxTimeoutSeconds === undefined ) {
            findings.push( { code: 'PAY-090', severity: 'error', location: `${prefix}.maxTimeoutSeconds`, message: 'Missing value' } )

            return
        }

        if( typeof maxTimeoutSeconds !== 'number' ) {
            findings.push( { code: 'PAY-091', severity: 'error', location: `${prefix}.maxTimeoutSeconds`, message: 'Must be a number' } )

            return
        }

        if( maxTimeoutSeconds <= 0 ) {
            findings.push( { code: 'PAY-092', severity: 'error', location: `${prefix}.maxTimeoutSeconds`, message: 'Must be greater than 0' } )
        }
    }


    static #validateExtra( { option, prefix, findings } ) {
        const extra = option['extra']

        if( extra === undefined ) {
            return
        }

        if( typeof extra !== 'object' || extra === null || Array.isArray( extra ) ) {
            findings.push( { code: 'PAY-100', severity: 'info', location: `${prefix}.extra`, message: 'Must be an object' } )

            return
        }

        const network = option['network']
        const isEvm = typeof network === 'string' && network.startsWith( 'eip155:' )

        if( isEvm && !extra['name'] ) {
            findings.push( { code: 'PAY-101', severity: 'info', location: `${prefix}.extra.name`, message: 'Missing (recommended for EVM)' } )
        }

        if( isEvm && !extra['version'] ) {
            findings.push( { code: 'PAY-102', severity: 'info', location: `${prefix}.extra.version`, message: 'Missing (recommended for EIP-3009)' } )
        }
    }
}


export { PaymentValidator }
