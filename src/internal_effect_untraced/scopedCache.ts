import * as Context from "@effect/data/Context"
import * as Data from "@effect/data/Data"
import * as Debug from "@effect/data/Debug"
import type * as Duration from "@effect/data/Duration"
import * as Equal from "@effect/data/Equal"
import { pipe } from "@effect/data/Function"
import * as HashSet from "@effect/data/HashSet"
import * as MutableHashMap from "@effect/data/MutableHashMap"
import * as MutableQueue from "@effect/data/MutableQueue"
import * as MutableRef from "@effect/data/MutableRef"
import * as Option from "@effect/data/Option"
import type * as Cache from "@effect/io/Cache"
import type * as Clock from "@effect/io/Clock"
import type * as Effect from "@effect/io/Effect"
import * as Exit from "@effect/io/Exit"
import * as _cache from "@effect/io/internal_effect_untraced/cache"
import * as core from "@effect/io/internal_effect_untraced/core"
import * as effect from "@effect/io/internal_effect_untraced/effect"
import * as fiberRuntime from "@effect/io/internal_effect_untraced/fiberRuntime"
import * as Scope from "@effect/io/Scope"
import type * as ScopedCache from "@effect/io/ScopedCache"

/**
 * The `CacheState` represents the mutable state underlying the cache.
 *
 * @internal
 */
export interface CacheState<Key, Error, Value> {
  map: MutableHashMap.MutableHashMap<Key, MapValue<Key, Error, Value>>
  keys: _cache.KeySet<Key>
  accesses: MutableQueue.MutableQueue<_cache.MapKey<Key>>
  updating: MutableRef.MutableRef<boolean>
  hits: number
  misses: number
}

/** @internal */
export const makeCacheState = <Key, Error, Value>(
  map: MutableHashMap.MutableHashMap<Key, MapValue<Key, Error, Value>>,
  keys: _cache.KeySet<Key>,
  accesses: MutableQueue.MutableQueue<_cache.MapKey<Key>>,
  updating: MutableRef.MutableRef<boolean>,
  hits: number,
  misses: number
): CacheState<Key, Error, Value> => ({
  map,
  keys,
  accesses,
  updating,
  hits,
  misses
})

/**
 * Constructs an initial cache state.
 *
 * @internal
 */
export const initialCacheState = <Key, Error, Value>(): CacheState<Key, Error, Value> =>
  makeCacheState(
    MutableHashMap.empty(),
    _cache.makeKeySet(),
    MutableQueue.unbounded(),
    MutableRef.make(false),
    0,
    0
  )

/**
 * A `MapValue` represents a value in the cache. A value may either be
 * `Pending` with a `Promise` that will contain the result of computing the
 * lookup function, when it is available, or `Complete` with an `Exit` value
 * that contains the result of computing the lookup function.
 *
 * @internal
 */
export type MapValue<Key, Error, Value> =
  | Complete<Key, Error, Value>
  | Pending<Key, Error, Value>
  | Refreshing<Key, Error, Value>

/** @internal */
export interface Complete<Key, Error, Value> {
  readonly _tag: "Complete"
  readonly key: _cache.MapKey<Key>
  readonly exit: Exit.Exit<Error, readonly [Value, Scope.Scope.Finalizer]>
  readonly ownerCount: MutableRef.MutableRef<number>
  readonly entryStats: Cache.EntryStats
  readonly timeToLive: number
}

/** @internal */
export interface Pending<Key, Error, Value> {
  readonly _tag: "Pending"
  readonly key: _cache.MapKey<Key>
  readonly scoped: Effect.Effect<never, never, Effect.Effect<Scope.Scope, Error, Value>>
}

/** @internal */
export interface Refreshing<Key, Error, Value> {
  readonly _tag: "Refreshing"
  readonly scoped: Effect.Effect<never, never, Effect.Effect<Scope.Scope, Error, Value>>
  readonly complete: Complete<Key, Error, Value>
}

/** @internal */
export const complete = <Key, Error, Value>(
  key: _cache.MapKey<Key>,
  exit: Exit.Exit<Error, readonly [Value, Scope.Scope.Finalizer]>,
  ownerCount: MutableRef.MutableRef<number>,
  entryStats: Cache.EntryStats,
  timeToLive: number
): Complete<Key, Error, Value> =>
  Data.struct({
    _tag: "Complete",
    key,
    exit,
    ownerCount,
    entryStats,
    timeToLive
  })

