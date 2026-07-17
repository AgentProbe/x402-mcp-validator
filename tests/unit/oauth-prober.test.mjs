import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { OAuthProber } from '../../src/task/OAuthProber.mjs'
import { TEST_ENDPOINT } from '../helpers/config.mjs'


const MOCK_PROTECTED_RESOURCE_METADATA = {
    resource: 'https://mcp.example.com/mcp',
    authorization_servers: [ 'https://auth.example.com' ],
    scopes_supported: [ 'mcp:tools', 'mcp:resources' ]
}

const MOCK_AUTH_SERVER_METADATA = {
    issuer: 'https://auth.example.com',
    authorization_endpoint: 'https://auth.example.com/oauth/authorize',
    token_endpoint: 'https://auth.example.com/oauth/token',
    registration_endpoint: 'https://auth.example.com/oauth/register',
    revocation_endpoint: 'https://auth.example.com/oauth/revoke',
    response_types_supported: [ 'code' ],
    grant_types_supported: [ 'authorization_code', 'refresh_token' ],
    code_challenge_methods_supported: [ 'S256' ],
    scopes_supported: [ 'mcp:tools', 'mcp:resources' ],
    client_id_metadata_document_supported: true,
    mcp_version: '2025-11-25'
}

const MOCK_AUTH_SERVER_NO_PKCE = {
    ...MOCK_AUTH_SERVER_METADATA,
    code_challenge_methods_supported: [ 'plain' ]
}

const MOCK_AUTH_SERVER_NO_REGISTRATION = {
    ...MOCK_AUTH_SERVER_METADATA,
    registration_endpoint: undefined,
    client_id_metadata_document_supported: false
}


