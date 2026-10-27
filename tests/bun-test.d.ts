declare module "bun:test" {
  export function describe(name: string, fn: () => void | Promise<void>): void
  export function it(name: string, fn: () => void | Promise<void>): void
  export function test(name: string, fn: () => void | Promise<void>): void
  export function beforeEach(fn: () => void | Promise<void>): void
  export function afterEach(fn: () => void | Promise<void>): void
  export function beforeAll(fn: () => void | Promise<void>): void
  export function afterAll(fn: () => void | Promise<void>): void

  type Matchers = {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toContain(expected: unknown): void
    toBeNull(): void
    toBeDefined(): void
    toBeUndefined(): void
    toBeGreaterThan(expected: number): void
    toBeGreaterThanOrEqual(expected: number): void
    toThrow(expected?: string | RegExp): void
    not: {
      toBe(expected: unknown): void
      toContain(expected: unknown): void
      toBeNull(): void
      toBeDefined(): void
      toBeUndefined(): void
      toThrow(expected?: string | RegExp): void
    }
  }

  export function expect(actual: unknown): Matchers & {
    rejects: {
      toThrow(expected?: string | RegExp): Promise<void>
    }
    resolves: Matchers
  }
}
