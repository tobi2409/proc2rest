import { writeLog } from "../logger";

class UnsupportedArgumentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsupportedArgumentError";
    }
}

interface Person {
    name: string;
    age: number;
}

interface ReverseResult {
    name: string;
    reversed: Uint8Array;
}

const people: Person[] = [
    {
        name: "John Doe",
        age: 30,
    },
    {
        name: "Jane Doe",
        age: 25,
    },
];

export function auth(_req: unknown, _res: unknown, next: () => void) {
    console.log("Auth middleware called!");
    next();
}

// @rest
// @middleware(auth)
export async function getPerson(name: string): Promise<Person[]> {
    if (name === "log-error") {
        await writeLog("ERROR", "Manual test error triggered in getPerson", { input: name });
        throw new UnsupportedArgumentError("Manual test error triggered in getPerson");
    }

    return people.filter((person) => person.name === name);
}

// @rest
export async function addPerson(person: Person): Promise<Person> {
    if (person.name === "log-error") {
        await writeLog("ERROR", "Manual test error triggered in addPerson", { input: person });
    }

    people.push(person);
    return person;
}

// @rest
export async function add(a: number, b: number): Promise<number> {
    if (a === 13 && b === 37) {
        await writeLog("ERROR", "Manual test error triggered in add", { a, b });
    }

    return a + b;
}

// @rest
export function getBinDataInfo(name: string, data: Uint8Array): string {
    return `${name}: ${data.byteLength}`;
}

// @rest
export function reverseBytes(data: Uint8Array): Uint8Array {
    return data.toReversed();
}

// @rest
export function reverseBytesWithName(
    name: string,
    data: Uint8Array,
): ReverseResult {
    return {
        name,
        reversed: data.toReversed(),
    };
}
