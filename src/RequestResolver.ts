/**
 * @since 1.0.0
 */

import * as Context from "@effect/data/Context"
import type * as Either from "@effect/data/Either"
import type * as Equal from "@effect/data/Equal"
import * as Effect from "@effect/io/Effect"
import type { FiberRef } from "@effect/io/FiberRef"
import * as core from "@effect/io/internal_effect_untraced/core"
import * as internal from "@effect/io/internal_effect_untraced/dataSource"
import type * as Request from "@effect/io/Request"

/**
 * @since 1.0.0
 * @category symbols
 */
export const RequestResolverTypeId: unique symbol = core.RequestResolverTypeId

/**
 * @since 1.0.0
 * @category symbols
 */
export type RequestResolverTypeId = typeof RequestResolverTypeId

/**
 * A `RequestResolver<A, R>` requires an environment `R` and is capable of executing
 * requests of type `A`.
 *
 * Data sources must implement the method `runAll` which takes a collection of
 * requests and returns an effect with a `RequestCompletionMap` containing a
 * mapping from requests to results. The type of the collection of requests is
 * a `Chunk<Chunk<A>>`. The outer `Chunk` represents batches of requests that
 * must be performed sequentially. The inner `Chunk` represents a batch of
 * requests that can be performed in parallel. This allows data sources to
 * introspect on all the requests being executed and optimize the query.
 *
 * Data sources will typically be parameterized on a subtype of `Request<A>`,
 * though that is not strictly necessarily as long as the data source can map
 * the request type to a `Request<A>`. Data sources can then pattern match on
 * the collection of requests to determine the information requested, execute
 * the query, and place the results into the `RequestCompletionMap` using
 * `RequestCompletionMap.empty` and `RequestCompletionMap.insert`. Data
 * sources must provide results for all requests received. Failure to do so
 * will cause a query to die with a `QueryFailure` when run.
 *
 * @since 1.0.0
 * @category models
 */
export interface RequestResolver<A, R = never> extends Equal.Equal {
  /**
   * Execute a collection of requests. The outer `Chunk` represents batches
   * of requests that must be performed sequentially. The inner `Chunk`
   * represents a batch of requests that can be performed in parallel.
   */
  runAll(requests: Array<Array<Request.Entry<A>>>): Effect.Effect<R, never, void>

  /**
   * Identify the data source using the specific identifier
   */
  identified(...identifiers: Array<unknown>): RequestResolver<A, R>
}

/**
 * @since 1.0.0
 */
export declare namespace RequestResolver {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Variance<R, A> {
    readonly [RequestResolverTypeId]: {
      readonly _R: (_: never) => R
      readonly _A: (_: never) => A
    }
  }
}

/**
 * @since 1.0.0
 * @category utils
 */
export const contextFromEffect = <R, A extends Request.Request<any, any>>(self: RequestResolver<A, R>) =>
  Effect.contextWith((_: Context.Context<R>) => provideContext(self, _))

/**
 * @since 1.0.0
 * @category utils
 */
export const contextFromServices = <Services extends Array<Context.Tag<any, any>>>(...services: Services) =>
  <R, A extends Request.Request<any, any>>(
    self: RequestResolver<A, R>
  ): Effect.Effect<
    { [k in keyof Services]: Effect.Effect.Context<Services[k]> }[number],
    never,
    RequestResolver<A, Exclude<R, { [k in keyof Services]: Effect.Effect.Context<Services[k]> }[number]>>
  > => Effect.contextWith((_) => provideContext(self as any, Context.pick(...services)(_ as any)))

/**
 * Returns `true` if the specified value is a `RequestResolver`, `false` otherwise.
 *
 * @since 1.0.0
 * @category refinements
 */
export const isRequestResolver: (u: unknown) => u is RequestResolver<unknown, unknown> = core.isRequestResolver

/**
 * Constructs a data source with the specified identifier and method to run
 * requests.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make: <R, A>(
  runAll: (requests: Array<Array<A>>) => Effect.Effect<R, never, void>
) => RequestResolver<A, R> = internal.make

/**
 * Constructs a data source with the specified identifier and method to run
 * requests.
 *
 * @since 1.0.0
 * @category constructors
 */
export const makeWithEntry: <R, A>(
  runAll: (requests: Array<Array<Request.Entry<A>>>) => Effect.Effect<R, never, void>
) => RequestResolver<A, R> = internal.makeWithEntry

/**
 * Constructs a data source from a function taking a collection of requests
 * and returning a `RequestCompletionMap`.
 *
 * @since 1.0.0
 * @category constructors
 */
export const makeBatched: <R, A extends Request.Request<any, any>>(
  run: (requests: Array<A>) => Effect.Effect<R, never, void>
) => RequestResolver<A, R> = internal.makeBatched

/**
 * A data source aspect that executes requests between two effects, `before`
 * and `after`, where the result of `before` can be used by `after`.
 *
 * @since 1.0.0
 * @category combinators
 */
