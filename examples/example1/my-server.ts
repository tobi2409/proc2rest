interface Person {
  name: string
  age: number
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

export function getPerson(name: string) : Person[] {
    return people.filter(person => person.name === name)
}

export function addPerson(person: Person): Person {
    people.push(person)
    return person
}

export function add(a: number, b: number): number {
    return a + b
}

export function pgetBinDataInfo(name: string, data: Uint8Array): string {
  return `${name}: ${data.byteLength}`
}