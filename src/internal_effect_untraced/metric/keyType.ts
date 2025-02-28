import type * as Chunk from "@effect/data/Chunk"
import type * as Duration from "@effect/data/Duration"
import * as Equal from "@effect/data/Equal"
import { pipe } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import type * as MetricBoundaries from "@effect/io/Metric/Boundaries"
import type * as MetricKeyType from "@effect/io/Metric/KeyType"

/** @internal */
const MetricKeyTypeSymbolKey = "@effect/io/Metric/KeyType"

/** @internal */
export const MetricKeyTypeTypeId: MetricKeyType.MetricKeyTypeTypeId = Symbol.for(
  MetricKeyTypeSymbolKey
) as MetricKeyType.MetricKeyTypeTypeId

/** @internal */
const CounterKeyTypeSymbolKey = "effect/io/Metric/KeyType/Counter"

/** @internal */
export const CounterKeyTypeTypeId: MetricKeyType.CounterKeyTypeTypeId = Symbol.for(
  CounterKeyTypeSymbolKey
) as MetricKeyType.CounterKeyTypeTypeId

/** @internal */
const FrequencyKeyTypeSymbolKey = "effect/io/Metric/KeyType/Frequency"

/** @internal */
export const FrequencyKeyTypeTypeId: MetricKeyType.FrequencyKeyTypeTypeId = Symbol.for(
  FrequencyKeyTypeSymbolKey
) as MetricKeyType.FrequencyKeyTypeTypeId

/** @internal */
const GaugeKeyTypeSymbolKey = "effect/io/Metric/KeyType/Gauge"

/** @internal */
export const GaugeKeyTypeTypeId: MetricKeyType.GaugeKeyTypeTypeId = Symbol.for(
  GaugeKeyTypeSymbolKey
) as MetricKeyType.GaugeKeyTypeTypeId

/** @internal */
const HistogramKeyTypeSymbolKey = "effect/io/Metric/KeyType/Histogram"

/** @internal */
export const HistogramKeyTypeTypeId: MetricKeyType.HistogramKeyTypeTypeId = Symbol.for(
  HistogramKeyTypeSymbolKey
) as MetricKeyType.HistogramKeyTypeTypeId

/** @internal */
const SummaryKeyTypeSymbolKey = "effect/io/Metric/KeyType/Summary"

/** @internal */
export const SummaryKeyTypeTypeId: MetricKeyType.SummaryKeyTypeTypeId = Symbol.for(
  SummaryKeyTypeSymbolKey
) as MetricKeyType.SummaryKeyTypeTypeId

/** @internal */
const metricKeyTypeVariance = {
  _In: (_: unknown) => _,
  _Out: (_: never) => _
}

/** @internal */
class CounterKeyType implements MetricKeyType.MetricKeyType.Counter {
  readonly [MetricKeyTypeTypeId] = metricKeyTypeVariance
  readonly [CounterKeyTypeTypeId]: MetricKeyType.CounterKeyTypeTypeId = CounterKeyTypeTypeId;
  [Hash.symbol](): number {
    return Hash.hash(CounterKeyTypeSymbolKey)
  }
  [Equal.symbol](that: unknown): boolean {
    return isCounterKey(that)
  }
}

/** @internal */
class FrequencyKeyType implements MetricKeyType.MetricKeyType.Frequency {
  readonly [MetricKeyTypeTypeId] = metricKeyTypeVariance
  readonly [FrequencyKeyTypeTypeId]: MetricKeyType.FrequencyKeyTypeTypeId = FrequencyKeyTypeTypeId;
  [Hash.symbol](): number {
    return Hash.hash(FrequencyKeyTypeSymbolKey)
  }
  [Equal.symbol](that: unknown): boolean {
    return isFrequencyKey(that)
  }
}

/** @internal */
class GaugeKeyType implements MetricKeyType.MetricKeyType.Gauge {
  readonly [MetricKeyTypeTypeId] = metricKeyTypeVariance
  readonly [GaugeKeyTypeTypeId]: MetricKeyType.GaugeKeyTypeTypeId = GaugeKeyTypeTypeId;
  [Hash.symbol](): number {
    return Hash.hash(GaugeKeyTypeSymbolKey)
  }
  [Equal.symbol](that: unknown): boolean {
    return isGaugeKey(that)
  }
}

/**
 * @category model
 * @since 1.0.0
 */