export const around: {
  <R2, A2, R3, _>(
    before: Effect.Effect<R2, never, A2>,
    after: (a: A2) => Effect.Effect<R3, never, _>
  ): <R, A>(self: RequestResolver<A, R>) => RequestResolver<A, R2 | R3 | R>
  <R, A, R2, A2, R3, _>(
    self: RequestResolver<A, R>,
    before: Effect.Effect<R2, never, A2>,
    after: (a: A2) => Effect.Effect<R3, never, _>
  ): RequestResolver<A, R | R2 | R3>
} = internal.around

/**
 * Returns a data source that executes at most `n` requests in parallel.
 *
 * @since 1.0.0
 * @category combinators
 */
export const batchN: {
  (n: number): <R, A>(self: RequestResolver<A, R>) => RequestResolver<A, R>
  <R, A>(self: RequestResolver<A, R>, n: number): RequestResolver<A, R>
} = internal.batchN

/**
 * Provides this data source with part of its required context.
 *
 * @since 1.0.0
 * @category context
 */
export const contramapContext: {
  <R0, R>(
    f: (context: Context.Context<R0>) => Context.Context<R>
  ): <A extends Request.Request<any, any>>(self: RequestResolver<A, R>) => RequestResolver<A, R0>
  <R, A extends Request.Request<any, any>, R0>(
    self: RequestResolver<A, R>,
    f: (context: Context.Context<R0>) => Context.Context<R>
  ): RequestResolver<A, R0>
} = internal.contramapContext

/**
 * Returns a new data source that executes requests of type `C` using the
 * specified function to transform `C` requests into requests that either this
 * data source or that data source can execute.
 *
 * @since 1.0.0
 * @category combinators
 */
export const eitherWith: {
  <A extends Request.Request<any, any>, R2, B extends Request.Request<any, any>, C extends Request.Request<any, any>>(
    that: RequestResolver<B, R2>,
    f: (_: Request.Entry<C>) => Either.Either<Request.Entry<A>, Request.Entry<B>>
  ): <R>(self: RequestResolver<A, R>) => RequestResolver<C, R2 | R>
  <
    R,
    A extends Request.Request<any, any>,
    R2,
    B extends Request.Request<any, any>,
    C extends Request.Request<any, any>
  >(
    self: RequestResolver<A, R>,
    that: RequestResolver<B, R2>,
    f: (_: Request.Entry<C>) => Either.Either<Request.Entry<A>, Request.Entry<B>>
  ): RequestResolver<C, R | R2>
} = internal.eitherWith

/**
 * Constructs a data source from a pure function.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromFunction: <A extends Request.Request<never, any>>(
  f: (request: A) => Request.Request.Success<A>
) => RequestResolver<A, never> = internal.fromFunction

/**
 * Constructs a data source from a pure function that takes a list of requests
 * and returns a list of results of the same size. Each item in the result
 * list must correspond to the item at the same index in the request list.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromFunctionBatched: <A extends Request.Request<never, any>>(
  f: (chunk: Array<A>) => Array<Request.Request.Success<A>>
) => RequestResolver<A, never> = internal.fromFunctionBatched

/**
 * Constructs a data source from an effectual function.
 *
 * @since 1.0.0
 * @category constructors
 */
export const fromFunctionEffect: <R, A extends Request.Request<any, any>>(
  f: (a: A) => Effect.Effect<R, Request.Request.Error<A>, Request.Request.Success<A>>
) => RequestResolver<A, R> = internal.fromFunctionEffect

/**
 * A data source that never executes requests.
 *
 * @since 1.0.0
 * @category constructors
 */
export const never: (_: void) => RequestResolver<never, never> = internal.never

/**
 * Provides this data source with its required context.
 *
 * @since 1.0.0
 * @category context
 */
export const provideContext: {
  <R>(
    context: Context.Context<R>
  ): <A extends Request.Request<any, any>>(self: RequestResolver<A, R>) => RequestResolver<A, never>
  <R, A extends Request.Request<any, any>>(
    self: RequestResolver<A, R>,
    context: Context.Context<R>
  ): RequestResolver<A, never>
} = internal.provideContext

/**
 * Returns a new data source that executes requests by sending them to this
 * data source and that data source, returning the results from the first data
 * source to complete and safely interrupting the loser.
 *
 * @since 1.0.0
 * @category combinators
 */
export const race: {
  <R2, A2 extends Request.Request<any, any>>(
    that: RequestResolver<A2, R2>
  ): <R, A extends Request.Request<any, any>>(self: RequestResolver<A, R>) => RequestResolver<A2 | A, R2 | R>
  <R, A extends Request.Request<any, any>, R2, A2 extends Request.Request<any, any>>(
    self: RequestResolver<A, R>,
    that: RequestResolver<A2, R2>
  ): RequestResolver<A | A2, R | R2>
} = internal.race

/**
 * Returns a new data source with a localized FiberRef
 *
 * @since 1.0.0
 * @category combinators
 */
export const locally: {
  <A>(
    self: FiberRef<A>,
    value: A
  ): <R, B extends Request.Request<any, any>>(use: RequestResolver<B, R>) => RequestResolver<B, R>
  <R, B extends Request.Request<any, any>, A>(
    use: RequestResolver<B, R>,
    self: FiberRef<A>,
    value: A
  ): RequestResolver<B, R>
} = core.resolverLocally
