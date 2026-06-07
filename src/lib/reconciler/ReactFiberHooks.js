import ReactSharedInternals from "../shared/ReactSharedInternals";
import {
    Passive as PassiveEffect,
    PassiveStatic as PassiveStaticEffect,
    Update as UpdateEffect,
} from "./ReactFiberFlags";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop";
import {
    HasEffect as HookHasEffect,
    Layout as HookLayout,
    Passive as HookPassive,
    Insertion as HookInsertion,
} from "./ReactHookEffectTags";
// 记录当前正在render的Fiber节点
let currentlyRenderingFiber = null;
// 记录当前正在处理的hook
let currentHook = null;
// 记录当前正在处理的hook在链表上的位置
let workInProgressHook = null;

/**
 * 判断新旧依赖项是否相等
 * @param {*} nextDeps
 * @param {*} prevDeps
 * @returns
 */
export function areHookInputsEqual(nextDeps, prevDeps) {
    if (prevDeps === null || nextDeps === null) {
        return false;
    }

    for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
        // 使用 Object.is 进行比较
        if (Object.is(prevDeps[i], nextDeps[i])) {
            continue;
        }
        return false;
    }
    return true;
}

/**
 * 生成hook链表，fiber上的memoizedState绑定第一个hook
 * 后续的hook通过next关联
 * hook的状态保存在memoizedState中
 * @returns
 */
function mountWorkInProgressHook() {
    const hook = {
        // 表示当前 hook 的状态
        memoizedState: null,
        // 表示当前 hook 的初始状态
        baseState: null,
        // 表示当前 hook 的更新队列
        baseQueue: null,
        // 表示当前 hook 的更新队列中最后一个更新对象
        queue: null,
        // 表示当前 hook 在链表上的下一个 hook 对象
        next: null,
    };

    if (workInProgressHook === null) {
        // 当前hook链表上没有任何hook对象了，说明这是第一个hook对象
        currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
    } else {
        // 已有就继续往链表上添加
        workInProgressHook = workInProgressHook.next = hook;
    }
    return workInProgressHook;
}

function updateWorkInProgressHook() {
    let nextCurrentHook;
    if (currentHook === null) {
        const current = currentlyRenderingFiber.alternate;
        if (current !== null) {
            nextCurrentHook = current.memoizedState;
        } else {
            nextCurrentHook = null;
        }
    } else {
        nextCurrentHook = currentHook.next;
    }

    let nextWorkInProgressHook;
    if (workInProgressHook === null) {
        nextWorkInProgressHook = currentlyRenderingFiber.memoizedState;
    } else {
        nextWorkInProgressHook = workInProgressHook.next;
    }

    if (nextWorkInProgressHook !== null) {
        workInProgressHook = nextWorkInProgressHook;
        nextWorkInProgressHook = workInProgressHook.next;

        currentHook = nextCurrentHook;
    } else {
        if (nextCurrentHook === null) {
            const currentFiber = currentlyRenderingFiber.alternate;
        }

        currentHook = nextCurrentHook;

        const newHook = {
            memoizedState: currentHook.memoizedState,

            baseState: currentHook.baseState,
            baseQueue: currentHook.baseQueue,
            queue: currentHook.queue,

            next: null,
        };

        if (workInProgressHook === null) {
            // This is the first hook in the list.
            currentlyRenderingFiber.memoizedState = workInProgressHook =
                newHook;
        } else {
            // Append to the end of the list.
            workInProgressHook = workInProgressHook.next = newHook;
        }
    }
    return workInProgressHook;
}

function createEffectInstance() {
    return { destroy: undefined };
}

function mountRef(initialValue) {
    const hook = mountWorkInProgressHook();
    const ref = { current: initialValue };
    hook.memoizedState = ref;
    return ref;
}

function updateRef(initialValue) {
    const hook = updateWorkInProgressHook();
    return hook.memoizedState;
}
function pushSimpleEffect(tag, inst, create, deps) {
    const effect = {
        tag,
        create,
        deps,
        inst,
        // Circular
        next: null,
    };
    // 将 effect 对象添加到 fiber 对象的 updateQueue 属性上
    return pushEffectImpl(effect);
}
function pushEffectImpl(effect) {
    // updateQueue 是一个环形链表，lastEffect 属性指向链表上的最后一个 effect 对象
    const fiber = currentlyRenderingFiber;
    let updateQueue = fiber.updateQueue;
    if (updateQueue === null) {
        updateQueue = fiber.updateQueue = {
            lastEffect: null,
        };
        updateQueue.lastEffect = effect.next = effect;
    } else {
        const lastEffect = updateQueue.lastEffect;
        lastEffect.next = effect;
        updateQueue.lastEffect = effect;
    }
    return effect;
}
function mountEffectImpl(fiberFlags, hookFlags, create, deps) {
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    currentlyRenderingFiber.flags |= fiberFlags;
    hook.memoizedState = pushSimpleEffect(
        HookHasEffect | hookFlags,
        createEffectInstance(),
        create,
        nextDeps,
    );
}

