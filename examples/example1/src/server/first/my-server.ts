// @ts-ignore ../logger is supplied by the server package in generated projects.
import { writeLog } from '../logger'

class UnsupportedArgumentError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'UnsupportedArgumentError'
    }
}

interface Person {
    name: string
    age: number
}

interface ReverseResult {
    name: string
    reversed: Uint8Array
}

const people: Person[] = [
    {
        name: 'John Doe',
        age: 30
    },
    {
        name: 'Jane Doe',
        age: 25
    }
]

export function mid1(_req: unknown, _res: unknown, next: () => void) {
    console.log('mid1 middleware called!')
    next()
}

export function mid2(_req: unknown, _res: unknown, next: () => void) {
    console.log('mid2 middleware called!')
    next()
}

// @rest
// @middleware(mid1, mid2)
export async function getPerson(name: string): Promise<Person[]> {
    if (name === 'log-error') {
        await writeLog('ERROR', 'Manual test error triggered in getPerson', {
            input: name
        })
        throw new UnsupportedArgumentError(
            'Manual test error triggered in getPerson'
        )
    }

    return people.filter((person) => person.name === name)
}

// @rest
export async function addPerson(person: Person): Promise<Person> {
    if (person.name === 'log-error') {
        await writeLog('ERROR', 'Manual test error triggered in addPerson', {
            input: person
        })
    }

    people.push(person)
    return person
}

// @rest
export async function add(a: number, b: number): Promise<number> {
    if (a === 13 && b === 37) {
        await writeLog('ERROR', 'Manual test error triggered in add', { a, b })
    }

    return a + b
}

// @rest
// @sizeLimit(1mb)
export function getBinDataInfo(name: string, data: Uint8Array): string {
    return `${name}: ${data.byteLength}`
}

// @rest
export function reverseBytes(data: Uint8Array): Uint8Array {
    return data.toReversed()
}

// @rest
export function reverseBytesWithName(
    name: string,
    data: Uint8Array
): ReverseResult {
    return {
        name,
        reversed: data.toReversed()
    }
}

// @rest
// @cors({"allowOrigin": "http://localhost:5000"})
export function restrictiveCors() {
    return { message: 'This endpoint has restrictive CORS settings' }
}

// @rest
// @rateLimit({"windowDurationMs": 900000, "maxRequests": 1, "useStandardHeaders": true, "useLegacyHeaders": false})
export function customRateLimit() {
    return { message: 'This endpoint has custom rate limit settings' }
}