/** @internal */
export const pending = <Key, Error, Value>(
  key: _cache.MapKey<Key>,
  scoped: Effect.Effect<never, never, Effect.Effect<Scope.Scope, Error, Value>>
): Pending<Key, Error, Value> =>
  Data.struct({
    _tag: "Pending",
    key,
    scoped
  })

/** @internal */
export const refreshing = <Key, Error, Value>(
  scoped: Effect.Effect<never, never, Effect.Effect<Scope.Scope, Error, Value>>,
  complete: Complete<Key, Error, Value>
): Refreshing<Key, Error, Value> =>
  Data.struct({
    _tag: "Refreshing",
    scoped,
    complete
  })

/** @internal */
export const toScoped = <Key, Error, Value>(
  self: Complete<Key, Error, Value>
): Effect.Effect<Scope.Scope, Error, Value> =>
  Exit.matchEffect(
    self.exit,
    (cause) => core.done(Exit.failCause(cause)),
    ([value]) =>
      fiberRuntime.acquireRelease(
        core.as(core.sync(() => MutableRef.incrementAndGet(self.ownerCount)), value),
        () => releaseOwner(self)
      )
  )

/** @internal */
export const releaseOwner = <Key, Error, Value>(
  self: Complete<Key, Error, Value>
): Effect.Effect<never, never, void> =>
  Exit.matchEffect(
    self.exit,
    () => core.unit(),
    ([, finalizer]) =>
      core.flatMap(
        core.sync(() => MutableRef.decrementAndGet(self.ownerCount)),
        (numOwner) => effect.when(finalizer(Exit.unit()), () => numOwner === 0)
      )
  )

/** @internal */
const ScopedCacheSymbolKey = "@effect/io/ScopedCache"

/** @internal */
export const ScopedCacheTypeId: ScopedCache.ScopedCacheTypeId = Symbol.for(
  ScopedCacheSymbolKey
) as ScopedCache.ScopedCacheTypeId

const scopedCacheVariance = {
  _Key: (_: unknown) => _,
  _Error: (_: never) => _,
  _Value: (_: never) => _
}

class ScopedCacheImpl<Key, Environment, Error, Value> implements ScopedCache.ScopedCache<Key, Error, Value> {
  readonly [ScopedCacheTypeId] = scopedCacheVariance
  readonly cacheState: CacheState<Key, Error, Value>
  constructor(
    readonly capacity: number,
    readonly scopedLookup: ScopedCache.Lookup<Key, Environment, Error, Value>,
    readonly clock: Clock.Clock,
    readonly timeToLive: (exit: Exit.Exit<Error, Value>) => Duration.Duration,
    readonly context: Context.Context<Environment>
  ) {
    this.cacheState = initialCacheState()
  }

  cacheStats(): Effect.Effect<never, never, Cache.CacheStats> {
    return Debug.bodyWithTrace((trace) =>
      core.sync(() =>
        _cache.makeCacheStats(
          this.cacheState.hits,
          this.cacheState.misses,
          MutableHashMap.size(this.cacheState.map)
        )
      ).traced(trace)
    )
  }

  getOption(key: Key): Effect.Effect<Scope.Scope, Error, Option.Option<Value>> {
    return Debug.bodyWithTrace((trace) =>
      core.suspend(() =>
        Option.match(
          MutableHashMap.get(this.cacheState.map, key),
          () => effect.succeedNone(),
          (value) => core.flatten(this.resolveMapValue(value))
        )
      ).traced(trace)
    )
  }

  getOptionComplete(key: Key): Effect.Effect<Scope.Scope, never, Option.Option<Value>> {
    return Debug.bodyWithTrace((trace) =>
      core.suspend(() =>
        Option.match(
          MutableHashMap.get(this.cacheState.map, key),
          () => effect.succeedNone(),
          (value) =>
            core.flatten(this.resolveMapValue(value, true)) as Effect.Effect<Scope.Scope, never, Option.Option<Value>>
        )
      ).traced(trace)
    )
  }

