import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request data carried through the async call tree for log correlation. */
export interface RequestContext {
	reqId: string;
	userId?: string;
}

const als = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with `ctx` as the active request context for the duration of the call tree. */
export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
	return als.run(ctx, fn);
}

/** The current request context, or `undefined` when called outside a `runWithContext` scope. */
export function getContext(): RequestContext | undefined {
	return als.getStore();
}

/** The current request's `reqId`, or `undefined` when called outside a request scope. */
export function getReqId(): string | undefined {
	return als.getStore()?.reqId;
}
