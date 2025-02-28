/**
 * @since 1.0.0
 */
import type * as Equal from "@effect/data/Equal"
import type * as FiberId from "@effect/io/Fiber/Id"
import type * as RuntimeFlags from "@effect/io/Fiber/Runtime/Flags"
import * as internal from "@effect/io/internal_effect_untraced/fiberStatus"

/**
 * @since 1.0.0
 * @category symbols
 */
export const FiberStatusTypeId: unique symbol = internal.FiberStatusTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type FiberStatusTypeId = typeof FiberStatusTypeId

/**
 * @since 1.0.0
 * @category models
 */
export type FiberStatus = Done | Running | Suspended

/**
 * @since 1.0.0
 * @category models
 */
export interface Done extends Equal.Equal {
  readonly _tag: "Done"
  readonly [FiberStatusTypeId]: FiberStatusTypeId
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Running extends Equal.Equal {
  readonly _tag: "Running"
  readonly [FiberStatusTypeId]: FiberStatusTypeId
  readonly runtimeFlags: RuntimeFlags.RuntimeFlags
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Suspended extends Equal.Equal {
  readonly _tag: "Suspended"
  readonly [FiberStatusTypeId]: FiberStatusTypeId
  readonly runtimeFlags: RuntimeFlags.RuntimeFlags
  readonly blockingOn: FiberId.FiberId
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const done: FiberStatus = internal.done

/**
 * @since 1.0.0
 * @category constructors
 */
export const running: (runtimeFlags: RuntimeFlags.RuntimeFlags) => FiberStatus = internal.running

/**
 * @since 1.0.0
 * @category constructors
 */
export const suspended: (runtimeFlags: RuntimeFlags.RuntimeFlags, blockingOn: FiberId.FiberId) => FiberStatus =
  internal.suspended

/**
 * Returns `true` if the specified value is a `FiberStatus`, `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isFiberStatus: (u: unknown) => u is FiberStatus = internal.isFiberStatus

/**
 * Returns `true` if the specified `FiberStatus` is `Done`, `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isDone: (self: FiberStatus) => self is Done = internal.isDone

/**
 * Returns `true` if the specified `FiberStatus` is `Running`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isRunning: (self: FiberStatus) => self is Running = internal.isRunning

/**
 * Returns `true` if the specified `FiberStatus` is `Suspended`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isSuspended: (self: FiberStatus) => self is Suspended = internal.isSuspended