  contains(key: Key): Effect.Effect<never, never, boolean> {
    return Debug.bodyWithTrace((trace) => core.sync(() => MutableHashMap.has(this.cacheState.map, key)).traced(trace))
  }

  entryStats(key: Key): Effect.Effect<never, never, Option.Option<Cache.EntryStats>> {
    return Debug.bodyWithTrace((trace) =>
      core.sync(() => {
        const value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
        if (value === undefined) {
          return Option.none()
        }
        switch (value._tag) {
          case "Complete": {
            return Option.some(_cache.makeEntryStats(value.entryStats.loadedMillis))
          }
          case "Pending": {
            return Option.none()
          }
          case "Refreshing": {
            return Option.some(_cache.makeEntryStats(value.complete.entryStats.loadedMillis))
          }
        }
      }).traced(trace)
    )
  }

  get(key: Key): Effect.Effect<Scope.Scope, Error, Value> {
    return Debug.bodyWithTrace((trace) =>
      pipe(
        this.lookupValueOf(key),
        effect.memoize,
        core.flatMap((lookupValue) =>
          core.suspend(() => {
            let k: _cache.MapKey<Key> | undefined = undefined
            let value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
            if (value === undefined) {
              k = _cache.makeMapKey(key)
              if (MutableHashMap.has(this.cacheState.map, key)) {
                value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
              } else {
                MutableHashMap.set(this.cacheState.map, key, pending(k, lookupValue))
              }
            }
            if (value === undefined) {
              this.trackMiss()
              return core.zipRight(
                this.ensureMapSizeNotExceeded(k!),
                lookupValue
              )
            }

            return core.map(
              this.resolveMapValue(value),
              effect.someOrElseEffect(() => {
                const val = value as Complete<Key, Error, Value>
                const current = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
                if (Equal.equals(current, value)) {
                  MutableHashMap.remove(this.cacheState.map, key)
                }
                return pipe(
                  this.ensureMapSizeNotExceeded(val.key),
                  core.zipRight(releaseOwner(val)),
                  core.zipRight(this.get(key))
                )
              })
            )
          })
        ),
        core.flatten
      ).traced(trace)
    )
  }

