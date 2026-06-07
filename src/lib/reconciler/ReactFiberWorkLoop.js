// 该文件负责整个 React 的一个执行流行

import beginWork from "./ReactFiberBeginWork";
import completeWork from "./ReactFiberCompleteWork";
import {
    scheduleCallback,
    shouldYieldToHost as shouldYield,
} from "../scheduler/Scheduler";
import {
    commitMutationEffects,
    commitPassiveUnmountEffects,
    commitBeforeMutationEffects,
    commitPassiveMountEffects,
    commitLayoutEffects,
} from "./ReactFiberCommitWork";
import {
    MutationMask,
    BeforeMutationMask,
    LayoutMask,
    PassiveMask,
    NoFlags,
} from "./ReactFiberFlags";
import {
    ImmediatePriority,
    NormalPriority,
} from "../scheduler/SchedulerPriorities";

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
export const RenderContext = /*         */ 0b010;
export const CommitContext = /*         */ 0b100;

// 用来说明当前在做什么工作：render、commit
let executionContext = NoContext;
// 记录当前正在收集effect的root
let pendingEffectsRoot = null;
// 记录正在完成complete的fiber
let pendingFinishedWork = null;

const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootSuspendedAtTheShell = 6;
const RootCompleted = 5;
// workInProgress 的英语全称为 work in progress，表示正在进行的工作
// 我们使用这个变量来保存当前正在进行的工作 fiber 对象
let workInProgress = null;

// 从名字上也可以看出，这是保存当前根节点的 fiber 对象
let workInProgressRoot = null;

export function scheduleUpdateOnFiber(fiber) {
    workInProgress = fiber;
    workInProgressRoot = fiber;

    // 使用 scheduler 包来进行调用
    // 当浏览器的每一帧有空闲时间的时候，就会执行 workloop 函数
    // while (workInProgress) {
    scheduleCallback(ImmediatePriority, workloop);
}

/**
 * 该函数会在每一帧有剩余时间的时候执行
 * @param {*} time 接收一个时间参数，如果超过了该时间，那么就不再处理下一个 fiber
 */
function workloop() {
    while (workInProgress) {
        if (!shouldYield()) {
            performUnitOfWork(); // 该方法负责处理一个 fiber 节点
        }
    }
    if (!workInProgress) {
        completeRoot(workInProgressRoot, workInProgressRoot);
    }
}

/**
 * 该函数主要负责处理一个 fiber 节点
 * 有下面的事情要做：
 * 1. 处理当前的 fiber 对象
 * 2. 通过深度优先遍历子节点，生成子节点的 fiber 对象，然后继续处理
 * 3. 提交副作用
 * 4. 进行渲染
 */
function performUnitOfWork() {
    const current = workInProgress.alternate; // 通过 alternate 属性，我们可以拿到当前 fiber 对象的老版本
    beginWork(current, workInProgress); // 处理当前的 fiber 对象

    // 如果有子节点，将 workInProgress 更新为子节点
    if (workInProgress.child) {
        // debugger;
        workInProgress = workInProgress.child;
        return;
    }

    completeWork(current, workInProgress);

    // 如果没有子节点，就需要找到兄弟节点
    let next = workInProgress; // 先缓存一下当前的 workInProgress
    while (next) {
        if (next.sibling) {
            workInProgress = next.sibling;
            return;
        }

        // 如果没有进入上面的 if，说明当前节点后面已经没有兄弟节点了
        // 那么就需要将父节点设置为当前正在工作的节点，然后在父亲那一层继续寻找兄弟节点
        next = next.return;

        // 在寻找父亲那一辈的兄弟节点之前，先执行一下 completeWork 方法
        completeWork(current, next);
    }

    // 如果执行到这里，说明整个 fiber 树都处理完了
    // 没有节点需要处理了
    workInProgress = null;
}

let pendingEffectsStatus = 0;
const NO_PENDING_EFFECTS = 0;
const PENDING_MUTATION_PHASE = 1;
const PENDING_LAYOUT_PHASE = 2;
const PENDING_AFTER_MUTATION_PHASE = 3;
const PENDING_SPAWNED_WORK = 4;
const PENDING_PASSIVE_PHASE = 5;

function flushPendingEffects() {
    // 依次推入队列，这里只列举useEffect()的场景
    // flushGestureMutations();
    // flushGestureAnimations();
    // flushMutationEffects();
    // flushLayoutEffects();
    // // Skip flushAfterMutation if we're forcing this early.
    // flushSpawnedWork();
    return flushPassiveEffects();
}
function flushPassiveEffects() {
    if (pendingEffectsStatus !== PENDING_PASSIVE_PHASE) {
        return false;
    }
    const root = pendingEffectsRoot;

    return flushPassiveEffectsImpl();
}
function flushPassiveEffectsImpl() {
    const root = pendingEffectsRoot;
    pendingEffectsStatus = NO_PENDING_EFFECTS;
    pendingEffectsRoot = null;
    pendingFinishedWork = null;
    const prevExecutionContext = executionContext;
    // 接入commit环境
    executionContext |= CommitContext;
    // 先收集unmount的effect
    commitPassiveUnmountEffects(root.current);
    // 再收集mount的effect
    commitPassiveMountEffects(root, root.current);
    // 退出commit环境
    executionContext = prevExecutionContext;
}

