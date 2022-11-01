import * as Cause from "@effect/io/Cause"
import { getCallTrace } from "@effect/io/Debug"
import type * as Effect from "@effect/io/Effect"
import type * as Exit from "@effect/io/Exit"
import type * as Fiber from "@effect/io/Fiber"
import * as FiberId from "@effect/io/Fiber/Id"
import * as core from "@effect/io/internal/core"
import type * as Scope from "@effect/io/Scope"
import * as Either from "@fp-ts/data/Either"
import { identity, pipe } from "@fp-ts/data/Function"
import * as HashSet from "@fp-ts/data/HashSet"
import * as Option from "@fp-ts/data/Option"

/** @internal */
const EffectErrorSymbolKey = "@effect/io/Effect/Error"

/** @internal */
export const EffectErrorTypeId = Symbol.for(EffectErrorSymbolKey)

/** @internal */
export type EffectErrorTypeId = typeof EffectErrorTypeId

/** @internal */
export interface EffectError<E> {
  readonly [EffectErrorTypeId]: EffectErrorTypeId
  readonly _tag: "EffectError"
  readonly cause: Cause.Cause<E>
}

/** @internal */
export const isEffectError = (u: unknown): u is EffectError<unknown> => {
  return typeof u === "object" && u != null && EffectErrorTypeId in u
}

/** @internal */
export const makeEffectError = <E>(cause: Cause.Cause<E>): EffectError<E> => ({
  [EffectErrorTypeId]: EffectErrorTypeId,
  _tag: "EffectError",
  cause
})

/** @internal */
export const absolve = <R, E, A>(self: Effect.Effect<R, E, Either.Either<E, A>>): Effect.Effect<R, E, A> => {
  const trace = getCallTrace()
  return pipe(self, core.flatMap(fromEither)).traced(trace)
}

/** @internal */
export const absorb = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, unknown, A> => {
  const trace = getCallTrace()
  return pipe(self, absorbWith(identity)).traced(trace)
}

/** @internal */
export const absorbWith = <E>(f: (e: E) => unknown) => {
  const trace = getCallTrace()
  return <R, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, unknown, A> => {
    return pipe(
      sandbox(self),
      foldEffect((cause) => core.fail(pipe(cause, Cause.squashWith(f))), core.succeed)
    ).traced(trace)
  }
}

/** @internal */
export const acquireReleaseInterruptible = <R, E, A, R2, X>(
  acquire: Effect.Effect<R, E, A>,
  release: (exit: Exit.Exit<unknown, unknown>) => Effect.Effect<R2, never, X>
): Effect.Effect<R | R2 | Scope.Scope, E, A> => {
  const trace = getCallTrace()
  return pipe(acquire, ensuring(core.addFinalizer(release))).traced(trace)
}

/** @internal */
export const allowInterrupt = (): Effect.Effect<never, never, void> => {
  const trace = getCallTrace()
  return descriptorWith(
    (descriptor) =>
      HashSet.size(descriptor.interruptors) > 0 ?
        core.interrupt() :
        core.unit()
  ).traced(trace)
}

/** @internal */
export const asLeft = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E, Either.Either<A, never>> => {
  const trace = getCallTrace()
  return pipe(self, core.map(Either.left)).traced(trace)
}

/** @internal */
export const asLeftError = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, Either.Either<E, never>, A> => {
  const trace = getCallTrace()
  return pipe(self, mapError(Either.left)).traced(trace)
}

/** @internal */
export const asRight = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E, Either.Either<never, A>> => {
  const trace = getCallTrace()
  return pipe(self, core.map(Either.right)).traced(trace)
}

/** @internal */
export const asRightError = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, Either.Either<never, E>, A> => {
  const trace = getCallTrace()
  return pipe(self, mapError(Either.right)).traced(trace)
}

/** @internal */
export const asSome = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E, Option.Option<A>> => {
  const trace = getCallTrace()
  return pipe(self, core.map(Option.some)).traced(trace)
}

/** @internal */
export const asSomeError = <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, Option.Option<E>, A> => {
  const trace = getCallTrace()
  return pipe(self, mapError(Option.some)).traced(trace)
}

// TODO(Max): after runtime
/** @internal */
// export const asyncEffect = <R, E, A, R2, E2, X>(
//   register: (callback: (_: Effect.Effect<R, E, A>) => void) => Effect.Effect<R2, E2, X>
// ): Effect.Effect<R | R2, E | E2, A> => {
//   const trace = getCallTrace()
//   return pipe(
//     core.makeDeferred<E | E2, A>(),
//     core.flatMap((deferred) =>
//       pipe(
//         runtime<R | R2>(),
//         core.flatMap((runtime) =>
//           core.uninterruptibleMask((restore) =>
//             pipe(
//               restore(
//                 pipe(
//                   register((cb) => runtime.unsafeRunAsync(pipe(cb, core.intoDeferred(deferred)))),
//                   core.catchAllCause((cause) => pipe(deferred, core.failCauseDeferred(cause as Cause.Cause<E | E2>)))
//                 )
//               ),
//               fork,
//               core.zipRight(core.awaitDeferred(deferred))
//             )
//           )
//         )
//       )
//     )
//   ).traced(trace)
// }

