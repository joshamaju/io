/**
 * @since 1.0.0
 */
import type * as Equal from "@effect/data/Equal"
import type * as HashSet from "@effect/data/HashSet"
import type * as Option from "@effect/data/Option"
import * as internal from "@effect/io/internal_effect_untraced/fiberId"

/**
 * @since 1.0.0
 * @category symbols
 */
export const FiberIdTypeId: unique symbol = internal.FiberIdTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type FiberIdTypeId = typeof FiberIdTypeId

/**
 * @since 1.0.0
 * @category models
 */
export type FiberId = None | Runtime | Composite

/**
 * @since 1.0.0
 * @category models
 */
export interface None extends Equal.Equal {
  readonly [FiberIdTypeId]: FiberIdTypeId
  readonly _tag: "None"
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Runtime extends Equal.Equal {
  readonly [FiberIdTypeId]: FiberIdTypeId
  readonly _tag: "Runtime"
  readonly id: number
  readonly startTimeMillis: number
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Composite extends Equal.Equal {
  readonly [FiberIdTypeId]: FiberIdTypeId
  readonly _tag: "Composite"
  readonly left: FiberId
  readonly right: FiberId
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const none: FiberId = internal.none

/**
 * @since 1.0.0
 * @category constructors
 */
export const runtime: (id: number, startTimeMillis: number) => FiberId = internal.runtime

/**
 * @since 1.0.0
 * @category constructors
 */
export const composite: (left: FiberId, right: FiberId) => FiberId = internal.composite

/**
 * Returns `true` if the specified unknown value is a `FiberId`, `false`
 * otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isFiberId: (self: unknown) => self is FiberId = internal.isFiberId

/**
 * Returns `true` if the `FiberId` is a `None`, `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isNone: (self: FiberId) => self is None = internal.isNone

/**
 * Returns `true` if the `FiberId` is a `Runtime`, `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isRuntime: (self: FiberId) => self is Runtime = internal.isRuntime

/**
 * Returns `true` if the `FiberId` is a `Composite`, `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isComposite: (self: FiberId) => self is Composite = internal.isComposite

/**
 * Combine two `FiberId`s.
 *
 * @since 1.0.0
 * @category constructors
 */
export const combine: {
  (that: FiberId): (self: FiberId) => FiberId
  (self: FiberId, that: FiberId): FiberId
} = internal.combine

/**
 * Combines a set of `FiberId`s into a single `FiberId`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const combineAll: (fiberIds: HashSet.HashSet<FiberId>) => FiberId = internal.combineAll

/**
 * Returns this `FiberId` if it is not `None`, otherwise returns that `FiberId`.
 *
 * @since 1.0.0
 * @category utils
 */
export const getOrElse: {
  (that: FiberId): (self: FiberId) => FiberId
  (self: FiberId, that: FiberId): FiberId
} = internal.getOrElse

/**
 * Get the set of identifiers for this `FiberId`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const ids: (self: FiberId) => HashSet.HashSet<number> = internal.ids

/**
 * Creates a new `FiberId`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make: (id: number, startTimeSeconds: number) => FiberId = internal.make

/**
 * Creates a string representing the name of the current thread of execution
 * represented by the specified `FiberId`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const threadName: (self: FiberId) => string = internal.threadName

/**
 * Convert a `FiberId` into an `Option<FiberId>`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toOption: (self: FiberId) => Option.Option<FiberId> = internal.toOption

/**
 * Convert a `FiberId` into a `HashSet<FiberId>`.
 *
 * @since 1.0.0
 * @category destructors
 */
export const toSet: (self: FiberId) => HashSet.HashSet<Runtime> = internal.toSet

/**
 * Unsafely creates a new `FiberId`.
 *
 * @since 1.0.0
 * @category unsafe
 */
export const unsafeMake: (_: void) => Runtime = internal.unsafeMake
