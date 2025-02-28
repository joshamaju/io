import * as Context from "@effect/data/Context"
import * as Debug from "@effect/data/Debug"
import * as Either from "@effect/data/Either"
import type { LazyArg } from "@effect/data/Function"
import { pipe } from "@effect/data/Function"
import * as HashMap from "@effect/data/HashMap"
import * as HashSet from "@effect/data/HashSet"
import * as number from "@effect/data/Number"
import * as Option from "@effect/data/Option"
import * as RA from "@effect/data/ReadonlyArray"
import type * as Config from "@effect/io/Config"
import type * as ConfigError from "@effect/io/Config/Error"
import type * as ConfigProvider from "@effect/io/Config/Provider"
import type * as PathPatch from "@effect/io/Config/Provider/PathPatch"
import type * as Effect from "@effect/io/Effect"
import * as _config from "@effect/io/internal_effect_untraced/config"
import * as configError from "@effect/io/internal_effect_untraced/configError"
import * as pathPatch from "@effect/io/internal_effect_untraced/configProvider/pathPatch"
import * as core from "@effect/io/internal_effect_untraced/core"
import * as OpCodes from "@effect/io/internal_effect_untraced/opCodes/config"
import * as StringUtils from "@effect/io/internal_effect_untraced/string-utils"

const concat = <A, B>(l: Array<A>, r: Array<B>): Array<A | B> => [...l, ...r]

/** @internal */
const ConfigProviderSymbolKey = "@effect/io/Config/Provider"

/** @internal */
export const ConfigProviderTypeId: ConfigProvider.ConfigProviderTypeId = Symbol.for(
  ConfigProviderSymbolKey
) as ConfigProvider.ConfigProviderTypeId

/** @internal */
export const configProviderTag: Context.Tag<ConfigProvider.ConfigProvider, ConfigProvider.ConfigProvider> = Context.Tag(
  ConfigProviderTypeId
)

/** @internal */
const FlatConfigProviderSymbolKey = "@effect/io/Config/Provider/Flat"

/** @internal */
export const FlatConfigProviderTypeId: ConfigProvider.FlatConfigProviderTypeId = Symbol.for(
  FlatConfigProviderSymbolKey
) as ConfigProvider.FlatConfigProviderTypeId

/** @internal */
export const make = Debug.untracedMethod((restore) =>
  (
    load: <A>(config: Config.Config<A>) => Effect.Effect<never, ConfigError.ConfigError, A>,
    flattened: ConfigProvider.ConfigProvider.Flat
  ): ConfigProvider.ConfigProvider => ({
    [ConfigProviderTypeId]: ConfigProviderTypeId,
    load: Debug.methodWithTrace((trace) => (config) => restore(load)(config).traced(trace)),
    flattened
  })
)

/** @internal */
export const makeFlat = Debug.untracedMethod((restore) =>
  (
    load: <A>(
      path: Array<string>,
      config: Config.Config.Primitive<A>,
      split: boolean
    ) => Effect.Effect<never, ConfigError.ConfigError, Array<A>>,
    enumerateChildren: (
      path: Array<string>
    ) => Effect.Effect<never, ConfigError.ConfigError, HashSet.HashSet<string>>,
    patch: PathPatch.PathPatch
  ): ConfigProvider.ConfigProvider.Flat => ({
    [FlatConfigProviderTypeId]: FlatConfigProviderTypeId,
    patch,
    load: Debug.methodWithTrace((trace) =>
      (path, config, split = true) => restore(load)(path, config, split).traced(trace)
    ),
    enumerateChildren: Debug.methodWithTrace((trace) => (path) => restore(enumerateChildren)(path).traced(trace))
  })
)

/** @internal */
export const fromFlat = Debug.untracedMethod(() =>
  (flat: ConfigProvider.ConfigProvider.Flat): ConfigProvider.ConfigProvider =>
    make(
      (config) =>
        core.flatMap(fromFlatLoop(flat, RA.empty(), config, false), (chunk) =>
          pipe(
            RA.head(chunk),
            Option.match(
              () =>
                core.fail(
                  configError.MissingData(
                    RA.empty(),
                    `Expected a single value having structure: ${config}`
                  )
                ),
              core.succeed
            )
          )),
      flat
    )
)