function updateEffectImpl(fiberFlags, hookFlags, create, deps) {
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    const effect = hook.memoizedState;
    const inst = effect.inst;

    // currentHook is null on initial mount when rerendering after a render phase
    // state update or for strict mode.
    if (currentHook !== null) {
        if (nextDeps !== null) {
            const prevEffect = currentHook.memoizedState;
            const prevDeps = prevEffect.deps;
            // $FlowFixMe[incompatible-call] (@poteto)
            if (areHookInputsEqual(nextDeps, prevDeps)) {
                hook.memoizedState = pushSimpleEffect(
                    hookFlags,
                    inst,
                    create,
                    nextDeps,
                );
                return;
            }
        }
    }

    currentlyRenderingFiber.flags |= fiberFlags;

    hook.memoizedState = pushSimpleEffect(
        HookHasEffect | hookFlags,
        inst,
        create,
        nextDeps,
    );
}

function mountEffect(create, deps) {
    mountEffectImpl(
        PassiveEffect | PassiveStaticEffect,
        HookPassive,
        create,
        deps,
    );
}

function updateEffect(create, deps) {
    updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function mountCallback(callback, deps) {
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    // 将 callback 和 deps 存储在 hook 对象的 memoizedState 属性上
    hook.memoizedState = [callback, nextDeps];
    return callback;
}

function updateCallback(callback, deps) {
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    // 获取已有的 callback 和 deps
    const prevState = hook.memoizedState;
    if (nextDeps !== null) {
        // 判断能否复用已有的 callback 和 deps，如果不能复用，就将新的 callback 和 deps 存储在 hook 对象的 memoizedState 属性上
        const prevDeps = prevState[1];
        if (areHookInputsEqual(nextDeps, prevDeps)) {
            return prevState[0];
        }
    }
    hook.memoizedState = [callback, nextDeps];
    return callback;
}

function mountMemo(nextCreate, deps) {
    const hook = mountWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    const nextValue = nextCreate();
    hook.memoizedState = [nextValue, nextDeps];
    return nextValue;
}

function updateMemo(nextCreate, deps) {
    const hook = updateWorkInProgressHook();
    const nextDeps = deps === undefined ? null : deps;
    const prevState = hook.memoizedState;
    // Assume these are defined. If they're not, areHookInputsEqual will warn.
    if (nextDeps !== null) {
        const prevDeps = prevState[1];
        if (areHookInputsEqual(nextDeps, prevDeps)) {
            return prevState[0];
        }
    }
    const nextValue = nextCreate();
    hook.memoizedState = [nextValue, nextDeps];
    return nextValue;
}

function basicStateReducer(state, action) {
    return typeof action === "function" ? action(state) : action;
}
function isRenderPhaseUpdate(fiber) {
    const alternate = fiber.alternate;
    return (
        fiber === currentlyRenderingFiber ||
        (alternate !== null && alternate === currentlyRenderingFiber)
    );
}
function dispatchReducerAction(fiber, queue, action) {
    const update = {
        action,
        next: null,
        hasEagerState: false,
        eagerState: null,
    };
    if (isRenderPhaseUpdate(fiber)) {
        // 当 dispatch 在 render 过程中被调用时，我们需要将 update 直接添加到当前 hook 的更新队列中，这样在当前 render 过程中就可以处理这个 update
        enqueueRenderPhaseUpdate(queue, update);
    } else {
        // 走到这里，说明是手动调用了dispatch，这是我们需要更新fiber，触发重新渲染
        scheduleUpdateOnFiber(fiber);
    }
}
function mountReducer(reducer, initialArg, init) {
    const hook = mountWorkInProgressHook();
    let initialState;
    if (init !== undefined) {
        initialState = init(initialArg);
    } else {
        initialState = initialArg;
    }
    hook.memoizedState = hook.baseState = initialState;
    const queue = {
        pending: null,
        dispatch: null,
        lastRenderedReducer: reducer,
        lastRenderedState: initialState,
    };
    hook.queue = queue;
    const dispatch = (queue.dispatch = dispatchReducerAction.bind(
        null,
        currentlyRenderingFiber,
        queue,
    ));
    return [hook.memoizedState, dispatch];
}

function updateReducer(reducer, initialArg, init) {
    const hook = updateWorkInProgressHook();
    return updateReducerImpl(hook, currentHook, reducer);
}

function updateReducerImpl(hook, current, reducer) {
    const queue = hook.queue;

    queue.lastRenderedReducer = reducer;

    // The last rebase update that is NOT part of the base state.
    let baseQueue = hook.baseQueue;

    // The last pending update that hasn't been processed yet.
    const pendingQueue = queue.pending;
    if (pendingQueue !== null) {
        // 如果还要有未处理的 update，说明我们需要将这些 update 添加到 baseQueue 中，这样在后续的 render 过程中就可以处理这些 update 了
        // We have new updates that haven't been processed yet.
        // We'll add them to the base queue.
        if (baseQueue !== null) {
            // Merge the pending queue and the base queue.
            const baseFirst = baseQueue.next;
            const pendingFirst = pendingQueue.next;
            baseQueue.next = pendingFirst;
            pendingQueue.next = baseFirst;
        }
        current.baseQueue = baseQueue = pendingQueue;
        queue.pending = null;
    }

    const baseState = hook.baseState;
    if (baseQueue === null) {
        // 如果没有任何 update，说明我们可以直接使用 baseState 作为最新的状态了，这样就不需要进行任何计算了
        hook.memoizedState = baseState;
    } else {
        // 计算最新的状态
        const first = baseQueue.next;
        let newState = baseState;

        let newBaseState = null;
        let newBaseQueueFirst = null;
        let newBaseQueueLast = null;
        let update = first;
        let didReadFromEntangledAsyncAction = false;
        do {
            if (update.hasEagerState) {
                //   eagerState优化点，如果 update 对象上已经有 eagerState 属性了，说明我们之前已经计算过这个 update 了，我们可以直接使用这个 eagerState 作为最新的状态了，这样就不需要再次计算了
                newState = update.eagerState;
            } else {
                newState = reducer(newState, action);
            }
            update = update.next;
        } while (update !== null && update !== first);

        if (newBaseQueueLast === null) {
            newBaseState = newState;
        } else {
            newBaseQueueLast.next = newBaseQueueFirst;
        }

        hook.memoizedState = newState;
        hook.baseState = newBaseState;
        hook.baseQueue = newBaseQueueLast;

        queue.lastRenderedState = newState;
    }

    const dispatch = queue.dispatch;
    return [hook.memoizedState, dispatch];
}

function mountStateImpl(initialState) {
    const hook = mountWorkInProgressHook();
    // 如果是函数，initialState保存函数的结果
    const initialStateValue =
        typeof initialState === "function" ? initialState() : initialState;
    // 保存在memoizedState中
    hook.memoizedState = hook.baseState = initialStateValue;
    // 生成链表
    const queue = {
        pending: null,
        dispatch: null,
        lastRenderedReducer: basicStateReducer,
        lastRenderedState: initialState,
    };
    hook.queue = queue;
    return hook;
}
function enqueueRenderPhaseUpdate(queue, update) {
    const pending = queue.pending;
    if (pending === null) {
        // This is the first update. Create a circular list.
        update.next = update;
    } else {
        update.next = pending.next;
        pending.next = update;
    }
    queue.pending = update;
}
function dispatchSetState(fiber, queue, action) {
    const update = {
        action,
        next: null,
        // eagerState优化点
        hasEagerState: false,
        eagerState: null,
    };
    if (isRenderPhaseUpdate(fiber)) {
        // 当 dispatch 在 render 过程中被调用时，我们需要将 update 直接添加到当前 hook 的更新队列中，这样在当前 render 过程中就可以处理这个 update
        enqueueRenderPhaseUpdate(queue, update);
    } else {
        // 走到这里，说明是手动调用了dispatch，这是我们需要更新fiber，触发重新渲染
        scheduleUpdateOnFiber(fiber);
    }
}
function mountState(initialState) {
    const hook = mountStateImpl(initialState);
    const queue = hook.queue;
    // 生成dispatch
    const dispatch = dispatchSetState.bind(
        null,
        currentlyRenderingFiber,
        queue,
    );
    queue.dispatch = dispatch;
    return [hook.memoizedState, dispatch];
}
const HooksDispatcherOnMount = {
    useCallback: mountCallback,
    useEffect: mountEffect,
    useMemo: mountMemo,
    useReducer: mountReducer,
    useRef: mountRef,
    useState: mountState,
};
const HooksDispatcherOnUpdate = {
    useCallback: updateCallback,
    useEffect: updateEffect,
    useMemo: updateMemo,
    useReducer: updateReducer,
    useRef: updateRef,
    useState: updateState,
};
function updateState(initialState) {
    return updateReducer(basicStateReducer, initialState);
}
/**
 * 返回最新状态的children
 * @param {*} currentFiber
 * @param {*} workInProgress
 * @param {*} Component
 */
export function renderWithHooks(currentFiber, workInProgress, Component) {
    currentlyRenderingFiber = workInProgress;
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;
    // 根据 currentFiber 和 workInProgress 来判断当前是 mount 还是 update 阶段
    ReactSharedInternals.H =
        current === null || current.memoizedState === null
            ? HooksDispatcherOnMount
            : HooksDispatcherOnUpdate;

    let children = Component(props, secondArg);
}
