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
  }, {
    name: 'Jane Doe',
    age: 25
  }
]

export function auth(_req: unknown, _res: unknown, next: () => void) {
  console.log('Auth middleware called!')
  next()
}

// @rest
// @middleware(auth)
export function getPerson(name: string) : Person[] {
    return people.filter(person => person.name === name)
}

// @rest
export function addPerson(person: Person): Person {
    people.push(person)
    return person
}

// @rest
export function add(a: number, b: number): number {
    return a + b
}

// @rest
export function pgetBinDataInfo(name: string, data: Uint8Array): string {
    return `${name}: ${data.byteLength}`
}

// @rest
export function reverseBytes(data: Uint8Array): Uint8Array {
  return data.toReversed()
}

// @rest
export function reverseBytesWithName(name: string, data: Uint8Array): ReverseResult {
  return {
    name,
    reversed: data.toReversed()
  }
}