function completeRoot(root, finishedWork) {
    do {
        // 清理之前更新遗留的effect
        flushPendingEffects();
    } while (pendingEffectsStatus !== NO_PENDING_EFFECTS);
    // 进入commit阶段
    commitRoot(root, finishedWork);
}

/**
 * 执行该方法的时候，说明整个节点的协调工作已经完成
 * 接下来就进入到渲染阶段
 */
function commitRoot(root, finishedWork) {
    pendingFinishedWork = finishedWork;
    pendingEffectsRoot = root;
    // 省去处理pending passive effects的代码
    if (
        (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
        (finishedWork.flags & PassiveMask) !== NoFlags
    ) {
        scheduleCallback(NormalPriority, () => {
            // 通过schedule执行useEffect副作用代码，该代码会在commit结束后执行
            flushPassiveEffects();
        });
    }
    const subtreeHasBeforeMutationEffects =
        (finishedWork.subtreeFlags & (BeforeMutationMask | MutationMask)) !==
        NoFlags;
    const rootHasBeforeMutationEffect =
        (finishedWork.flags & (BeforeMutationMask | MutationMask)) !== NoFlags;
    if (subtreeHasBeforeMutationEffects || rootHasBeforeMutationEffect) {
        const prevExecutionContext = executionContext;
        executionContext |= CommitContext;
        try {
            // 有dom的副作用操作就执行commitBeforeMutationEffects
            // 主要工作：
            // 1、函数组件:更新事件绑定
            // 2、类组件：触发getSnapshotBeforeUpdate
            // 3、root节点，清空挂载内容
            commitBeforeMutationEffects(root, finishedWork);
        } finally {
            executionContext = prevExecutionContext;
        }
    }
    pendingEffectsStatus = PENDING_MUTATION_PHASE;

    // Flush synchronously.
    flushMutationEffects();
    flushLayoutEffects();
}
/**
 * 主要流程：
 * 1、执行dom插入、移动、更新，属性更新、ref卸载等
 * 2、执行insertionEffect的destroy
 * 3、执行insertionEffect的create
 * 4、执行layoutEffect的destroy
 * @returns
 */
function flushMutationEffects() {
    if (pendingEffectsStatus !== PENDING_MUTATION_PHASE) {
        // 必须同步执行，所以要保证之前的effect已处理完毕
        return;
    }
    pendingEffectsStatus = NO_PENDING_EFFECTS;
    const root = pendingEffectsRoot;
    const finishedWork = pendingFinishedWork;
    const subtreeMutationHasEffects =
        (finishedWork.subtreeFlags & MutationMask) !== NoFlags;
    const rootMutationHasEffect =
        (finishedWork.flags & MutationMask) !== NoFlags;
    if (subtreeMutationHasEffects || rootMutationHasEffect) {
        // 如果有effect，就执行
        const prevExecutionContext = executionContext;
        executionContext |= CommitContext;
        try {
            commitMutationEffects(root, finishedWork);
        } finally {
            executionContext = prevExecutionContext;
        }
    }
    root.current = finishedWork;
    pendingEffectsStatus = PENDING_LAYOUT_PHASE;
}
/**
 * 这里执行layoutEffect的create
 * 类组件的componentDidMount/componentDidUpdate、挂载ref
 * 所有同步任务执行完后就会开始执行effect的副作用函数
 * @returns
 */
function flushLayoutEffects() {
    if (pendingEffectsStatus !== PENDING_LAYOUT_PHASE) {
        return;
    }
    pendingEffectsStatus = NO_PENDING_EFFECTS;
    const root = pendingEffectsRoot;
    const finishedWork = pendingFinishedWork;
    const subtreeHasLayoutEffects =
        (finishedWork.subtreeFlags & LayoutMask) !== NoFlags;
    const rootHasLayoutEffect = (finishedWork.flags & LayoutMask) !== NoFlags;
    if (subtreeHasLayoutEffects || rootHasLayoutEffect) {
        const prevExecutionContext = executionContext;
        executionContext |= CommitContext;
        try {
            commitLayoutEffects(finishedWork, root);
        } finally {
            // Reset the priority to the previous non-sync value.
            executionContext = prevExecutionContext;
        }
    }
    pendingEffectsStatus = PENDING_AFTER_MUTATION_PHASE;
}