/** @internal */
export const fromEnv = Debug.untracedMethod(() =>
  (config: Partial<ConfigProvider.ConfigProvider.FromEnvConfig> = {}): ConfigProvider.ConfigProvider => {
    const { pathDelim, seqDelim } = Object.assign({}, { pathDelim: "_", seqDelim: "," }, config)
    const makePathString = (path: Array<string>): string => pipe(path, RA.join(pathDelim))
    const unmakePathString = (pathString: string): ReadonlyArray<string> => pathString.split(pathDelim)

    const getEnv = () =>
      typeof process !== "undefined" && "env" in process && typeof process.env === "object" ? process.env : {}

    const load = <A>(
      path: Array<string>,
      primitive: Config.Config.Primitive<A>,
      split = true
    ): Effect.Effect<never, ConfigError.ConfigError, Array<A>> => {
      const pathString = makePathString(path)
      const current = getEnv()
      const valueOpt = pathString in current ? Option.some(current[pathString]!) : Option.none()
      return pipe(
        valueOpt,
        core.mapError(() => configError.MissingData(path, `Expected ${pathString} to exist in the process context`)),
        core.flatMap((value) => parsePrimitive(value, path, primitive, seqDelim, split))
      )
    }

    const enumerateChildren = (
      path: Array<string>
    ): Effect.Effect<never, ConfigError.ConfigError, HashSet.HashSet<string>> =>
      core.sync(() => {
        const current = getEnv()
        const keys = Object.keys(current)
        const keyPaths = Array.from(keys).map((value) => unmakePathString(value.toUpperCase()))
        const filteredKeyPaths = keyPaths.filter((keyPath) => {
          for (let i = 0; i < path.length; i++) {
            const pathComponent = pipe(path, RA.unsafeGet(i))
            const currentElement = keyPath[i]
            if (currentElement === undefined || pathComponent !== currentElement) {
              return false
            }
          }
          return true
        }).flatMap((keyPath) => keyPath.slice(path.length, path.length + 1))
        return HashSet.fromIterable(filteredKeyPaths)
      })

    return fromFlat(makeFlat(load, enumerateChildren, pathPatch.empty))
  }
)

/** @internal */
export const fromMap = Debug.untracedMethod(() =>
  (
    map: Map<string, string>,
    config: Partial<ConfigProvider.ConfigProvider.FromMapConfig> = {}
  ): ConfigProvider.ConfigProvider => {
    const { pathDelim, seqDelim } = Object.assign({}, { seqDelim: ",", pathDelim: "." }, config)
    const makePathString = (path: Array<string>): string => pipe(path, RA.join(pathDelim))
    const unmakePathString = (pathString: string): ReadonlyArray<string> => pathString.split(pathDelim)
    const mapWithIndexSplit = splitIndexInKeys(
      map,
      (str) => Array.from(unmakePathString(str)),
      makePathString
    )
    const load = <A>(
      path: Array<string>,
      primitive: Config.Config.Primitive<A>,
      split = true
    ): Effect.Effect<never, ConfigError.ConfigError, Array<A>> => {
      const pathString = makePathString(path)
      const valueOpt = mapWithIndexSplit.has(pathString) ?
        Option.some(mapWithIndexSplit.get(pathString)!) :
        Option.none()
      return pipe(
        valueOpt,
        core.mapError(() => configError.MissingData(path, `Expected ${pathString} to exist in the provided map`)),
        core.flatMap((value) => parsePrimitive(value, path, primitive, seqDelim, split))
      )
    }
    const enumerateChildren = (
      path: Array<string>
    ): Effect.Effect<never, ConfigError.ConfigError, HashSet.HashSet<string>> =>
      core.sync(() => {
        const keyPaths = Array.from(mapWithIndexSplit.keys()).map(unmakePathString)
        const filteredKeyPaths = keyPaths.filter((keyPath) => {
          for (let i = 0; i < path.length; i++) {
            const pathComponent = pipe(path, RA.unsafeGet(i))
            const currentElement = keyPath[i]
            if (currentElement === undefined || pathComponent !== currentElement) {
              return false
            }
          }
          return true
        }).flatMap((keyPath) => keyPath.slice(path.length, path.length + 1))
        return HashSet.fromIterable(filteredKeyPaths)
      })

    return fromFlat(makeFlat(load, enumerateChildren, pathPatch.empty))
  }
)

