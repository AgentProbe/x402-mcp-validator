import { describe, test, expect } from '@jest/globals'
import { Validation } from '../../src/task/Validation.mjs'


describe( 'Validation', () => {
    describe( 'validationStart', () => {
        test( 'validates correct input', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 'https://mcp.example.com/mcp', timeout: 10000 } )

            expect( status ).toBe( true )
            expect( findings ).toHaveLength( 0 )
        } )


        test( 'rejects missing endpoint', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: undefined, timeout: 10000 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ] ).toEqual( { code: 'VAL-201', severity: 'error', location: 'endpoint', message: 'Missing value' } )
        } )


        test( 'rejects non-string endpoint', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 123, timeout: 10000 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'VAL-202' )
            expect( findings[ 0 ]['severity'] ).toBe( 'error' )
        } )


        test( 'rejects empty endpoint', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: '   ', timeout: 10000 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'VAL-203' )
        } )


        test( 'rejects invalid URL', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 'not-a-url', timeout: 10000 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'VAL-204' )
        } )


        test( 'rejects non-number timeout', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 'https://mcp.example.com/mcp', timeout: 'fast' } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'VAL-205' )
            expect( findings[ 0 ]['location'] ).toBe( 'timeout' )
        } )


        test( 'rejects zero timeout', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 'https://mcp.example.com/mcp', timeout: 0 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'VAL-206' )
        } )


        test( 'rejects negative timeout', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 'https://mcp.example.com/mcp', timeout: -5 } )

            expect( status ).toBe( false )
            expect( findings[ 0 ]['code'] ).toBe( 'VAL-206' )
        } )


        test( 'accepts undefined timeout as optional', () => {
            const { status, findings } = Validation
                .validationStart( { endpoint: 'https://mcp.example.com/mcp', timeout: undefined } )

            expect( status ).toBe( true )
            expect( findings ).toHaveLength( 0 )
        } )
    } )


    describe( 'validationCompare', () => {
        const validSnapshot = {
            categories: { isReachable: true },
            entries: { endpoint: 'https://example.com' }
        }


        test( 'validates correct input', () => {
            const { status, messages } = Validation
                .validationCompare( { before: validSnapshot, after: validSnapshot } )

            expect( status ).toBe( true )
            expect( messages ).toHaveLength( 0 )
        } )


        test( 'rejects missing before', () => {
            const { status, messages } = Validation
                .validationCompare( { before: undefined, after: validSnapshot } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-210' )
        } )


        test( 'rejects null before', () => {
            const { status, messages } = Validation
                .validationCompare( { before: null, after: validSnapshot } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-211' )
        } )


        test( 'rejects array before', () => {
            const { status, messages } = Validation
                .validationCompare( { before: [], after: validSnapshot } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-211' )
        } )


        test( 'rejects before without categories', () => {
            const { status, messages } = Validation
                .validationCompare( { before: { entries: {} }, after: validSnapshot } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-212' )
        } )


        test( 'rejects missing after', () => {
            const { status, messages } = Validation
                .validationCompare( { before: validSnapshot, after: undefined } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-213' )
        } )


        test( 'rejects null after', () => {
            const { status, messages } = Validation
                .validationCompare( { before: validSnapshot, after: null } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-214' )
        } )


        test( 'rejects after without entries', () => {
            const { status, messages } = Validation
                .validationCompare( { before: validSnapshot, after: { categories: {} } } )

            expect( status ).toBe( false )
            expect( messages[ 0 ] ).toContain( 'VAL-215' )
        } )
    } )


    describe( 'error', () => {
        test( 'throws error with joined messages', () => {
            expect( () => {
                Validation.error( { messages: [ 'Error A', 'Error B' ] } )
            } ).toThrow( 'Error A, Error B' )
        } )
    } )
} )
