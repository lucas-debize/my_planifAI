declare module "bun:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void
  export function it(name: string, fn: () => void | Promise<void>): void
  export function test(name: string, fn: () => void | Promise<void>): void
  export function expect(actual: unknown): {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toContain(expected: unknown): void
    not: {
      toBe(expected: unknown): void
      toContain(expected: unknown): void
      toBeNull(): void
    }
    toBeNull(): void
    toThrow(expected?: string | RegExp): void
  }
}
