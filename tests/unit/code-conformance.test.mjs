import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'

/* Code-conformance gate (Memo 022, PRD-012, F13). Doctor-style reader: it scans this repo's own
   emit sites structurally (the `{ code: 'XXX-NNN', severity: '...' }` finding objects — no JSON
   code registry exists) and checks every emitted code against the LOCAL Phase-3 wayfinder + catalog
   pages. For each emitted code it asserts (1) regex `^[A-Z]{3,4}-\d{3}$`, (2) membership in a catalog
   page, (3) band/ownership — the code's wayfinder owner is a page THIS validator emits from (no
   cross-owner / no wrong band), and (4) the inline severity equals the catalog-declared severity.

   CI-reality guard (IMPORTANT): the spec is LOCAL-ONLY (F10) — it lives in the workbench spec/
   workshop, NOT inside this repo and NOT checked out in GitHub CI (test-on-push.yml). So the whole
   suite is gated on the spec being present: absent → one passing note (SKIP) so GitHub CI stays
   green; present (local run / local pre-push) → the gate is fully enforced. `AGENTPROBE_SPEC_DIR`
   is an optional absolute-path seam (used to exercise the skip guard); it defaults to the local
   relative path. */

const HERE = dirname( fileURLToPath( import.meta.url ) )
const SRC_DIR = resolve( HERE, '../../src' )
const SPEC_DIR = process.env[ 'AGENTPROBE_SPEC_DIR' ] || resolve( HERE, '../../../../spec/agentprobe/0.1.0/draft/spec' )
const WAYFINDER = join( SPEC_DIR, '09-wayfinder.md' )
const SPEC_PRESENT = existsSync( WAYFINDER )

const CODE_RE = /^[A-Z]{3,4}-\d{3}$/
const SEVERITIES = [ 'error', 'warning', 'info' ]
const BAND_RE = /^(\*|[0-9]xx|[0-9]{2}x)$/
const OWNER_LINK_RE = /\[(\d{2}-[a-z0-9-]+\.md)\]/

/* Per-validator conformance profile. `ownPages` are the catalog pages this repo emits from;
   `sharedPrefixes` are cross-cutting prefixes owned by another page but legitimately emitted here
   (e.g. the comparison-integrity CMP codes owned by 03-mcp-assessment-codes.md). `exclude` are
   documented engine-synthetic codes that are not catalog members; `routed` are codes whose severity
   is set in a shared helper and cannot be paired to the code literal by a structural scan. */
const PROFILE = {
    ownPages: [ '04-x402-codes.md' ],
    sharedPrefixes: [ 'CMP' ],
    exclude: [],
    routed: [],
    negWrongOwner: 'VAL-101',
    negSeverity: { code: 'PAY-010', bad: 'info', good: 'error' }
}


function splitRow( line ) {
    return line.split( '|' ).slice( 1, -1 ).map( ( cell ) => cell.trim() )
}


function parseRegistry( { wayfinderPath } ) {
    const registry = readFileSync( wayfinderPath, 'utf8' )
        .split( '\n' )
        .filter( ( line ) => line.trim().startsWith( '|' ) )
        .map( ( line ) => splitRow( line ) )
        .filter( ( cells ) => cells.length === 4 )
        .filter( ( cells ) => /^[A-Z]{3,4}$/.test( cells[ 1 ] ) && BAND_RE.test( cells[ 2 ] ) && OWNER_LINK_RE.test( cells[ 3 ] ) )
        .map( ( cells ) => ( { prefix: cells[ 1 ], band: cells[ 2 ], owner: cells[ 3 ].match( OWNER_LINK_RE )[ 1 ] } ) )

    return { registry }
}


function bandContains( { band, number } ) {
    if( band === '*' ) { return { hit: true } }
    if( /^[0-9]xx$/.test( band ) ) { return { hit: Math.floor( number / 100 ) === Number( band[ 0 ] ) } }

    return { hit: Math.floor( number / 10 ) === Number( band.slice( 0, 2 ) ) }
}