export class HistogramKeyType implements MetricKeyType.MetricKeyType.Histogram {
  readonly [MetricKeyTypeTypeId] = metricKeyTypeVariance
  readonly [HistogramKeyTypeTypeId]: MetricKeyType.HistogramKeyTypeTypeId = HistogramKeyTypeTypeId
  constructor(readonly boundaries: MetricBoundaries.MetricBoundaries) {}
  [Hash.symbol](): number {
    return pipe(
      Hash.hash(HistogramKeyTypeSymbolKey),
      Hash.combine(Hash.hash(this.boundaries))
    )
  }
  [Equal.symbol](that: unknown): boolean {
    return isHistogramKey(that) && Equal.equals(this.boundaries, that.boundaries)
  }
}

/** @internal */
class SummaryKeyType implements MetricKeyType.MetricKeyType.Summary {
  readonly [MetricKeyTypeTypeId] = metricKeyTypeVariance
  readonly [SummaryKeyTypeTypeId]: MetricKeyType.SummaryKeyTypeTypeId = SummaryKeyTypeTypeId
  constructor(
    readonly maxAge: Duration.Duration,
    readonly maxSize: number,
    readonly error: number,
    readonly quantiles: Chunk.Chunk<number>
  ) {}
  [Hash.symbol](): number {
    return pipe(
      Hash.hash(SummaryKeyTypeSymbolKey),
      Hash.combine(Hash.hash(this.maxAge)),
      Hash.combine(Hash.hash(this.maxSize)),
      Hash.combine(Hash.hash(this.error)),
      Hash.combine(Hash.hash(this.quantiles))
    )
  }
  [Equal.symbol](that: unknown): boolean {
    return isSummaryKey(that) &&
      Equal.equals(this.maxAge, that.maxAge) &&
      this.maxSize === that.maxSize &&
      this.error === that.error &&
      Equal.equals(this.quantiles, that.quantiles)
  }
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const counter: MetricKeyType.MetricKeyType.Counter = new CounterKeyType()

/**
 * @since 1.0.0
 * @category constructors
 */
export const frequency: MetricKeyType.MetricKeyType.Frequency = new FrequencyKeyType()

/**
 * @since 1.0.0
 * @category constructors
 */
export const gauge: MetricKeyType.MetricKeyType.Gauge = new GaugeKeyType()

/**
 * @since 1.0.0
 * @category constructors
 */
export const histogram = (boundaries: MetricBoundaries.MetricBoundaries): MetricKeyType.MetricKeyType.Histogram => {
  return new HistogramKeyType(boundaries)
}

/**
 * @since 1.0.0
 * @category constructors
 */
export const summary = (
  maxAge: Duration.Duration,
  maxSize: number,
  error: number,
  quantiles: Chunk.Chunk<number>
): MetricKeyType.MetricKeyType.Summary => {
  return new SummaryKeyType(maxAge, maxSize, error, quantiles)
}

/**
 * @since 1.0.0
 * @category refinements
 */
export const isMetricKeyType = (u: unknown): u is MetricKeyType.MetricKeyType<unknown, unknown> => {
  return typeof u === "object" && u != null && MetricKeyTypeTypeId in u
}

/**
 * @since 1.0.0
 * @category refinements
 */
export const isCounterKey = (u: unknown): u is MetricKeyType.MetricKeyType.Counter => {
  return typeof u === "object" && u != null && CounterKeyTypeTypeId in u
}

/**
 * @since 1.0.0
 * @category refinements
 */
export const isFrequencyKey = (u: unknown): u is MetricKeyType.MetricKeyType.Frequency => {
  return typeof u === "object" && u != null && FrequencyKeyTypeTypeId in u
}

/**
 * @since 1.0.0
 * @category refinements
 */
export const isGaugeKey = (u: unknown): u is MetricKeyType.MetricKeyType.Gauge => {
  return typeof u === "object" && u != null && GaugeKeyTypeTypeId in u
}

/**
 * @since 1.0.0
 * @category refinements
 */
export const isHistogramKey = (u: unknown): u is MetricKeyType.MetricKeyType.Histogram => {
  return typeof u === "object" && u != null && HistogramKeyTypeTypeId in u
}

/**
 * @since 1.0.0
 * @category refinements
 */
export const isSummaryKey = (u: unknown): u is MetricKeyType.MetricKeyType.Summary => {
  return typeof u === "object" && u != null && SummaryKeyTypeTypeId in u
}
