const EMPTY_OAUTH_ENTRIES = {
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


class OAuthProber {


    static async probe( { endpoint, timeout } ) {
        const findings = []
        const oauthEntries = { ...EMPTY_OAUTH_ENTRIES }

        const { protectedResource, prmUrl } = await OAuthProber.#probeProtectedResourceMetadata( { endpoint, timeout, findings } )
        const issuer = OAuthProber.#extractIssuer( { protectedResource } )

        if( prmUrl ) {
            oauthEntries['protectedResourceMetadataUrl'] = prmUrl
        }

        const { authServerMetadata, discoveryUrl } = await OAuthProber.#probeAuthServerMetadata( { issuer, timeout, findings } )

        OAuthProber.#validatePkce( { authServerMetadata, findings } )
        OAuthProber.#validateClientRegistration( { authServerMetadata, findings } )
        OAuthProber.#validateScopes( { protectedResource, authServerMetadata, findings } )

        const { supportsOAuth } = OAuthProber.#assessOverall( { protectedResource, authServerMetadata } )

        if( supportsOAuth ) {
            findings.push( { code: 'AUTH-010', severity: 'info', location: 'oauth', message: 'Server requires authentication' } )
        }

        OAuthProber.#populateEntries( { oauthEntries, protectedResource, authServerMetadata } )

        return { findings, supportsOAuth, protectedResource, authServer: authServerMetadata, oauthEntries }
    }


    static async #probeProtectedResourceMetadata( { endpoint, timeout, findings } ) {
        const { origin, pathname } = new URL( endpoint )

        const pathSpecificUrl = `${origin}/.well-known/oauth-protected-resource${pathname}`
        const rootUrl = `${origin}/.well-known/oauth-protected-resource`

        const urls = [ pathSpecificUrl, rootUrl ]
            .filter( ( url, index, self ) => self.indexOf( url ) === index )

        const { metadata, url: prmUrl } = await OAuthProber.#tryFetchJson( { urls, timeout } )

        if( !metadata ) {
            return { protectedResource: null, prmUrl: null }
        }

        if( !metadata['authorization_servers'] || !Array.isArray( metadata['authorization_servers'] ) || metadata['authorization_servers'].length === 0 ) {
            findings.push( { code: 'AUTH-004', severity: 'info', location: 'oauth', message: 'Missing authorization_servers in Protected Resource Metadata' } )
        }

        return { protectedResource: metadata, prmUrl }
    }


    static #extractIssuer( { protectedResource } ) {
        if( !protectedResource ) {
            return null
        }

        const servers = protectedResource['authorization_servers']

        if( !Array.isArray( servers ) || servers.length === 0 ) {
            return null
        }

        const issuer = servers[0]

        return issuer
    }


    static async #probeAuthServerMetadata( { issuer, timeout, findings } ) {
        if( !issuer ) {
            return { authServerMetadata: null, discoveryUrl: null }
        }

        const urls = OAuthProber.#buildAuthServerUrls( { issuer } )

        const { metadata, url: discoveryUrl } = await OAuthProber.#tryFetchJson( { urls, timeout } )

        if( !metadata ) {
            findings.push( { code: 'AUTH-002', severity: 'info', location: 'oauth', message: 'Authorization Server Metadata not found (RFC8414)' } )

            return { authServerMetadata: null, discoveryUrl: null }
        }

        const requiredFields = [ 'authorization_endpoint', 'token_endpoint', 'response_types_supported' ]

        const missingFields = requiredFields
            .filter( ( field ) => !metadata[field] )

        if( missingFields.length > 0 ) {
            findings.push( { code: 'AUTH-002', severity: 'info', location: 'oauth', message: `Authorization Server Metadata incomplete — missing ${missingFields.join( ', ' )}` } )
        }

        return { authServerMetadata: metadata, discoveryUrl }
    }


    static #buildAuthServerUrls( { issuer } ) {
        const parsed = new URL( issuer )
        const urls = []

        if( parsed.pathname === '/' || parsed.pathname === '' ) {
            urls.push( `${issuer}/.well-known/oauth-authorization-server` )
            urls.push( `${issuer}/.well-known/openid-configuration` )
        } else {
            const origin = parsed.origin
            const path = parsed.pathname

            urls.push( `${origin}/.well-known/oauth-authorization-server${path}` )
            urls.push( `${origin}/.well-known/oauth-authorization-server` )
            urls.push( `${origin}/.well-known/openid-configuration` )
        }

        const uniqueUrls = urls
            .filter( ( url, index, self ) => self.indexOf( url ) === index )

        return uniqueUrls
    }


    static #validatePkce( { authServerMetadata, findings } ) {
        if( !authServerMetadata ) {
            return
        }

        const methods = authServerMetadata['code_challenge_methods_supported']

        if( !Array.isArray( methods ) || !methods.includes( 'S256' ) ) {
            findings.push( { code: 'AUTH-003', severity: 'info', location: 'oauth', message: 'PKCE S256 not supported (MCP Spec MUST)' } )
        }
    }


    static #validateClientRegistration( { authServerMetadata, findings } ) {
        if( !authServerMetadata ) {
            return
        }

        const hasRegistrationEndpoint = !!authServerMetadata['registration_endpoint']
        const hasClientIdMetadataDoc = authServerMetadata['client_id_metadata_document_supported'] === true

        if( !hasRegistrationEndpoint && !hasClientIdMetadataDoc ) {
            findings.push( { code: 'AUTH-005', severity: 'info', location: 'oauth', message: 'No client registration mechanism available' } )
        }
    }


    static #validateScopes( { protectedResource, authServerMetadata, findings } ) {
        const prmScopes = ( protectedResource && Array.isArray( protectedResource['scopes_supported'] ) )
            ? protectedResource['scopes_supported']
            : []

        const asScopes = ( authServerMetadata && Array.isArray( authServerMetadata['scopes_supported'] ) )
            ? authServerMetadata['scopes_supported']
            : []

        const allScopes = [ ...new Set( [ ...prmScopes, ...asScopes ] ) ]

        if( allScopes.length > 0 ) {
            findings.push( { code: 'AUTH-011', severity: 'info', location: 'oauth', message: `Scopes found — ${allScopes.join( ', ' )}` } )
        }
    }


    static #assessOverall( { protectedResource, authServerMetadata } ) {
        const supportsOAuth = protectedResource !== null || authServerMetadata !== null

        return { supportsOAuth }
    }


    static #populateEntries( { oauthEntries, protectedResource, authServerMetadata } ) {
        if( authServerMetadata ) {
            oauthEntries['issuer'] = authServerMetadata['issuer'] || null
            oauthEntries['authorizationEndpoint'] = authServerMetadata['authorization_endpoint'] || null
            oauthEntries['tokenEndpoint'] = authServerMetadata['token_endpoint'] || null
            oauthEntries['registrationEndpoint'] = authServerMetadata['registration_endpoint'] || null
            oauthEntries['revocationEndpoint'] = authServerMetadata['revocation_endpoint'] || null
            oauthEntries['grantTypesSupported'] = authServerMetadata['grant_types_supported'] || []
            oauthEntries['responseTypesSupported'] = authServerMetadata['response_types_supported'] || []
            oauthEntries['pkceMethodsSupported'] = authServerMetadata['code_challenge_methods_supported'] || []
            oauthEntries['clientIdMetadataDocumentSupported'] = authServerMetadata['client_id_metadata_document_supported'] === true
            oauthEntries['mcpVersion'] = authServerMetadata['mcp_version'] || null
        }

        if( protectedResource && Array.isArray( protectedResource['scopes_supported'] ) ) {
            oauthEntries['scopesSupported'] = protectedResource['scopes_supported']
        } else if( authServerMetadata && Array.isArray( authServerMetadata['scopes_supported'] ) ) {
            oauthEntries['scopesSupported'] = authServerMetadata['scopes_supported']
        }
    }


    static async #tryFetchJson( { urls, timeout } ) {
        const controller = new AbortController()
        const timer = setTimeout( () => { controller.abort() }, timeout )

        try {
            const result = await OAuthProber.#fetchSequentially( { urls, index: 0, signal: controller.signal } )

            clearTimeout( timer )

            return result
        } catch( _error ) {
            clearTimeout( timer )

            return { metadata: null, url: null }
        }
    }


    static async #fetchSequentially( { urls, index, signal } ) {
        if( index >= urls.length ) {
            return { metadata: null, url: null }
        }

        const url = urls[index]

        try {
            const response = await fetch( url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal
            } )

            if( response.ok ) {
                const contentType = response.headers.get( 'content-type' ) || ''

                if( contentType.includes( 'application/json' ) ) {
                    const metadata = await response.json()

                    return { metadata, url }
                }
            }
        } catch( _error ) {
            // Fetch failed for this URL, try next
        }

        const result = await OAuthProber.#fetchSequentially( { urls, index: index + 1, signal } )

        return result
    }
}


export { OAuthProber, EMPTY_OAUTH_ENTRIES }
