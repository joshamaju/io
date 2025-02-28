/**
 * @since 1.0.0
 */
import type * as Context from "@effect/data/Context"
import type { Either } from "@effect/data/Either"
import type { Cause } from "@effect/io/Cause"
import type * as Effect from "@effect/io/Effect"
import type * as Exit from "@effect/io/Exit"
import type * as Fiber from "@effect/io/Fiber"
import type * as FiberId from "@effect/io/Fiber/Id"
import type * as RuntimeFlags from "@effect/io/Fiber/Runtime/Flags"
import type * as FiberRefs from "@effect/io/FiberRefs"
import * as internal from "@effect/io/internal_effect_untraced/runtime"
import type { Scheduler } from "@effect/io/Scheduler"

/**
 * @since 1.0.0
 * @category models
 */
export interface AsyncFiberException<E, A> {
  readonly _tag: "AsyncFiberException"
  readonly fiber: Fiber.RuntimeFiber<E, A>
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Cancel<E, A> {
  (fiberId?: FiberId.FiberId, onExit?: (exit: Exit.Exit<E, A>) => void): void
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Runtime<R> {
  /**
   * The context used as initial for forks
   */
  readonly context: Context.Context<R>
  /**
   * The runtime flags used as initial for forks
   */
  readonly runtimeFlags: RuntimeFlags.RuntimeFlags
  /**
   * The fiber references used as initial for forks
   */
  readonly fiberRefs: FiberRefs.FiberRefs
}

/**
 * @since 1.0.0
 * @category models
 */
export interface RunForkOptions {
  scheduler?: Scheduler
  updateRefs?: (refs: FiberRefs.FiberRefs, fiberId: FiberId.Runtime) => FiberRefs.FiberRefs
}

/**
 * Executes the effect using the provided Scheduler or using the global
 * Scheduler if not provided
 *
 * @since 1.0.0
 * @category execution
 */
export const runFork: <R>(
  runtime: Runtime<R>
) => <E, A>(self: Effect.Effect<R, E, A>, options?: RunForkOptions | undefined) => Fiber.RuntimeFiber<E, A> =
  internal.unsafeFork

/**
 * Executes the effect synchronously returning the exit.
 *
 * This method is effectful and should only be invoked at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runSyncExit: <R>(runtime: Runtime<R>) => <E, A>(effect: Effect.Effect<R, E, A>) => Exit.Exit<E, A> =
  internal.unsafeRunSyncExit

/**
 * Executes the effect synchronously throwing in case of errors or async boundaries.
 *
 * This method is effectful and should only be invoked at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runSync: <R>(runtime: Runtime<R>) => <E, A>(effect: Effect.Effect<R, E, A>) => A = internal.unsafeRunSync

/**
 * Executes the effect asynchronously, eventually passing the exit value to
 * the specified callback.
 *
 * This method is effectful and should only be invoked at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runCallback: <R>(
  runtime: Runtime<R>
) => <E, A>(
  effect: Effect.Effect<R, E, A>,
  onExit?: ((exit: Exit.Exit<E, A>) => void) | undefined
) => (fiberId?: FiberId.FiberId | undefined, onExit?: ((exit: Exit.Exit<E, A>) => void) | undefined) => void =
  internal.unsafeRunCallback

/**
 * Executes the effect synchronously returning either the result or a failure.
 *
 * Throwing in case of defects and interruptions.
 *
 * This method is effectful and should only be invoked at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runSyncEither: <R>(runtime: Runtime<R>) => <E, A>(effect: Effect.Effect<R, E, A>) => Either<E, A> =
  internal.unsafeRunSyncEither

/**
 * Runs the `Effect`, returning a JavaScript `Promise` that will be resolved
 * with the value of the effect once the effect has been executed, or will be
 * rejected with the first error or exception throw by the effect.
 *
 * This method is effectful and should only be used at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runPromise: <R>(runtime: Runtime<R>) => <E, A>(effect: Effect.Effect<R, E, A>) => Promise<A> =
  internal.unsafeRunPromise

/**
 * Runs the `Effect`, returning a JavaScript `Promise` that will be resolved
 * with the `Exit` state of the effect once the effect has been executed.
 *
 * This method is effectful and should only be used at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runPromiseExit: <R>(
  runtime: Runtime<R>
) => <E, A>(effect: Effect.Effect<R, E, A>) => Promise<Exit.Exit<E, A>> = internal.unsafeRunPromiseExit

/**
 * Runs the `Effect`, returning a JavaScript `Promise` that will be resolved
 * with the either a success or a failure. The promise will be rejected in case
 * of defects and interruption.
 *
 * This method is effectful and should only be used at the edges of your
 * program.
 *
 * @since 1.0.0
 * @category execution
 */
export const runPromiseEither: <R>(
  runtime: Runtime<R>
) => <E, A>(effect: Effect.Effect<R, E, A>) => Promise<Either<E, A>> = internal.unsafeRunPromiseEither

/**
 * @since 1.0.0
 * @category constructors
 */
export const defaultRuntime: Runtime<never> = internal.defaultRuntime

/**
 * @since 1.0.0
 * @category constructors
 */
export const defaultRuntimeFlags: RuntimeFlags.RuntimeFlags = internal.defaultRuntimeFlags

/**
 * @since 1.0.0
 * @category constructors
 */
export const make: <R>(
  context: Context.Context<R>,
  runtimeFlags: RuntimeFlags.RuntimeFlags,
  fiberRefs: FiberRefs.FiberRefs
) => Runtime<R> = internal.make

/**
 * @since 1.0.0
 * @category symbols
 */
export const FiberFailureId = Symbol.for("@effect/io/Runtime/FiberFailure")
/**
 * @since 1.0.0
 * @category symbols
 */
export type FiberFailureId = typeof FiberFailureId

/**
 * @since 1.0.0
 * @category symbols
 */
export const FiberFailureCauseId: unique symbol = internal.FiberFailureCauseId

/**
 * @since 1.0.0
 * @category exports
 */
export type FiberFailureCauseId = typeof FiberFailureCauseId

/**
 * @since 1.0.0
 * @category models
 */
export interface FiberFailure extends Error {
  readonly [FiberFailureId]: FiberFailureId
  readonly [FiberFailureCauseId]: Cause<unknown>
  readonly [NodePrint]: () => string
}

/**
 * @since 1.0.0
 * @category symbols
 */
export const NodePrint: unique symbol = internal.NodePrint

/**
 * @since 1.0.0
 * @category symbols
 */
export type NodePrint = typeof NodePrint

/**
 * @since 1.0.0
 * @category guards
 */
export const isAsyncFiberException: (u: unknown) => u is AsyncFiberException<unknown, unknown> =
  internal.isAsyncFiberException

/**
 * @since 1.0.0
 * @category guards
 */
export const isFiberFailure: (u: unknown) => u is FiberFailure = internal.isFiberFailure

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeFiberFailure: <E>(cause: Cause<E>) => FiberFailure = internal.fiberFailure
