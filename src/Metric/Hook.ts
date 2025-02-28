/**
 * @since 1.0.0
 */
import type { LazyArg } from "@effect/data/Function"
import * as internal from "@effect/io/internal_effect_untraced/metric/hook"
import type * as MetricKey from "@effect/io/Metric/Key"
import type * as MetricState from "@effect/io/Metric/State"

/**
 * @since 1.0.0
 * @category symbols
 */
export const MetricHookTypeId: unique symbol = internal.MetricHookTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type MetricHookTypeId = typeof MetricHookTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface MetricHook<In, Out> extends MetricHook.Variance<In, Out> {
  readonly get: () => Out
  readonly update: (input: In) => void
}

/**
 * @since 1.0.0
 */
export declare namespace MetricHook {
  /**
   * @since 1.0.0
   * @category models
   */
  export type Root = MetricHook<any, MetricState.MetricState.Untyped>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Untyped = MetricHook<any, any>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Counter = MetricHook<number, MetricState.MetricState.Counter>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Gauge = MetricHook<number, MetricState.MetricState.Gauge>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Frequency = MetricHook<string, MetricState.MetricState.Frequency>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Histogram = MetricHook<number, MetricState.MetricState.Histogram>

  /**
   * @since 1.0.0
   * @category models
   */
  export type Summary = MetricHook<readonly [number, number], MetricState.MetricState.Summary>

  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<In, Out> {
    readonly [MetricHookTypeId]: {
      readonly _In: (_: In) => void
      readonly _Out: (_: never) => Out
    }
  }
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const make: <In, Out>(get: LazyArg<Out>, update: (input: In) => void) => MetricHook<In, Out> = internal.make

/**
 * @since 1.0.0
 * @category constructors
 */
export const counter: (_key: MetricKey.MetricKey.Counter) => MetricHook.Counter = internal.counter

/**
 * @since 1.0.0
 * @category constructors
 */
export const frequency: (_key: MetricKey.MetricKey.Frequency) => MetricHook.Frequency = internal.frequency

/**
 * @since 1.0.0
 * @category constructors
 */
export const gauge: (_key: MetricKey.MetricKey.Gauge, startAt: number) => MetricHook.Gauge = internal.gauge

/**
 * @since 1.0.0
 * @category constructors
 */
export const histogram: (key: MetricKey.MetricKey.Histogram) => MetricHook.Histogram = internal.histogram

/**
 * @since 1.0.0
 * @category constructors
 */
export const summary: (key: MetricKey.MetricKey.Summary) => MetricHook.Summary = internal.summary

/**
 * @since 1.0.0
 * @category utils
 */
export const onUpdate: {
  <In, Out>(f: (input: In) => void): (self: MetricHook<In, Out>) => MetricHook<In, Out>
  <In, Out>(self: MetricHook<In, Out>, f: (input: In) => void): MetricHook<In, Out>
} = internal.onUpdate
