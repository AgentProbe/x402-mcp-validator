import { describe, test, expect } from '@jest/globals'
import { PaymentValidator } from '../../src/task/PaymentValidator.mjs'
import {
    VALID_PAYMENT_REQUIRED,
    INVALID_PAYMENT_MISSING_VERSION,
    INVALID_PAYMENT_WRONG_VERSION,
    INVALID_PAYMENT_EMPTY_ACCEPTS,
    INVALID_PAYMENT_BAD_SCHEME,
    INVALID_PAYMENT_BAD_NETWORK,
    INVALID_PAYMENT_BAD_AMOUNT,
    INVALID_PAYMENT_BAD_ADDRESS,
    MOCK_RESTRICTED_CALLS,
    MOCK_RESTRICTED_CALLS_MULTI
} from '../helpers/config.mjs'


describe( 'PaymentValidator', () => {
    describe( 'validate — valid inputs', () => {
        test( 'validates single valid restricted call', () => {
            const { findings, validPaymentOptions } = PaymentValidator
                .validate( { restrictedCalls: MOCK_RESTRICTED_CALLS, paymentOptions: [] } )

            expect( findings ).toHaveLength( 0 )
            expect( validPaymentOptions.length ).toBeGreaterThan( 0 )
        } )


        test( 'validates multi-network restricted calls', () => {
            const { findings, validPaymentOptions } = PaymentValidator
                .validate( { restrictedCalls: MOCK_RESTRICTED_CALLS_MULTI, paymentOptions: [] } )

            expect( findings ).toHaveLength( 0 )
            expect( validPaymentOptions.length ).toBeGreaterThanOrEqual( 2 )
        } )
    } )


    describe( 'validate — PAY-001/002 missing or invalid paymentRequired', () => {
        test( 'detects missing paymentRequired (PAY-001)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test' } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-001' )

            expect( match ).toBeDefined()
            expect( match['severity'] ).toBe( 'error' )
        } )


        test( 'detects non-object paymentRequired (PAY-002)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: 'bad' } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-002' )

            expect( match ).toBeDefined()
        } )


        test( 'detects array paymentRequired (PAY-002)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: [] } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-002' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-010/011/012 version validation', () => {
        test( 'detects missing x402Version (PAY-010)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_MISSING_VERSION } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-010' )

            expect( match ).toBeDefined()
        } )


        test( 'detects wrong x402Version (PAY-012)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_WRONG_VERSION } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-012' )

            expect( match ).toBeDefined()
        } )


        test( 'detects non-number x402Version (PAY-011)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: { x402Version: 'two', accepts: [] } } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-011' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-020/021/022/023/024 resource validation', () => {
        test( 'accepts valid resource object', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: MOCK_RESTRICTED_CALLS, paymentOptions: [] } )

            const resourceFindings = findings
                .filter( ( f ) => f['location'].includes( 'resource' ) )

            expect( resourceFindings ).toHaveLength( 0 )
        } )


        test( 'detects non-object/non-string resource (PAY-020)', () => {
            const pr = { x402Version: 2, resource: 42, accepts: [] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-020' )

            expect( match ).toBeDefined()
        } )


        test( 'detects empty string resource (PAY-021)', () => {
            const pr = { x402Version: 2, resource: '   ', accepts: [ { scheme: 'exact', network: 'eip155:84532', amount: '100000', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A', maxTimeoutSeconds: 300 } ] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-021' )

            expect( match ).toBeDefined()
        } )


        test( 'detects missing url in resource object (PAY-021)', () => {
            const pr = { x402Version: 2, resource: {}, accepts: [] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-021' && f['location'].includes( 'resource.url' ) )

            expect( match ).toBeDefined()
        } )


        test( 'detects unknown fields in resource (PAY-024)', () => {
            const pr = { x402Version: 2, resource: { url: 'https://test.com', extra: 'bad' }, accepts: [] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-024' )

            expect( match ).toBeDefined()
            expect( match['severity'] ).toBe( 'warning' )
        } )
    } )


    describe( 'validate — PAY-030/031/032 accepts validation', () => {
        test( 'detects missing accepts (PAY-030)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: { x402Version: 2 } } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-030' )

            expect( match ).toBeDefined()
        } )


        test( 'detects non-array accepts (PAY-031)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: { x402Version: 2, accepts: 'bad' } } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-031' )

            expect( match ).toBeDefined()
        } )


        test( 'detects empty accepts (PAY-032)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_EMPTY_ACCEPTS } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-032' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-040/041/042 scheme validation', () => {
        test( 'detects invalid scheme (PAY-042)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_BAD_SCHEME } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-042' )

            expect( match ).toBeDefined()
        } )


        test( 'detects missing scheme (PAY-040)', () => {
            const pr = { x402Version: 2, accepts: [ { network: 'eip155:84532', amount: '100', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A', maxTimeoutSeconds: 300 } ] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-040' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-050/051/052/053 network validation', () => {
        test( 'detects bad network prefix (PAY-052)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_BAD_NETWORK } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-052' )

            expect( match ).toBeDefined()
        } )


        test( 'detects missing network (PAY-050)', () => {
            const pr = { x402Version: 2, accepts: [ { scheme: 'exact', amount: '100', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A', maxTimeoutSeconds: 300 } ] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-050' )

            expect( match ).toBeDefined()
        } )


        test( 'detects missing chain ID after prefix (PAY-053)', () => {
            const pr = { x402Version: 2, accepts: [ { scheme: 'exact', network: 'eip155:', amount: '100', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A', maxTimeoutSeconds: 300 } ] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-053' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-060/061/062/063 amount validation', () => {
        test( 'detects non-numeric amount (PAY-062)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_BAD_AMOUNT } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-062' )

            expect( match ).toBeDefined()
        } )


        test( 'detects missing amount (PAY-060)', () => {
            const pr = { x402Version: 2, accepts: [ { scheme: 'exact', network: 'eip155:84532', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A', maxTimeoutSeconds: 300 } ] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-060' )

            expect( match ).toBeDefined()
        } )


        test( 'detects zero amount (PAY-063)', () => {
            const pr = { x402Version: 2, accepts: [ { scheme: 'exact', network: 'eip155:84532', amount: '0', asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A', maxTimeoutSeconds: 300 } ] }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-063' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-070/072 asset validation', () => {
        test( 'detects invalid EVM address for asset (PAY-072)', () => {
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: INVALID_PAYMENT_BAD_ADDRESS } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-072' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-080/082/083 payTo validation', () => {
        test( 'detects non-checksummed payTo (PAY-083)', () => {
            const pr = {
                x402Version: 2,
                accepts: [ {
                    scheme: 'exact',
                    network: 'eip155:84532',
                    amount: '100000',
                    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    payTo: '0x7b4d4c1e3bd0c6e3c8e1e5da1f3a0e7c9b2d4f6a',
                    maxTimeoutSeconds: 300
                } ]
            }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-083' )

            expect( match ).toBeDefined()
            expect( match['severity'] ).toBe( 'warning' )
        } )
    } )


    describe( 'validate — PAY-090/091/092 maxTimeoutSeconds validation', () => {
        test( 'detects missing maxTimeoutSeconds (PAY-090)', () => {
            const pr = {
                x402Version: 2,
                accepts: [ {
                    scheme: 'exact',
                    network: 'eip155:84532',
                    amount: '100000',
                    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A'
                } ]
            }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-090' )

            expect( match ).toBeDefined()
        } )


        test( 'detects non-number maxTimeoutSeconds (PAY-091)', () => {
            const pr = {
                x402Version: 2,
                accepts: [ {
                    scheme: 'exact',
                    network: 'eip155:84532',
                    amount: '100000',
                    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
                    maxTimeoutSeconds: 'fast'
                } ]
            }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-091' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — PAY-100/101/102 extra validation', () => {
        test( 'detects non-object extra (PAY-100)', () => {
            const pr = {
                x402Version: 2,
                accepts: [ {
                    scheme: 'exact',
                    network: 'eip155:84532',
                    amount: '100000',
                    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
                    maxTimeoutSeconds: 300,
                    extra: 'not-object'
                } ]
            }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-100' )

            expect( match ).toBeDefined()
            expect( match['severity'] ).toBe( 'info' )
        } )


        test( 'detects missing extra.name for EVM (PAY-101)', () => {
            const pr = {
                x402Version: 2,
                accepts: [ {
                    scheme: 'exact',
                    network: 'eip155:84532',
                    amount: '100000',
                    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
                    maxTimeoutSeconds: 300,
                    extra: { version: '2' }
                } ]
            }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-101' )

            expect( match ).toBeDefined()
        } )


        test( 'detects missing extra.version for EVM (PAY-102)', () => {
            const pr = {
                x402Version: 2,
                accepts: [ {
                    scheme: 'exact',
                    network: 'eip155:84532',
                    amount: '100000',
                    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    payTo: '0x7B4d4C1E3bD0C6e3c8e1E5dA1f3a0E7c9B2D4F6A',
                    maxTimeoutSeconds: 300,
                    extra: { name: 'USDC' }
                } ]
            }
            const { findings } = PaymentValidator
                .validate( { restrictedCalls: [ { toolName: 'test', paymentRequired: pr } ], paymentOptions: [] } )

            const match = findings
                .find( ( f ) => f['code'] === 'PAY-102' )

            expect( match ).toBeDefined()
        } )
    } )


    describe( 'validate — validPaymentOptions collection', () => {
        test( 'collects valid options only', () => {
            const mixedCalls = [
                { toolName: 'good', paymentRequired: VALID_PAYMENT_REQUIRED },
                { toolName: 'bad', paymentRequired: INVALID_PAYMENT_BAD_SCHEME }
            ]

            const { validPaymentOptions } = PaymentValidator
                .validate( { restrictedCalls: mixedCalls, paymentOptions: [] } )

            expect( validPaymentOptions ).toHaveLength( 1 )
        } )
    } )
} )