  invalidate(key: Key): Effect.Effect<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      core.suspend(() => {
        if (MutableHashMap.has(this.cacheState.map, key)) {
          const mapValue = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))!
          MutableHashMap.remove(this.cacheState.map, key)
          switch (mapValue._tag) {
            case "Complete": {
              return releaseOwner(mapValue)
            }
            case "Pending": {
              return core.unit()
            }
            case "Refreshing": {
              return releaseOwner(mapValue.complete)
            }
          }
        }
        return core.unit()
      }).traced(trace)
    )
  }

  invalidateAll(): Effect.Effect<never, never, void> {
    return Debug.bodyWithTrace((trace) =>
      fiberRuntime.forEachParDiscard(
        HashSet.fromIterable(Array.from(this.cacheState.map).map(([key]) => key)),
        (key) => this.invalidate(key)
      ).traced(trace)
    )
  }

  refresh(key: Key): Effect.Effect<never, Error, void> {
    return Debug.bodyWithTrace((trace) =>
      pipe(
        this.lookupValueOf(key),
        effect.memoize,
        core.flatMap((scoped) => {
          let value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
          let newKey: _cache.MapKey<Key> | undefined = undefined
          if (value === undefined) {
            newKey = _cache.makeMapKey(key)
            if (MutableHashMap.has(this.cacheState.map, key)) {
              value = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
            } else {
              MutableHashMap.set(this.cacheState.map, key, pending(newKey, scoped))
            }
          }
          let finalScoped: Effect.Effect<never, never, Effect.Effect<Scope.Scope, Error, Value>>
          if (value === undefined) {
            finalScoped = core.zipRight(
              this.ensureMapSizeNotExceeded(newKey!),
              scoped
            )
          } else {
            switch (value._tag) {
              case "Complete": {
                if (this.hasExpired(value.timeToLive)) {
                  finalScoped = core.succeed(this.get(key))
                } else {
                  const current = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
                  if (Equal.equals(current, value)) {
                    const mapValue = refreshing(scoped, value)
                    MutableHashMap.set(this.cacheState.map, key, mapValue)
                    finalScoped = scoped
                  } else {
                    finalScoped = core.succeed(this.get(key))
                  }
                }
                break
              }
              case "Pending": {
                finalScoped = value.scoped
                break
              }
              case "Refreshing": {
                finalScoped = value.scoped
                break
              }
            }
          }
          return core.flatMap(finalScoped, (s) => fiberRuntime.scopedEffect(core.asUnit(s)))
        })
      ).traced(trace)
    )
  }

  size(): Effect.Effect<never, never, number> {
    return Debug.bodyWithTrace((trace) => core.sync(() => MutableHashMap.size(this.cacheState.map)).traced(trace))
  }

  resolveMapValue(value: MapValue<Key, Error, Value>, ignorePending = false) {
    switch (value._tag) {
      case "Complete": {
        this.trackHit()
        if (this.hasExpired(value.timeToLive)) {
          return core.succeed(effect.succeedNone())
        }
        return core.as(
          this.ensureMapSizeNotExceeded(value.key),
          effect.asSome(toScoped(value))
        )
      }
      case "Pending": {
        this.trackHit()

        if (ignorePending) {
          return core.succeed(effect.succeedNone())
        }

        return core.zipRight(
          this.ensureMapSizeNotExceeded(value.key),
          core.map(value.scoped, effect.asSome)
        )
      }
      case "Refreshing": {
        this.trackHit()
        if (this.hasExpired(value.complete.timeToLive)) {
          if (ignorePending) {
            return core.succeed(effect.succeedNone())
          }
          return core.zipRight(
            this.ensureMapSizeNotExceeded(value.complete.key),
            core.map(value.scoped, effect.asSome)
          )
        }
        return core.as(
          this.ensureMapSizeNotExceeded(value.complete.key),
          effect.asSome(toScoped(value.complete))
        )
      }
    }
  }

  lookupValueOf(key: Key): Effect.Effect<never, never, Effect.Effect<Scope.Scope, Error, Value>> {
    return pipe(
      core.onInterrupt(
        core.flatMap(Scope.make(), (scope) =>
          pipe(
            this.scopedLookup(key),
            core.provideContext(pipe(this.context, Context.add(Scope.Scope, scope))),
            core.exit,
            core.map((exit) => [exit, ((exit) => Scope.close(scope, exit)) as Scope.Scope.Finalizer] as const)
          )),
        () => core.sync(() => MutableHashMap.remove(this.cacheState.map, key))
      ),
      core.flatMap(([exit, release]) => {
        const now = this.clock.unsafeCurrentTimeMillis()
        const expiredAt = now + this.timeToLive(exit).millis
        switch (exit._tag) {
          case "Success": {
            const exitWithFinalizer: Exit.Exit<never, [Value, Scope.Scope.Finalizer]> = Exit.succeed([
              exit.value,
              release
            ])
            const completedResult = complete<Key, Error, Value>(
              _cache.makeMapKey(key),
              exitWithFinalizer,
              MutableRef.make(1),
              _cache.makeEntryStats(now),
              expiredAt
            )
            let previousValue: MapValue<Key, Error, Value> | undefined = undefined
            if (MutableHashMap.has(this.cacheState.map, key)) {
              previousValue = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
            }
            MutableHashMap.set(this.cacheState.map, key, completedResult)
            return core.sync(() =>
              core.flatten(
                core.as(
                  this.cleanMapValue(previousValue),
                  toScoped(completedResult)
                )
              )
            )
          }
          case "Failure": {
            const completedResult = complete<Key, Error, Value>(
              _cache.makeMapKey(key),
              exit as Exit.Exit<Error, readonly [Value, Scope.Scope.Finalizer]>,
              MutableRef.make(0),
              _cache.makeEntryStats(now),
              expiredAt
            )
            let previousValue: MapValue<Key, Error, Value> | undefined = undefined
            if (MutableHashMap.has(this.cacheState.map, key)) {
              previousValue = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key))
            }
            MutableHashMap.set(this.cacheState.map, key, completedResult)
            return core.zipRight(
              release(exit),
              core.sync(() =>
                core.flatten(
                  core.as(
                    this.cleanMapValue(previousValue),
                    toScoped(completedResult)
                  )
                )
              )
            )
          }
        }
      }),
      effect.memoize,
      core.flatten
    )
  }

  hasExpired(timeToLive: number): boolean {
    return this.clock.unsafeCurrentTimeMillis() > timeToLive
  }

  trackHit(): void {
    this.cacheState.hits = this.cacheState.hits + 1
  }

  trackMiss(): void {
    this.cacheState.misses = this.cacheState.misses + 1
  }

  trackAccess(key: _cache.MapKey<Key>): Array<MapValue<Key, Error, Value>> {
    const cleanedKeys: Array<MapValue<Key, Error, Value>> = []
    MutableQueue.offer(this.cacheState.accesses, key)
    if (MutableRef.compareAndSet(this.cacheState.updating, false, true)) {
      let loop = true
      while (loop) {
        const key = MutableQueue.poll(this.cacheState.accesses, MutableQueue.EmptyMutableQueue)
        if (key === MutableQueue.EmptyMutableQueue) {
          loop = false
        } else {
          this.cacheState.keys.add(key)
        }
      }
      let size = MutableHashMap.size(this.cacheState.map)
      loop = size > this.capacity
      while (loop) {
        const key = this.cacheState.keys.remove()
        if (key === undefined) {
          loop = false
        } else {
          if (MutableHashMap.has(this.cacheState.map, key.current)) {
            const removed = Option.getOrUndefined(MutableHashMap.get(this.cacheState.map, key.current))!
            MutableHashMap.remove(this.cacheState.map, key.current)
            size = size - 1
            cleanedKeys.push(removed)
            loop = size > this.capacity
          }
        }
      }
      MutableRef.set(this.cacheState.updating, false)
    }
    return cleanedKeys
  }

  cleanMapValue(mapValue: MapValue<Key, Error, Value> | undefined): Effect.Effect<never, never, void> {
    if (mapValue === undefined) return core.unit()
    switch (mapValue._tag) {
      case "Complete": {
        return releaseOwner(mapValue)
      }
      case "Pending": {
        return core.unit()
      }
      case "Refreshing": {
        return releaseOwner(mapValue.complete)
      }
    }
  }

  ensureMapSizeNotExceeded(key: _cache.MapKey<Key>): Effect.Effect<never, never, void> {
    return fiberRuntime.forEachParDiscard(
      this.trackAccess(key),
      (cleanedMapValue) => this.cleanMapValue(cleanedMapValue)
    )
  }
}