const extend = <A, B>(
  leftDef: (n: number) => A,
  rightDef: (n: number) => B,
  left: Array<A>,
  right: Array<B>
): readonly [Array<A>, Array<B>] => {
  const leftPad = RA.unfold(
    left.length,
    (index) =>
      index >= right.length ?
        Option.none() :
        Option.some([leftDef(index), index + 1])
  )
  const rightPad = RA.unfold(
    right.length,
    (index) =>
      index >= left.length ?
        Option.none() :
        Option.some([rightDef(index), index + 1])
  )
  const leftExtension = concat(left, leftPad)
  const rightExtension = concat(right, rightPad)
  return [leftExtension, rightExtension]
}

const fromFlatLoop = <A>(
  flat: ConfigProvider.ConfigProvider.Flat,
  prefix: Array<string>,
  config: Config.Config<A>,
  split: boolean
): Effect.Effect<never, ConfigError.ConfigError, Array<A>> => {
  const op = config as _config.ConfigPrimitive
  switch (op._tag) {
    case OpCodes.OP_CONSTANT: {
      return core.succeed(RA.of(op.value)) as Effect.Effect<
        never,
        ConfigError.ConfigError,
        Array<A>
      >
    }
    case OpCodes.OP_DESCRIBED: {
      return core.suspend(
        () => fromFlatLoop(flat, prefix, op.config, split)
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
    case OpCodes.OP_FAIL: {
      return core.fail(configError.MissingData(prefix, op.message)) as Effect.Effect<
        never,
        ConfigError.ConfigError,
        Array<A>
      >
    }
    case OpCodes.OP_FALLBACK: {
      return pipe(
        core.suspend(() => fromFlatLoop(flat, prefix, op.first, split)),
        core.catchAll((error1) => {
          if (op.condition(error1)) {
            return pipe(
              fromFlatLoop(flat, prefix, op.second, split),
              core.catchAll((error2) => core.fail(configError.Or(error1, error2)))
            )
          }
          return core.fail(error1)
        })
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
    case OpCodes.OP_LAZY: {
      return core.suspend(() => fromFlatLoop(flat, prefix, op.config(), split)) as Effect.Effect<
        never,
        ConfigError.ConfigError,
        Array<A>
      >
    }
    case OpCodes.OP_MAP_OR_FAIL: {
      return core.suspend(() =>
        pipe(
          fromFlatLoop(flat, prefix, op.original, split),
          core.flatMap(
            core.forEach((a) =>
              pipe(
                op.mapOrFail(a),
                core.mapError(configError.prefixed(prefix))
              )
            )
          )
        )
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
    case OpCodes.OP_NESTED: {
      return core.suspend(() =>
        fromFlatLoop(
          flat,
          concat(prefix, RA.of(op.name)),
          op.config,
          split
        )
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
    case OpCodes.OP_PRIMITIVE: {
      return pipe(
        pathPatch.patch(prefix, flat.patch),
        core.flatMap((prefix) =>
          pipe(
            flat.load(prefix, op, split),
            core.flatMap((values) => {
              if (values.length === 0) {
                const name = pipe(RA.last(prefix), Option.getOrElse(() => "<n/a>"))
                return core.fail(_config.missingError(name))
              }
              return core.succeed(values)
            })
          )
        )
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
    case OpCodes.OP_SEQUENCE: {
      return pipe(
        pathPatch.patch(prefix, flat.patch),
        core.flatMap((patchedPrefix) =>
          pipe(
            flat.enumerateChildren(patchedPrefix),
            core.flatMap(indicesFrom),
            core.flatMap((indices) => {
              if (indices.length === 0) {
                return core.suspend(() =>
                  core.map(fromFlatLoop(flat, patchedPrefix, op.config, true), RA.of)
                ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
              }
              return pipe(
                core.forEach(
                  indices,
                  (index) => fromFlatLoop(flat, RA.append(prefix, `[${index}]`), op.config, true)
                ),
                core.map((chunkChunk) => {
                  const flattened = RA.flatten(chunkChunk)
                  if (flattened.length === 0) {
                    return RA.of(RA.empty<A>())
                  }
                  return RA.of(flattened)
                })
              ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
            })
          )
        )
      )
    }
    case OpCodes.OP_TABLE: {
      return core.suspend(() =>
        pipe(
          pathPatch.patch(prefix, flat.patch),
          core.flatMap((prefix) =>
            pipe(
              flat.enumerateChildren(prefix),
              core.flatMap((keys) => {
                return pipe(
                  keys,
                  core.forEach((key) =>
                    fromFlatLoop(
                      flat,
                      concat(prefix, RA.of(key)),
                      op.valueConfig,
                      split
                    )
                  ),
                  core.map((values) => {
                    if (values.length === 0) {
                      return RA.of(HashMap.empty())
                    }
                    const matrix = values.map((x) => Array.from(x))
                    return pipe(
                      transpose(matrix),
                      RA.map((values) => HashMap.fromIterable(RA.zip(RA.fromIterable(keys), values)))
                    )
                  })
                )
              })
            )
          )
        )
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
    case OpCodes.OP_ZIP_WITH: {
      return core.suspend(() =>
        pipe(
          fromFlatLoop(flat, prefix, op.left, split),
          core.either,
          core.flatMap((left) =>
            pipe(
              fromFlatLoop(flat, prefix, op.right, split),
              core.either,
              core.flatMap((right) => {
                if (Either.isLeft(left) && Either.isLeft(right)) {
                  return core.fail(configError.And(left.left, right.left))
                }
                if (Either.isLeft(left) && Either.isRight(right)) {
                  return core.fail(left.left)
                }
                if (Either.isRight(left) && Either.isLeft(right)) {
                  return core.fail(right.left)
                }
                if (Either.isRight(left) && Either.isRight(right)) {
                  const path = pipe(prefix, RA.join("."))
                  const fail = fromFlatLoopFail(prefix, path)
                  const [lefts, rights] = extend(
                    fail,
                    fail,
                    pipe(left.right, RA.map(Either.right)),
                    pipe(right.right, RA.map(Either.right))
                  )
                  return pipe(
                    lefts,
                    RA.zip(rights),
                    core.forEach(([left, right]) =>
                      pipe(
                        core.zip(left, right),
                        core.map(([left, right]) => op.zip(left, right))
                      )
                    )
                  )
                }
                throw new Error(
                  "BUG: ConfigProvider.fromFlatLoop - please report an issue at https://github.com/Effect-TS/io/issues"
                )
              })
            )
          )
        )
      ) as unknown as Effect.Effect<never, ConfigError.ConfigError, Array<A>>
    }
  }
}

const fromFlatLoopFail = (prefix: Array<string>, path: string) =>
  (index: number): Either.Either<ConfigError.ConfigError, unknown> =>
    Either.left(
      configError.MissingData(
        prefix,
        `The element at index ${index} in a sequence at path "${path}" was missing`
      )
    )

/** @internal */
export const contramapPath = Debug.untracedDual<
  (f: (path: string) => string) => (self: ConfigProvider.ConfigProvider) => ConfigProvider.ConfigProvider,
  (self: ConfigProvider.ConfigProvider, f: (path: string) => string) => ConfigProvider.ConfigProvider
>(2, (restore) => (self, f) => fromFlat(contramapPathFlat(self.flattened, restore(f))))

const contramapPathFlat = (
  self: ConfigProvider.ConfigProvider.Flat,
  f: (path: string) => string
): ConfigProvider.ConfigProvider.Flat =>
  makeFlat(
    (path, config, split = true) => self.load(path, config, split),
    (path) => self.enumerateChildren(path),
    pathPatch.mapName(self.patch, f)
  )

/** @internal */
export const nested = Debug.untracedDual<
  (name: string) => (self: ConfigProvider.ConfigProvider) => ConfigProvider.ConfigProvider,
  (self: ConfigProvider.ConfigProvider, name: string) => ConfigProvider.ConfigProvider
>(2, () =>
  (self, name) =>
    fromFlat(makeFlat(
      (path, config) => self.flattened.load(path, config, true),
      (path) => self.flattened.enumerateChildren(path),
      pathPatch.nested(self.flattened.patch, name)
    )))

/** @internal */
export const unnested = Debug.untracedDual<
  (name: string) => (self: ConfigProvider.ConfigProvider) => ConfigProvider.ConfigProvider,
  (self: ConfigProvider.ConfigProvider, name: string) => ConfigProvider.ConfigProvider
>(2, () =>
  (self, name) =>
    fromFlat(makeFlat(
      (path, config) => self.flattened.load(path, config, true),
      (path) => self.flattened.enumerateChildren(path),
      pathPatch.unnested(self.flattened.patch, name)
    )))

/** @internal */
export const orElse = Debug.untracedDual<
  (
    that: LazyArg<ConfigProvider.ConfigProvider>
  ) => (
    self: ConfigProvider.ConfigProvider
  ) => ConfigProvider.ConfigProvider,
  (
    self: ConfigProvider.ConfigProvider,
    that: LazyArg<ConfigProvider.ConfigProvider>
  ) => ConfigProvider.ConfigProvider
>(2, (restore) => (self, that) => fromFlat(orElseFlat(self.flattened, () => restore(that)().flattened)))

const orElseFlat = (
  self: ConfigProvider.ConfigProvider.Flat,
  that: LazyArg<ConfigProvider.ConfigProvider.Flat>
): ConfigProvider.ConfigProvider.Flat =>
  makeFlat(
    (path, config, split) =>
      pipe(
        pathPatch.patch(path, self.patch),
        core.flatMap((patch) => self.load(patch, config, split)),
        core.catchAll((error1) =>
          pipe(
            core.sync(that),
            core.flatMap((that) =>
              pipe(
                pathPatch.patch(path, that.patch),
                core.flatMap((patch) => that.load(patch, config, split)),
                core.catchAll((error2) => core.fail(configError.Or(error1, error2)))
              )
            )
          )
        )
      ),
    (path) =>
      pipe(
        pathPatch.patch(path, self.patch),
        core.flatMap((patch) => self.enumerateChildren(patch)),
        core.either,
        core.flatMap((left) =>
          pipe(
            core.sync(that),
            core.flatMap((that) =>
              pipe(
                pathPatch.patch(path, that.patch),
                core.flatMap((patch) => that.enumerateChildren(patch)),
                core.either,
                core.flatMap((right) => {
                  if (Either.isLeft(left) && Either.isLeft(right)) {
                    return core.fail(configError.And(left.left, right.left))
                  }
                  if (Either.isLeft(left) && Either.isRight(right)) {
                    return core.succeed(right.right)
                  }
                  if (Either.isRight(left) && Either.isLeft(right)) {
                    return core.succeed(left.right)
                  }
                  if (Either.isRight(left) && Either.isRight(right)) {
                    return core.succeed(pipe(left.right, HashSet.union(right.right)))
                  }
                  throw new Error(
                    "BUG: ConfigProvider.orElseFlat - please report an issue at https://github.com/Effect-TS/io/issues"
                  )
                })
              )
            )
          )
        )
      ),
    pathPatch.empty
  )

/** @internal */
export const constantCase = (self: ConfigProvider.ConfigProvider): ConfigProvider.ConfigProvider =>
  contramapPath(self, StringUtils.constantCase)

/** @internal */
export const kebabCase = (self: ConfigProvider.ConfigProvider): ConfigProvider.ConfigProvider =>
  contramapPath(self, StringUtils.kebabCase)

/** @internal */
export const lowerCase = (self: ConfigProvider.ConfigProvider): ConfigProvider.ConfigProvider =>
  contramapPath(self, StringUtils.lowerCase)

/** @internal */
export const snakeCase = (self: ConfigProvider.ConfigProvider): ConfigProvider.ConfigProvider =>
  contramapPath(self, StringUtils.snakeCase)

/** @internal */
export const upperCase = (self: ConfigProvider.ConfigProvider): ConfigProvider.ConfigProvider =>
  contramapPath(self, StringUtils.upperCase)

/** @internal */
export const within = Debug.untracedDual<
  (
    path: Array<string>,
    f: (self: ConfigProvider.ConfigProvider) => ConfigProvider.ConfigProvider
  ) => (self: ConfigProvider.ConfigProvider) => ConfigProvider.ConfigProvider,
  (
    self: ConfigProvider.ConfigProvider,
    path: Array<string>,
    f: (self: ConfigProvider.ConfigProvider) => ConfigProvider.ConfigProvider
  ) => ConfigProvider.ConfigProvider
>(3, () =>
  (self, path, f) => {
    const unnest = RA.reduce(path, self, (provider, name) => unnested(provider, name))
    const nest = RA.reduceRight(path, f(unnest), (provider, name) => nested(provider, name))
    return orElse(nest, () => self)
  })

const splitPathString = (text: string, delim: string): Array<string> => {
  const split = text.split(new RegExp(`\\s*${escapeRegex(delim)}\\s*`))
  return split
}

const parsePrimitive = <A>(
  text: string,
  path: Array<string>,
  primitive: Config.Config.Primitive<A>,
  delimiter: string,
  split: boolean
): Effect.Effect<never, ConfigError.ConfigError, Array<A>> => {
  if (!split) {
    return pipe(
      primitive.parse(text),
      core.map(RA.of),
      core.mapError(configError.prefixed(path))
    )
  }
  return pipe(
    splitPathString(text, delimiter),
    core.forEach((char) => primitive.parse(char.trim())),
    core.mapError(configError.prefixed(path))
  )
}

const transpose = <A>(array: Array<Array<A>>): Array<Array<A>> => {
  return Object.keys(array[0]).map((column) => array.map((row) => row[column as any]))
}

const escapeRegex = (string: string): string => {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&")
}

const indicesFrom = (quotedIndices: HashSet.HashSet<string>): Effect.Effect<never, never, Array<number>> =>
  pipe(
    core.forEach(quotedIndices, parseQuotedIndex),
    core.mapBoth(() => RA.empty<number>(), RA.sort(number.Order)),
    core.either,
    core.map(Either.merge)
  )

const STR_INDEX_REGEX = /(^.+)(\[(\d+)\])$/
const QUOTED_INDEX_REGEX = /^(\[(\d+)\])$/

const parseQuotedIndex = (str: string): Option.Option<number> => {
  const match = str.match(QUOTED_INDEX_REGEX)
  if (match !== null) {
    const matchedIndex = match[2]
    return pipe(
      matchedIndex !== undefined && matchedIndex.length > 0 ?
        Option.some(matchedIndex) :
        Option.none(),
      Option.flatMap(parseInteger)
    )
  }
  return Option.none()
}

const splitIndexInKeys = (
  map: Map<string, string>,
  unmakePathString: (str: string) => Array<string>,
  makePathString: (chunk: Array<string>) => string
): Map<string, string> => {
  const newMap: Map<string, string> = new Map()
  for (const [pathString, value] of map) {
    const keyWithIndex = pipe(
      unmakePathString(pathString),
      RA.flatMap((key) =>
        Option.match(
          splitIndexFrom(key),
          () => RA.of(key),
          ([key, index]) => RA.make(key, `[${index}]`)
        )
      )
    )
    newMap.set(makePathString(keyWithIndex), value)
  }
  return newMap
}

const splitIndexFrom = (key: string): Option.Option<readonly [string, number]> => {
  const match = key.match(STR_INDEX_REGEX)
  if (match !== null) {
    const matchedString = match[1]
    const matchedIndex = match[3]
    const optionalString = matchedString !== undefined && matchedString.length > 0 ?
      Option.some(matchedString) :
      Option.none()
    const optionalIndex = pipe(
      matchedIndex !== undefined && matchedIndex.length > 0 ?
        Option.some(matchedIndex) :
        Option.none(),
      Option.flatMap(parseInteger)
    )
    return Option.tuple(optionalString, optionalIndex)
  }
  return Option.none()
}

const parseInteger = (str: string): Option.Option<number> => {
  const parsedIndex = Number.parseInt(str)
  return Number.isNaN(parsedIndex) ?
    Option.none() :
    Option.some(parsedIndex)
}
