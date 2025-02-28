/**
 * @since 1.0.0
 */
import * as internal from "@effect/io/internal_effect_untraced/schedule/decision"
import type * as Interval from "@effect/io/Schedule/Interval"
import type * as Intervals from "@effect/io/Schedule/Intervals"

/**
 * @since 1.0.0
 * @category models
 */
export type ScheduleDecision = Continue | Done

/**
 * @since 1.0.0
 * @category models
 */
export interface Continue {
  readonly _tag: "Continue"
  readonly intervals: Intervals.Intervals
}

/**
 * @since 1.0.0
 * @category models
 */
export interface Done {
  readonly _tag: "Done"
}

const _continue = internal._continue
export {
  /**
   * @since 1.0.0
   * @category constructors
   */
  _continue as continue
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const continueWith: (interval: Interval.Interval) => ScheduleDecision = internal.continueWith

/**
 * @since 1.0.0
 * @category constructors
 */
export const done: ScheduleDecision = internal.done

/**
 * @since 1.0.0
 * @category refinements
 */
export const isContinue: (self: ScheduleDecision) => self is Continue = internal.isContinue

/**
 * @since 1.0.0
 * @category refinements
 */
export const isDone: (self: ScheduleDecision) => self is Done = internal.isDone
