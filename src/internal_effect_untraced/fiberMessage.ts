import type * as Cause from "@effect/io/Cause"
import type * as Effect from "@effect/io/Effect"
import type * as FiberStatus from "@effect/io/Fiber/Status"
import type * as FiberRuntime from "@effect/io/internal_effect_untraced/fiberRuntime"

/** @internal */
export type FiberMessage = InterruptSignal | Stateful | Resume | YieldNow

/** @internal */
export const OP_INTERRUPT_SIGNAL = "InterruptSignal" as const

/** @internal */
export type OP_INTERRUPT_SIGNAL = typeof OP_INTERRUPT_SIGNAL

/** @internal */
export const OP_STATEFUL = "Stateful" as const

/** @internal */
export type OP_STATEFUL = typeof OP_STATEFUL

/** @internal */
export const OP_RESUME = "Resume" as const

/** @internal */
export type OP_RESUME = typeof OP_RESUME

/** @internal */
export const OP_YIELD_NOW = "YieldNow" as const

/** @internal */
export type OP_YIELD_NOW = typeof OP_YIELD_NOW

/** @internal */
export interface InterruptSignal {
  readonly _tag: OP_INTERRUPT_SIGNAL
  readonly cause: Cause.Cause<never>
}

/** @internal */
export interface Stateful {
  readonly _tag: OP_STATEFUL
  readonly onFiber: (
    fiber: FiberRuntime.FiberRuntime<any, any>,
    status: FiberStatus.FiberStatus
  ) => void
}

/** @internal */
export interface Resume {
  readonly _tag: OP_RESUME
  readonly effect: Effect.Effect<any, any, any>
}

/** @internal */
export interface YieldNow {
  readonly _tag: OP_YIELD_NOW
}

/** @internal */
export const interruptSignal = (cause: Cause.Cause<never>): FiberMessage => ({
  _tag: OP_INTERRUPT_SIGNAL,
  cause
})

/** @internal */
export const stateful = (
  onFiber: (
    fiber: FiberRuntime.FiberRuntime<any, any>,
    status: FiberStatus.FiberStatus
  ) => void
): FiberMessage => ({
  _tag: OP_STATEFUL,
  onFiber
})

/** @internal */
export const resume = (effect: Effect.Effect<any, any, any>): FiberMessage => ({
  _tag: OP_RESUME,
  effect
})

/** @internal */
export const yieldNow = (): FiberMessage => ({
  _tag: OP_YIELD_NOW
})
