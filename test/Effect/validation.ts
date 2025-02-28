import * as Either from "@effect/data/Either"
import { pipe } from "@effect/data/Function"
import * as Cause from "@effect/io/Cause"
import * as Effect from "@effect/io/Effect"
import * as Ref from "@effect/io/Ref"
import * as it from "@effect/io/test/utils/extend"
import { assert, describe } from "vitest"

describe.concurrent("Effect", () => {
  it.effect("validate - fails", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Effect.succeed(1),
          Effect.validate(Effect.fail(2)),
          Effect.sandbox,
          Effect.either,
          Effect.map(Either.mapLeft(Cause.unannotate))
        )
      )
      assert.deepStrictEqual(result, Either.left(Cause.fail(2)))
    }))
  it.effect("validate - combines both cause", () =>
    Effect.gen(function*($) {
      const result = yield* $(
        pipe(
          Effect.fail(1),
          Effect.validate(Effect.fail(2)),
          Effect.sandbox,
          Effect.either,
          Effect.map(Either.mapLeft(Cause.unannotate))
        )
      )
      assert.deepStrictEqual(result, Either.left(Cause.sequential(Cause.fail(1), Cause.fail(2))))
    }))
  it.effect("validateWith - succeeds", () =>
    Effect.gen(function*($) {
      const result = yield* $(Effect.succeed(1), Effect.validateWith(Effect.succeed(2), (a, b) => a + b))
      assert.strictEqual(result, 3)
    }))
  it.effect("validateAll - accumulate successes", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, (_, i) => i)
      const result = yield* $(array, Effect.validateAll(Effect.succeed))
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateAll - returns all errors if never valid", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, () => 0)
      const result = yield* $(array, Effect.validateAll(Effect.fail), Effect.flip)
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateAll - accumulate errors and ignore successes", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, (_, i) => i)
      const result = yield* $(
        pipe(array, Effect.validateAll((n) => n % 2 === 0 ? Effect.succeed(n) : Effect.fail(n)), Effect.flip)
      )
      assert.deepStrictEqual(Array.from(result), [1, 3, 5, 7, 9])
    }))
  it.effect("validateAllDiscard - returns all errors if never valid", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, () => 0)
      const result = yield* $(array, Effect.validateAllDiscard(Effect.fail), Effect.flip)
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateAllPar - returns all errors if never valid", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 1000 }, () => 0)
      const result = yield* $(array, Effect.validateAllPar(Effect.fail), Effect.flip)
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateAllPar - accumulate errors and ignore successes", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, (_, i) => i)
      const result = yield* $(
        pipe(array, Effect.validateAllPar((n) => n % 2 === 0 ? Effect.succeed(n) : Effect.fail(n)), Effect.flip)
      )
      assert.deepStrictEqual(Array.from(result), [1, 3, 5, 7, 9])
    }))
  it.effect("validateAllPar - accumulate successes", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, (_, i) => i)
      const result = yield* $(array, Effect.validateAllPar(Effect.succeed))
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateAllParDiscard - returns all errors if never valid", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, () => 0)
      const result = yield* $(array, Effect.validateAllParDiscard(Effect.fail), Effect.flip)
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateFirst - returns all errors if never valid", () =>
    Effect.gen(function*($) {
      const array = Array.from({ length: 10 }, () => 0)
      const result = yield* $(array, Effect.validateFirst(Effect.fail), Effect.flip)
      assert.deepStrictEqual(Array.from(result), array)
    }))
  it.effect("validateFirst - returns [] as error if the input is empty", () =>
    Effect.gen(function*($) {
      const result = yield* $([], Effect.validateFirst(Effect.succeed), Effect.flip)
      assert.deepStrictEqual(result, [])
    }))
  it.effect("validateFirst - runs sequentially and short circuits on first success validation", () =>
    Effect.gen(function*($) {
      const f = (n: number): Effect.Effect<never, number, number> => {
        return n === 6 ? Effect.succeed(n) : Effect.fail(n)
      }
      const array = Array.from({ length: 10 }, (_, i) => i + 1)
      const counter = yield* $(Ref.make<number>(0))
      const result = yield* $(
        pipe(
          array,
          Effect.validateFirst((n) =>
            pipe(
              Ref.update(counter, (n) => n + 1),
              Effect.zipRight(f(n))
            )
          )
        )
      )
      const count = yield* $(Ref.get(counter))
      assert.strictEqual(result, 6)
      assert.strictEqual(count, 6)
    }))
  it.effect("validateFirst - returns errors in correct order", () =>
    Effect.gen(function*($) {
      const result = yield* $([2, 4, 6, 3, 5, 6], Effect.validateFirst(Effect.fail), Effect.flip)
      assert.deepStrictEqual(Array.from(result), [2, 4, 6, 3, 5, 6])
    }))
  describe.concurrent("", () => {
    it.effect("validateFirstPar - returns all errors if never valid", () =>
      Effect.gen(function*($) {
        const array = Array.from({ length: 1000 }, () => 0)
        const result = yield* $(array, Effect.validateFirstPar(Effect.fail), Effect.flip)
        assert.deepStrictEqual(Array.from(result), array)
      }))
    it.effect("validateFirstPar - returns success if valid", () =>
      Effect.gen(function*($) {
        const f = (n: number): Effect.Effect<never, number, number> => {
          return n === 6 ? Effect.succeed(n) : Effect.fail(n)
        }
        const array = Array.from({ length: 10 }, (_, i) => i + 1)
        const result = yield* $(array, Effect.validateFirstPar(f))
        assert.strictEqual(result, 6)
      }))
  })
})
