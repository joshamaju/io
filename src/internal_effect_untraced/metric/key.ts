import type * as Chunk from "@effect/data/Chunk"
import type * as Duration from "@effect/data/Duration"
import * as Equal from "@effect/data/Equal"
import { dual, pipe } from "@effect/data/Function"
import * as Hash from "@effect/data/Hash"
import * as HashSet from "@effect/data/HashSet"
import * as Option from "@effect/data/Option"
import * as metricKeyType from "@effect/io/internal_effect_untraced/metric/keyType"
import * as metricLabel from "@effect/io/internal_effect_untraced/metric/label"
import type * as MetricBoundaries from "@effect/io/Metric/Boundaries"
import type * as MetricKey from "@effect/io/Metric/Key"
import type * as MetricKeyType from "@effect/io/Metric/KeyType"
import type * as MetricLabel from "@effect/io/Metric/Label"

/** @internal */
const MetricKeySymbolKey = "@effect/io/Metric/Key"

/** @internal */
export const MetricKeyTypeId: MetricKey.MetricKeyTypeId = Symbol.for(
  MetricKeySymbolKey
) as MetricKey.MetricKeyTypeId

/** @internal */
const metricKeyVariance = {
  _Type: (_: never) => _
}

/** @internal */
class MetricKeyImpl<Type extends MetricKeyType.MetricKeyType<any, any>> implements MetricKey.MetricKey<Type> {
  readonly [MetricKeyTypeId] = metricKeyVariance
  constructor(
    readonly name: string,
    readonly keyType: Type,
    readonly description: Option.Option<string>,
    readonly tags: HashSet.HashSet<MetricLabel.MetricLabel> = HashSet.empty()
  ) {}
  [Hash.symbol](): number {
    return pipe(
      Hash.hash(this.name),
      Hash.combine(Hash.hash(this.keyType)),
      Hash.combine(Hash.hash(this.description)),
      Hash.combine(Hash.hash(this.tags))
    )
  }
  [Equal.symbol](u: unknown): boolean {
    return isMetricKey(u) &&
      this.name === u.name &&
      Equal.equals(this.keyType, u.keyType) &&
      Equal.equals(this.description, u.description) &&
      Equal.equals(this.tags, u.tags)
  }
}

/** @internal */
export const isMetricKey = (u: unknown): u is MetricKey.MetricKey<MetricKeyType.MetricKeyType<unknown, unknown>> =>
  typeof u === "object" && u != null && MetricKeyTypeId in u

/** @internal */
export const counter = (name: string, description?: string): MetricKey.MetricKey.Counter =>
  new MetricKeyImpl(name, metricKeyType.counter, Option.fromNullable(description))

/** @internal */
export const frequency = (name: string, description?: string): MetricKey.MetricKey.Frequency =>
  new MetricKeyImpl(name, metricKeyType.frequency, Option.fromNullable(description))

/** @internal */
export const gauge = (name: string, description?: string): MetricKey.MetricKey.Gauge =>
  new MetricKeyImpl(name, metricKeyType.gauge, Option.fromNullable(description))

/** @internal */
export const histogram = (
  name: string,
  boundaries: MetricBoundaries.MetricBoundaries,
  description?: string
): MetricKey.MetricKey.Histogram =>
  new MetricKeyImpl(
    name,
    metricKeyType.histogram(boundaries),
    Option.fromNullable(description)
  )

/** @internal */
export const summary = (
  name: string,
  maxAge: Duration.Duration,
  maxSize: number,
  error: number,
  quantiles: Chunk.Chunk<number>,
  description?: string
): MetricKey.MetricKey.Summary =>
  new MetricKeyImpl(
    name,
    metricKeyType.summary(maxAge, maxSize, error, quantiles),
    Option.fromNullable(description)
  )

/** @internal */
export const tagged = dual<
  (
    key: string,
    value: string
  ) => <Type extends MetricKeyType.MetricKeyType<any, any>>(
    self: MetricKey.MetricKey<Type>
  ) => MetricKey.MetricKey<Type>,
  <Type extends MetricKeyType.MetricKeyType<any, any>>(
    self: MetricKey.MetricKey<Type>,
    key: string,
    value: string
  ) => MetricKey.MetricKey<Type>
>(3, (self, key, value) => taggedWithLabelSet(self, HashSet.make(metricLabel.make(key, value))))

/** @internal */
export const taggedWithLabels = dual<
  (
    extraTags: Iterable<MetricLabel.MetricLabel>
  ) => <Type extends MetricKeyType.MetricKeyType<any, any>>(
    self: MetricKey.MetricKey<Type>
  ) => MetricKey.MetricKey<Type>,
  <Type extends MetricKeyType.MetricKeyType<any, any>>(
    self: MetricKey.MetricKey<Type>,
    extraTags: Iterable<MetricLabel.MetricLabel>
  ) => MetricKey.MetricKey<Type>
>(2, (self, extraTags) => taggedWithLabelSet(self, HashSet.fromIterable(extraTags)))

/** @internal */
export const taggedWithLabelSet = dual<
  (
    extraTags: HashSet.HashSet<MetricLabel.MetricLabel>
  ) => <Type extends MetricKeyType.MetricKeyType<any, any>>(
    self: MetricKey.MetricKey<Type>
  ) => MetricKey.MetricKey<Type>,
  <Type extends MetricKeyType.MetricKeyType<any, any>>(
    self: MetricKey.MetricKey<Type>,
    extraTags: HashSet.HashSet<MetricLabel.MetricLabel>
  ) => MetricKey.MetricKey<Type>
>(2, (self, extraTags) =>
  HashSet.size(extraTags) === 0
    ? self
    : new MetricKeyImpl(self.name, self.keyType, self.description, pipe(self.tags, HashSet.union(extraTags))))