function resolveOwner( { registry, code } ) {
    const [ prefix, digits ] = code.split( '-' )
    const number = Number( digits )
    const owners = registry
        .filter( ( row ) => row.prefix === prefix )
        .filter( ( row ) => bandContains( { band: row.band, number } ).hit )
        .map( ( row ) => row.owner )

    return { owners }
}


function parseCatalog( { specDir } ) {
    const files = readdirSync( specDir )
        .filter( ( file ) => /^0[3-8]-.*\.md$/.test( file ) )
        .sort()

    const catalog = new Map()

    files.forEach( ( file ) => {
        readFileSync( join( specDir, file ), 'utf8' )
            .split( '\n' )
            .filter( ( line ) => line.trim().startsWith( '|' ) )
            .map( ( line ) => splitRow( line ) )
            .filter( ( cells ) => cells.length >= 2 && CODE_RE.test( cells[ 0 ] ) && SEVERITIES.includes( cells[ 1 ] ) )
            .forEach( ( cells ) => catalog.set( cells[ 0 ], { severity: cells[ 1 ], page: file } ) )
    } )

    return { catalog }
}


function listMjs( { dir } ) {
    return readdirSync( dir )
        .flatMap( ( name ) => {
            const full = join( dir, name )
            if( statSync( full ).isDirectory() ) { return listMjs( { dir: full } ) }

            return name.endsWith( '.mjs' ) ? [ full ] : []
        } )
}


/* Structural emit-site scan. Severity is read, in priority order, from an inline
   `severity: '...'` in the same object literal, else from an enclosing `#error/#warn/#info(`
   helper call. Codes routed through a shared helper (severity in a different scope) come out
   with severity null and are handled via the profile's `routed` allow-list. */
function collectEmittedFindings( { srcDir } ) {
    const findings = []

    listMjs( { dir: srcDir } ).forEach( ( file ) => {
        readFileSync( file, 'utf8' ).split( '\n' ).forEach( ( line, index ) => {
            const codeMatches = [ ...line.matchAll( /code:\s*'([A-Z]{3,4}-\d{3})'/g ) ]
            if( codeMatches.length === 0 ) { return }

            const inline = line.match( /severity:\s*'([a-z]+)'/ )
            const severity = inline ? inline[ 1 ]
                : /#error\s*\(/.test( line ) ? 'error'
                : /#warn\s*\(/.test( line ) ? 'warning'
                : /#info\s*\(/.test( line ) ? 'info'
                : null

            codeMatches.forEach( ( match ) => findings.push( { code: match[ 1 ], severity, file: file.replace( SRC_DIR + '/', '' ), line: index + 1 } ) )
        } )
    } )

    return { findings }
}


function checkCode( { code, severity, registry, catalog, profile } ) {
    const prefix = code.split( '-' )[ 0 ]
    const { owners } = resolveOwner( { registry, code } )
    const member = catalog.has( code )
    const owned = owners.length === 1 && ( profile.ownPages.includes( owners[ 0 ] ) || profile.sharedPrefixes.includes( prefix ) )
    const expected = member ? catalog.get( code ).severity : null
    const severityOk = member && expected === severity

    return { regexOk: CODE_RE.test( code ), member, owned, owners, expected, severityOk }
}


