class Validation {


    static validationStart( { endpoint, timeout } ) {
        const struct = { status: false, findings: [] }

        if( endpoint === undefined ) {
            struct['findings'].push( { code: 'VAL-201', severity: 'error', location: 'endpoint', message: 'Missing value' } )
        } else if( typeof endpoint !== 'string' ) {
            struct['findings'].push( { code: 'VAL-202', severity: 'error', location: 'endpoint', message: 'Must be a string' } )
        } else if( endpoint.trim() === '' ) {
            struct['findings'].push( { code: 'VAL-203', severity: 'error', location: 'endpoint', message: 'Must not be empty' } )
        } else {
            try {
                new URL( endpoint )
            } catch( _e ) {
                struct['findings'].push( { code: 'VAL-204', severity: 'error', location: 'endpoint', message: 'Must be a valid URL' } )
            }
        }

        if( timeout !== undefined ) {
            if( typeof timeout !== 'number' ) {
                struct['findings'].push( { code: 'VAL-205', severity: 'error', location: 'timeout', message: 'Must be a number' } )
            } else if( timeout <= 0 ) {
                struct['findings'].push( { code: 'VAL-206', severity: 'error', location: 'timeout', message: 'Must be greater than 0' } )
            }
        }

        if( struct['findings'].length > 0 ) {
            return struct
        }

        struct['status'] = true

        return struct
    }


    static validationCompare( { before, after } ) {
        const struct = { status: false, messages: [] }

        if( before === undefined ) {
            struct['messages'].push( 'VAL-210 before: Missing value' )
        } else if( before === null || typeof before !== 'object' || Array.isArray( before ) ) {
            struct['messages'].push( 'VAL-211 before: Must be an object' )
        } else if( !before['categories'] || !before['entries'] ) {
            struct['messages'].push( 'VAL-212 before: Missing categories or entries' )
        }

        if( after === undefined ) {
            struct['messages'].push( 'VAL-213 after: Missing value' )
        } else if( after === null || typeof after !== 'object' || Array.isArray( after ) ) {
            struct['messages'].push( 'VAL-214 after: Must be an object' )
        } else if( !after['categories'] || !after['entries'] ) {
            struct['messages'].push( 'VAL-215 after: Missing categories or entries' )
        }

        if( struct['messages'].length > 0 ) {
            return struct
        }

        struct['status'] = true

        return struct
    }


    static error( { messages } ) {
        const messageStr = messages.join( ', ' )

        throw new Error( messageStr )
    }
}


export { Validation }