describe( 'OAuthProber', () => {
    const originalFetch = globalThis.fetch


    afterEach( () => {
        globalThis.fetch = originalFetch
    } )


    describe( 'Server without OAuth', () => {

        test( 'returns supportsOAuth false when all well-known endpoints return 404', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: false,
                status: 404
            } )

            const { supportsOAuth, findings, oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( false )
            expect( findings.length ).toBe( 0 )
            expect( oauthEntries['issuer'] ).toBeNull()
            expect( oauthEntries['authorizationEndpoint'] ).toBeNull()
        } )


        test( 'returns empty oauthEntries when no OAuth is detected', async () => {
            globalThis.fetch = jest.fn().mockResolvedValue( {
                ok: false,
                status: 404
            } )

            const { oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( oauthEntries['scopesSupported'] ).toEqual( [] )
            expect( oauthEntries['grantTypesSupported'] ).toEqual( [] )
            expect( oauthEntries['pkceMethodsSupported'] ).toEqual( [] )
            expect( oauthEntries['protectedResourceMetadataUrl'] ).toBeNull()
        } )
    } )


    describe( 'Server with full OAuth', () => {

        beforeEach( () => {
            globalThis.fetch = jest.fn().mockImplementation( ( url ) => {
                if( url.includes( 'oauth-protected-resource' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_PROTECTED_RESOURCE_METADATA )
                    } )
                }

                if( url.includes( 'oauth-authorization-server' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_AUTH_SERVER_METADATA )
                    } )
                }

                return Promise.resolve( { ok: false, status: 404 } )
            } )
        } )


        test( 'returns supportsOAuth true', async () => {
            const { supportsOAuth } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( true )
        } )


        test( 'returns AUTH-010 informational finding', async () => {
            const { findings } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            const auth010 = findings
                .find( ( finding ) => finding['code'] === 'AUTH-010' )

            expect( auth010 ).toEqual( { code: 'AUTH-010', severity: 'info', location: 'oauth', message: 'Server requires authentication' } )
        } )


        test( 'returns AUTH-011 with scopes', async () => {
            const { findings } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            const hasAuth011 = findings
                .some( ( finding ) => finding['code'] === 'AUTH-011' )

            expect( hasAuth011 ).toBe( true )
        } )


        test( 'populates oauthEntries with server metadata', async () => {
            const { oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( oauthEntries['issuer'] ).toBe( 'https://auth.example.com' )
            expect( oauthEntries['authorizationEndpoint'] ).toBe( 'https://auth.example.com/oauth/authorize' )
            expect( oauthEntries['tokenEndpoint'] ).toBe( 'https://auth.example.com/oauth/token' )
            expect( oauthEntries['registrationEndpoint'] ).toBe( 'https://auth.example.com/oauth/register' )
            expect( oauthEntries['revocationEndpoint'] ).toBe( 'https://auth.example.com/oauth/revoke' )
        } )


        test( 'populates oauthEntries with PKCE and grant types', async () => {
            const { oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( oauthEntries['pkceMethodsSupported'] ).toContain( 'S256' )
            expect( oauthEntries['grantTypesSupported'] ).toContain( 'authorization_code' )
            expect( oauthEntries['responseTypesSupported'] ).toContain( 'code' )
        } )


        test( 'populates oauthEntries with scopes and MCP version', async () => {
            const { oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( oauthEntries['scopesSupported'] ).toContain( 'mcp:tools' )
            expect( oauthEntries['clientIdMetadataDocumentSupported'] ).toBe( true )
            expect( oauthEntries['mcpVersion'] ).toBe( '2025-11-25' )
        } )


        test( 'records protectedResourceMetadataUrl', async () => {
            const { oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( oauthEntries['protectedResourceMetadataUrl'] ).toContain( 'oauth-protected-resource' )
        } )


        test( 'does not produce AUTH-001 to AUTH-005 findings', async () => {
            const { findings } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            const warnings = findings
                .filter( ( finding ) => [ 'AUTH-001', 'AUTH-002', 'AUTH-003', 'AUTH-004', 'AUTH-005' ].includes( finding['code'] ) )

            expect( warnings.length ).toBe( 0 )
        } )
    } )


    describe( 'Server with OAuth but without PKCE', () => {

        test( 'returns AUTH-003 finding when PKCE S256 not supported', async () => {
            globalThis.fetch = jest.fn().mockImplementation( ( url ) => {
                if( url.includes( 'oauth-protected-resource' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_PROTECTED_RESOURCE_METADATA )
                    } )
                }

                if( url.includes( 'oauth-authorization-server' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_AUTH_SERVER_NO_PKCE )
                    } )
                }

                return Promise.resolve( { ok: false, status: 404 } )
            } )

            const { findings, supportsOAuth } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( true )

            const hasAuth003 = findings
                .some( ( finding ) => finding['code'] === 'AUTH-003' )

            expect( hasAuth003 ).toBe( true )
        } )
    } )


    describe( 'Server with OAuth but without registration', () => {

        test( 'returns AUTH-005 when no client registration mechanism available', async () => {
            globalThis.fetch = jest.fn().mockImplementation( ( url ) => {
                if( url.includes( 'oauth-protected-resource' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_PROTECTED_RESOURCE_METADATA )
                    } )
                }

                if( url.includes( 'oauth-authorization-server' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_AUTH_SERVER_NO_REGISTRATION )
                    } )
                }

                return Promise.resolve( { ok: false, status: 404 } )
            } )

            const { findings } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            const hasAuth005 = findings
                .some( ( finding ) => finding['code'] === 'AUTH-005' )

            expect( hasAuth005 ).toBe( true )
        } )
    } )


    describe( 'Protected Resource Metadata without authorization_servers', () => {

        test( 'returns AUTH-004 finding', async () => {
            const prmWithoutServers = {
                resource: 'https://mcp.example.com/mcp',
                scopes_supported: [ 'mcp:tools' ]
            }

            globalThis.fetch = jest.fn().mockImplementation( ( url ) => {
                if( url.includes( 'oauth-protected-resource' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( prmWithoutServers )
                    } )
                }

                return Promise.resolve( { ok: false, status: 404 } )
            } )

            const { findings, supportsOAuth } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( true )

            const hasAuth004 = findings
                .some( ( finding ) => finding['code'] === 'AUTH-004' )

            expect( hasAuth004 ).toBe( true )
        } )
    } )


    describe( 'OIDC Fallback', () => {

        test( 'discovers auth server via openid-configuration when RFC8414 fails', async () => {
            globalThis.fetch = jest.fn().mockImplementation( ( url ) => {
                if( url.includes( 'oauth-protected-resource' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_PROTECTED_RESOURCE_METADATA )
                    } )
                }

                if( url.includes( 'oauth-authorization-server' ) ) {
                    return Promise.resolve( { ok: false, status: 404 } )
                }

                if( url.includes( 'openid-configuration' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_AUTH_SERVER_METADATA )
                    } )
                }

                return Promise.resolve( { ok: false, status: 404 } )
            } )

            const { supportsOAuth, oauthEntries } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( true )
            expect( oauthEntries['issuer'] ).toBe( 'https://auth.example.com' )
            expect( oauthEntries['authorizationEndpoint'] ).toBe( 'https://auth.example.com/oauth/authorize' )
        } )
    } )


    describe( 'Timeout handling', () => {

        test( 'returns gracefully when fetch times out', async () => {
            globalThis.fetch = jest.fn().mockImplementation( () => {
                return new Promise( ( _resolve, reject ) => {
                    setTimeout( () => { reject( new Error( 'AbortError' ) ) }, 50 )
                } )
            } )

            const { supportsOAuth, findings } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 100 } )

            expect( supportsOAuth ).toBe( false )
            expect( findings.length ).toBe( 0 )
        } )


        test( 'returns gracefully when fetch throws network error', async () => {
            globalThis.fetch = jest.fn().mockRejectedValue( new Error( 'ECONNREFUSED' ) )

            const { supportsOAuth, findings } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( false )
            expect( findings.length ).toBe( 0 )
        } )
    } )


    describe( 'Auth Server Metadata not found', () => {

        test( 'returns AUTH-002 when auth server metadata is not available', async () => {
            globalThis.fetch = jest.fn().mockImplementation( ( url ) => {
                if( url.includes( 'oauth-protected-resource' ) ) {
                    return Promise.resolve( {
                        ok: true,
                        headers: { get: () => 'application/json' },
                        json: () => Promise.resolve( MOCK_PROTECTED_RESOURCE_METADATA )
                    } )
                }

                return Promise.resolve( { ok: false, status: 404 } )
            } )

            const { findings, supportsOAuth } = await OAuthProber.probe( { endpoint: TEST_ENDPOINT, timeout: 5000 } )

            expect( supportsOAuth ).toBe( true )

            const hasAuth002 = findings
                .some( ( finding ) => finding['code'] === 'AUTH-002' )

            expect( hasAuth002 ).toBe( true )
        } )
    } )
} )