/** @internal */
export const make = Debug.methodWithTrace((trace, restore) =>
  <Key, Environment, Error, Value>(
    capacity: number,
    timeToLive: Duration.Duration,
    lookup: ScopedCache.Lookup<Key, Environment, Error, Value>
  ): Effect.Effect<Environment | Scope.Scope, never, ScopedCache.ScopedCache<Key, Error, Value>> =>
    makeWith(capacity, restore(lookup), () => timeToLive).traced(trace)
)

/** @internal */
export const makeWith = Debug.methodWithTrace((trace, restore) =>
  <Key, Environment, Error, Value>(
    capacity: number,
    lookup: ScopedCache.Lookup<Key, Environment, Error, Value>,
    timeToLive: (exit: Exit.Exit<Error, Value>) => Duration.Duration
  ): Effect.Effect<Environment | Scope.Scope, never, ScopedCache.ScopedCache<Key, Error, Value>> =>
    core.flatMap(
      effect.clock(),
      (clock) => buildWith(capacity, restore(lookup), clock, restore(timeToLive))
    ).traced(trace)
)

const buildWith = <Key, Environment, Error, Value>(
  capacity: number,
  scopedLookup: ScopedCache.Lookup<Key, Environment, Error, Value>,
  clock: Clock.Clock,
  timeToLive: (exit: Exit.Exit<Error, Value>) => Duration.Duration
): Effect.Effect<Environment | Scope.Scope, never, ScopedCache.ScopedCache<Key, Error, Value>> =>
  fiberRuntime.acquireRelease(
    core.flatMap(
      core.context<Environment>(),
      (context) =>
        core.sync(() =>
          new ScopedCacheImpl(
            capacity,
            scopedLookup,
            clock,
            timeToLive,
            context
          )
        )
    ),
    (cache) => cache.invalidateAll()
  )