if( !SPEC_PRESENT ) {

    describe( 'code conformance (spec-gated)', () => {

        test( 'SKIPPED — local-only spec (F10) is absent; enforced in local pre-push, not GitHub CI', () => {
            console.warn( `[code-conformance] wayfinder not found at ${ WAYFINDER } — skipping. The spec is local-only (F10); GitHub CI has no spec checkout, so the gate is enforced locally, not in CI.` )
            expect( SPEC_PRESENT ).toBe( false )
        } )

    } )

} else {

    const { registry } = parseRegistry( { wayfinderPath: WAYFINDER } )
    const { catalog } = parseCatalog( { specDir: SPEC_DIR } )
    const { findings: allFindings } = collectEmittedFindings( { srcDir: SRC_DIR } )

    const inScope = allFindings.filter( ( finding ) => !PROFILE.exclude.includes( finding.code ) )
    const emittedCodes = [ ...new Set( allFindings.map( ( finding ) => finding.code ) ) ].sort()
    const inScopeCodes = [ ...new Set( inScope.map( ( finding ) => finding.code ) ) ].sort()

    describe( 'code conformance — emitted codes vs the wayfinder', () => {

        test( 'the repo emits at least one finding code (scan sanity)', () => {
            expect( emittedCodes.length ).toBeGreaterThan( 0 )
        } )


        test( 'every emitted code matches ^[A-Z]{3,4}-\\d{3}$', () => {
            const bad = emittedCodes.filter( ( code ) => !CODE_RE.test( code ) )
            expect( bad ).toEqual( [] )
        } )


        test( 'every in-scope code is a wayfinder catalog member', () => {
            const missing = inScopeCodes.filter( ( code ) => !checkCode( { code, severity: null, registry, catalog, profile: PROFILE } ).member )
            expect( missing ).toEqual( [] )
        } )


        test( 'every in-scope code is owned by this validator (correct band, single owner)', () => {
            const wrong = inScopeCodes
                .map( ( code ) => ( { code, owners: checkCode( { code, severity: null, registry, catalog, profile: PROFILE } ).owners } ) )
                .filter( ( entry ) => !checkCode( { code: entry.code, severity: null, registry, catalog, profile: PROFILE } ).owned )
                .map( ( entry ) => `${ entry.code } -> ${ entry.owners.join( ',' ) || 'no-owner' }` )
            expect( wrong ).toEqual( [] )
        } )


        test( 'every determinable inline severity equals the catalog severity', () => {
            const drift = inScope
                .filter( ( finding ) => finding.severity !== null )
                .filter( ( finding ) => catalog.has( finding.code ) )
                .filter( ( finding ) => catalog.get( finding.code ).severity !== finding.severity )
                .map( ( finding ) => `${ finding.code }: emits '${ finding.severity }', catalog '${ catalog.get( finding.code ).severity }' (${ finding.file }:${ finding.line })` )
            expect( drift ).toEqual( [] )
        } )


        test( 'non-catalog emitted codes are exactly the documented engine-synthetic exclusions', () => {
            const nonMembers = emittedCodes.filter( ( code ) => !catalog.has( code ) ).sort()
            expect( nonMembers ).toEqual( [ ...PROFILE.exclude ].sort() )
        } )


        test( 'codes with no statically determinable severity are the documented routed set', () => {
            const determinable = new Set( inScope.filter( ( finding ) => finding.severity !== null ).map( ( finding ) => finding.code ) )
            const indeterminate = inScopeCodes.filter( ( code ) => !determinable.has( code ) ).sort()
            expect( indeterminate ).toEqual( [ ...PROFILE.routed ].sort() )
        } )

    } )


    describe( 'negative-drift — the gate must bite (inline fixtures, not real src)', () => {

        test( 'membership: a bogus code (ZZZ-999) fails membership', () => {
            const result = checkCode( { code: 'ZZZ-999', severity: 'error', registry, catalog, profile: PROFILE } )
            expect( result.member ).toBe( false )
        } )


        test( `band/ownership: a wrong-band code (${ PROFILE.negWrongOwner }) fails ownership`, () => {
            const result = checkCode( { code: PROFILE.negWrongOwner, severity: 'error', registry, catalog, profile: PROFILE } )
            expect( result.owned ).toBe( false )
        } )


        test( `severity: a wrong-severity finding (${ PROFILE.negSeverity.code } as '${ PROFILE.negSeverity.bad }') fails the severity check`, () => {
            const bad = checkCode( { code: PROFILE.negSeverity.code, severity: PROFILE.negSeverity.bad, registry, catalog, profile: PROFILE } )
            const good = checkCode( { code: PROFILE.negSeverity.code, severity: PROFILE.negSeverity.good, registry, catalog, profile: PROFILE } )
            expect( bad.severityOk ).toBe( false )
            expect( good.severityOk ).toBe( true )
        } )

    } )

}