/** @internal */
export const asyncOption = <R, E, A>(
  register: (callback: (_: Effect.Effect<R, E, A>) => void) => Option.Option<Effect.Effect<R, E, A>>,
  blockingOn: FiberId.FiberId = FiberId.none
): Effect.Effect<R, E, A> => {
  const trace = getCallTrace()
  return core.asyncInterrupt<R, E, A>(
    (cb) => {
      const option = register(cb)
      switch (option._tag) {
        case "None": {
          return Either.left(core.unit())
        }
        case "Some": {
          return Either.right(option.value)
        }
      }
    },
    blockingOn
  ).traced(trace)
}

/**
 * Imports a synchronous side-effect into a pure `Effect` value, translating any
 * thrown exceptions into typed failed effects creating with `Effect.fail`.
 *
 * @tsplus static effect/core/io/Effect.Ops attempt
 * @category constructors
 * @since 1.0.0
 */
export const attempt = <A>(evaluate: () => A): Effect.Effect<never, unknown, A> => {
  const trace = getCallTrace()
  return core.sync(() => {
    try {
      return evaluate()
    } catch (error) {
      throw makeEffectError(Cause.fail(error))
    }
  }).traced(trace)
}

/** @internal */
export const descriptor = (): Effect.Effect<never, never, Fiber.Fiber.Descriptor> => {
  const trace = getCallTrace()
  return descriptorWith(core.succeed).traced(trace)
}

/** @internal */
export const descriptorWith = <R, E, A>(
  f: (descriptor: Fiber.Fiber.Descriptor) => Effect.Effect<R, E, A>
): Effect.Effect<R, E, A> => {
  const trace = getCallTrace()
  // TODO(Max): remove cast to any
  return core.withFiberRuntime((state, status) => {
    return f({
      id: (state as any).id as any,
      status,
      interruptors: Cause.interruptors((state as any).getFiberRef(core.interruptedCause))
    })
  }).traced(trace) as Effect.Effect<R, E, A>
}

/** @internal */
export const ensuring = <R1, X>(finalizer: Effect.Effect<R1, never, X>) => {
  const trace = getCallTrace()
  return <R, E, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R | R1, E, A> =>
    core.uninterruptibleMask((restore) =>
      pipe(
        restore(self),
        core.foldCauseEffect(
          (cause1) =>
            pipe(
              finalizer,
              core.foldCauseEffect(
                (cause2) => core.failCause(Cause.sequential(cause1, cause2)),
                () => core.failCause(cause1)
              )
            ),
          (a) => pipe(finalizer, core.as(a))
        )
      )
    ).traced(trace)
}

/** @internal */
export const foldEffect = <E, A, R2, E2, A2, R3, E3, A3>(
  onFailure: (e: E) => Effect.Effect<R2, E2, A2>,
  onSuccess: (a: A) => Effect.Effect<R3, E3, A3>
) => {
  const trace = getCallTrace()
  return <R>(self: Effect.Effect<R, E, A>): Effect.Effect<R | R2 | R3, E2 | E3, A2 | A3> => {
    return pipe(
      self,
      core.foldCauseEffect(
        (cause) => {
          const either = Cause.failureOrCause(cause)
          switch (either._tag) {
            case "Left": {
              return onFailure(either.left)
            }
            case "Right": {
              return core.failCause(either.right)
            }
          }
        },
        onSuccess
      )
    ).traced(trace)
  }
}

/** @internal */
export const fromEither = <E, A>(either: Either.Either<E, A>): Effect.Effect<never, E, A> => {
  const trace = getCallTrace()
  switch (either._tag) {
    case "Left": {
      return core.fail(either.left).traced(trace)
    }
    case "Right": {
      return core.succeed(either.right).traced(trace)
    }
  }
}

/** @internal */
export const mapError = <E, E2>(f: (e: E) => E2) => {
  const trace = getCallTrace()
  return <R, A>(self: Effect.Effect<R, E, A>): Effect.Effect<R, E2, A> => {
    return pipe(
      self,
      core.foldCauseEffect(
        (cause) => {
          const either = Cause.failureOrCause(cause)
          switch (either._tag) {
            case "Left": {
              return core.failSync(() => f(either.left))
            }
            case "Right": {
              return core.failCause(either.right)
            }
          }
        },
        core.succeed
      )
    ).traced(trace)
  }
}

/** @internal */
export const sandbox = <R, E, A>(
  self: Effect.Effect<R, E, A>
): Effect.Effect<R, Cause.Cause<E>, A> => {
  const trace = getCallTrace()
  return pipe(self, core.foldCauseEffect(core.fail, core.succeed)).traced(trace)
}
