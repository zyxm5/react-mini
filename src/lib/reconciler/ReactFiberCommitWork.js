import { Placement, Update, updateNode } from "../shared/utils";
import {
    HasEffect as HookHasEffect,
    Layout as HookLayout,
    Passive as HookPassive,
    Insertion as HookInsertion,
} from "./ReactHookEffectTags";
import {
    FunctionComponent,
    ClassComponent,
    HostRoot,
    HostComponent,
} from "./ReactWorkTags";
import {
    ChildDeletion,
    PassiveMask,
    NoFlags,
    Snapshot,
    ContentReset,
    LayoutMask,
    Ref,
} from "./ReactFiberFlags";
import {
    commitHookPassiveUnmountEffects,
    commitHookEffectListUnmount,
    commitHookLayoutUnmountEffects,
    commitHookLayoutEffects,
} from "./ReactFiberCommitEffects";
import {
    commitHostUpdate,
    commitHostMount,
    commitHostPlacement,
} from "./ReactFiberCommitHostEffects";
import { detachDeletedInstance } from "../react-dom-binding/ReactFiberConfigDOM";
import {
    enableViewTransition,
    enableEffectEventMutationPhase,
} from "../shared/ReactFeatureFlags";

// 记录遍历过程中fiber
let nextEffect = null;

export function commitPassiveUnmountEffects(finishedWork) {
    // 卸载所有的effect
    // 从updateQueue中遍历next，执行所有effect的destroy
    switch (finishedWork.tag) {
        // 只看函数组件的处理
        case FunctionComponent: {
            // 深度遍历，先收集子节点，后面再收集父节点
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            if (finishedWork.flags & HookPassive) {
                commitHookPassiveUnmountEffects(
                    finishedWork,
                    finishedWork.return,
                    HookPassive | HookHasEffect,
                );
            }
            break;
        }
    }
}
/**
 * 1、处理fiber上挂载的待删除节点，同时要处理待删除节点的子树
 * 2、递归处理子fiber
 * 这个遍历的过程和render阶段的beginwork和completework是一样的
 * @param {*} parentFiber
 */
function recursivelyTraversePassiveUnmountEffects(parentFiber) {
    // 收集要删除的节点
    const deletions = parentFiber.deletions;

    if ((parentFiber.flags & ChildDeletion) !== NoFlags) {
        if (deletions) {
            for (let i = 0; i < deletions.length; i++) {
                const childToDelete = deletions[i];
                nextEffect = childToDelete;
                commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
                    childToDelete,
                    parentFiber,
                );
            }
        }
        detachAlternateSiblings(parentFiber);
    }

    // TODO: Split PassiveMask into separate masks for mount and unmount?
    if (parentFiber.subtreeFlags & PassiveMask) {
        let child = parentFiber.child;
        while (child) {
            // 继续处理子节点
            commitPassiveUnmountOnFiber(child);
            child = child.sibling;
        }
    }
}
function commitPassiveUnmountOnFiber(finishedWork) {
    switch (finishedWork.tag) {
        case FunctionComponent: {
            recursivelyTraversePassiveUnmountEffects(finishedWork);
            if (finishedWork.flags & Passive) {
                commitHookPassiveUnmountEffects(
                    finishedWork,
                    finishedWork.return,
                    HookPassive | HookHasEffect,
                );
            }
            break;
        }
    }
}
/**
 * 清理旧FiberTree的待删除节点的兄弟关系
 * @param {*} parentFiber
 */
function detachAlternateSiblings(parentFiber) {
    // A fiber was deleted from this parent fiber, but it's still part of the
    // previous (alternate) parent fiber's list of children. Because children
    // are a linked list, an earlier sibling that's still alive will be
    // connected to the deleted fiber via its `alternate`:
    //
    //   live fiber --alternate--> previous live fiber --sibling--> deleted
    //   fiber
    //
    // We can't disconnect `alternate` on nodes that haven't been deleted yet,
    // but we can disconnect the `sibling` and `child` pointers.

    const previousFiber = parentFiber.alternate;
    if (previousFiber) {
        let detachedChild = previousFiber.child;
        if (detachedChild) {
            previousFiber.child = null;
            do {
                // $FlowFixMe[incompatible-use] found when upgrading Flow
                const detachedSibling = detachedChild.sibling;
                // $FlowFixMe[incompatible-use] found when upgrading Flow
                detachedChild.sibling = null;
                detachedChild = detachedSibling;
            } while (detachedChild);
        }
    }
}
/**
 * 深度优先遍历节点，遍历到子节点后执行
 * @param {*} deletedSubtreeRoot
 * @param {*} nearestMountedAncestor
 */
function commitPassiveUnmountEffectsInsideOfDeletedTree_begin(
    deletedSubtreeRoot,
    nearestMountedAncestor,
) {
    while (nextEffect) {
        const fiber = nextEffect;
        // 执行effect的destroy
        commitHookPassiveUnmountEffects(
            fiber,
            nearestMountedAncestor,
            HookPassive,
        );

        const child = fiber.child;
        // TODO: Only traverse subtree if it has a PassiveStatic flag.
        if (child) {
            child.return = fiber;
            nextEffect = child;
        } else {
            // 走到这说明已经到达叶子节点了
            commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
                deletedSubtreeRoot,
            );
        }
    }
}
/**
 * 1、清理fiber节点上的信息，按照子-兄-父的顺序
 * 2、同时更新全局nextEffect，函数执行完后，nextEffect = null
 * @param {*} deletedSubtreeRoot
 * @returns
 */
function commitPassiveUnmountEffectsInsideOfDeletedTree_complete(
    deletedSubtreeRoot,
) {
    while (nextEffect) {
        const fiber = nextEffect;
        const sibling = fiber.sibling;
        const returnFiber = fiber.return;

        // Recursively traverse the entire deleted tree and clean up fiber fields.
        // This is more aggressive than ideal, and the long term goal is to only
        // have to detach the deleted tree at the root.
        detachFiberAfterEffects(fiber);
        if (fiber === deletedSubtreeRoot) {
            nextEffect = null;
            return;
        }

        if (sibling) {
            // 处理兄弟节点
            sibling.return = returnFiber;
            nextEffect = sibling;
            return;
        }
        // 兄弟节点处理完后，向上遍历，处理父节点
        nextEffect = returnFiber;
    }
}
/**
 * 清理fiber上绑定的属性
 * @param {*} fiber
 */
function detachFiberAfterEffects(fiber) {
    const alternate = fiber.alternate;
    if (alternate) {
        fiber.alternate = null;
        // 清理双缓存的绑定
        detachFiberAfterEffects(alternate);
    }

    // 清理fiber
    fiber.child = null;
    fiber.deletions = null;
    fiber.sibling = null;

    // The `stateNode` is cyclical because on host nodes it points to the host
    // tree, which has its own pointers to children, parents, and siblings.
    // The other host nodes also point back to fibers, so we should detach that
    // one, too.
    if (fiber.tag === HostComponent) {
        const hostInstance = fiber.stateNode;
        if (hostInstance) {
            // 清理原生组件上绑定的一些私有属性
            detachDeletedInstance(hostInstance);
        }
    }
    fiber.stateNode = null;
    fiber.return = null;
    fiber.dependencies = null;
    fiber.memoizedProps = null;
    fiber.memoizedState = null;
    fiber.pendingProps = null;
    fiber.stateNode = null;
    fiber.updateQueue = null;
}

export function commitPassiveMountEffects(root, finishedWork) {
    const flags = finishedWork.flags;
    switch (finishedWork.tag) {
        case FunctionComponent: {
            recursivelyTraversePassiveMountEffects(root, finishedWork);
            if (flags & Passive) {
                commitHookEffectListMount(
                    finishedWork,
                    HookPassive | HookHasEffect,
                );
            }
            break;
        }
    }
}
function getParentDOM(wip) {
    let temp = wip;
    while (temp) {
        if (temp.stateNode) return temp.stateNode;
        // 如果没有进入上面的 if，说明当前的 fiber 节点并没有对应的 DOM 对象
        // 那么就需要继续向上寻找
        // 那么问题来了，为什么该 fiber 上面没有对应的 DOM 对象呢？
        // 因为该 fiber 节点可能是一个函数组件或者类组件、Franment
        temp = temp.return;
    }
}

/**
 * 取出该 fiber 对象中的 updateQueue 里面的副作用函数，依次执行
 * @param {*} wip
 */
function invokeHooks(wip) {
    const { updateQueue } = wip;

    for (let i = 0; i < updateQueue.length; i++) {
        // 取出每一个副作用对象
        const effect = updateQueue[i];

        // 检查是否有清除方法，有的话就先执行清除方法
        if (effect.destroy) {
            effect.destroy();
        }

        // 接下来就应该执行副作用函数了
        // 注意这里并非直接执行，而是创建一个任务，放入到任务队列中
        scheduleCallback(() => {
            effect.destroy = effect.create();
        });
    }
}
/**
 * 执行effectHook
 * @param {*} flags
 * @param {*} finishedWork
 */
export function commitHookEffectListMount(flags, finishedWork) {
    try {
        const updateQueue = finishedWork.updateQueue;
        // updateQueue是一个环状链表
        const lastEffect = updateQueue ? updateQueue.lastEffect : null;
        if (lastEffect) {
            const firstEffect = lastEffect.next;
            let effect = firstEffect;
            do {
                if ((effect.tag & flags) === flags) {
                    // Mount
                    let destroy;
                    const create = effect.create;
                    const inst = effect.inst;
                    // 返回值是destory
                    destroy = create();
                    inst.destroy = destroy;
                }
                // 依次执行
                effect = effect.next;
            } while (effect !== firstEffect);
        }
    } catch (error) {
        throw error;
    }
}

export function commitBeforeMutationEffects(root, firstChild) {
    nextEffect = firstChild;
    commitBeforeMutationEffects_begin();
}
function commitBeforeMutationEffects_begin() {
    while (nextEffect) {
        const fiber = nextEffect;
        if (
            enableViewTransition &&
            fiber.alternate === null &&
            (fiber.flags & Placement) !== NoFlags
        ) {
            // mount
            commitBeforeMutationEffects_complete();
            continue;
        }
        const child = fiber.child;
        if (child) {
            // update
            child.return = fiber;
            nextEffect = child;
        } else {
            commitBeforeMutationEffects_complete(isViewTransitionEligible);
        }
    }
}
function commitBeforeMutationEffects_complete() {
    while (nextEffect) {
        const fiber = nextEffect;
        commitBeforeMutationEffectsOnFiber(fiber);

        const sibling = fiber.sibling;
        if (sibling) {
            sibling.return = fiber.return;
            nextEffect = sibling;
            return;
        }

        nextEffect = fiber.return;
    }
}

function commitBeforeMutationEffectsOnFiber(finishedWork) {
    const current = finishedWork.alternate;
    const flags = finishedWork.flags;
    switch (finishedWork.tag) {
        // 函数组件:更新事件绑定
        case FunctionComponent: {
            if (
                !enableEffectEventMutationPhase &&
                (flags & Update) !== NoFlags
            ) {
                const updateQueue = finishedWork.updateQueue;
                const eventPayloads = updateQueue ? updateQueue.events : null;
                if (eventPayloads) {
                    for (let ii = 0; ii < eventPayloads.length; ii++) {
                        const { ref, nextImpl } = eventPayloads[ii];
                        ref.impl = nextImpl;
                    }
                }
            }
            break;
        }
        // 类组件：触发getSnapshotBeforeUpdate
        case ClassComponent: {
            // if ((flags & Snapshot) !== NoFlags) {
            //     if (current) {
            //         commitClassSnapshot(finishedWork, current);
            //     }
            // }
            break;
        }
        // root节点，清空挂载内容
        case HostRoot: {
            if ((flags & Snapshot) !== NoFlags) {
                const root = finishedWork.stateNode;
                finishedWork.stateNode.textContent = "";
            }
            break;
        }
    }
}

export function commitMutationEffects(root, finishedWork) {
    commitMutationEffectsOnFiber(root, finishedWork);
}
/**
 * 处理reconciler过程中产生的effect，主要指插入、移动和更新
 * @param {*} finishedWork
 */
function commitReconciliationEffects(finishedWork) {
    // Placement effects (insertions, reorders) can be scheduled on any fiber
    // type. They needs to happen after the children effects have fired, but
    // before the effects on this fiber have fired.
    const flags = finishedWork.flags;
    if (flags & Placement) {
        commitHostPlacement(finishedWork);
        // 清空Placement标志
        finishedWork.flags &= ~Placement;
    }
}
function commitMutationEffectsOnFiber(root, finishedWork) {
    const current = finishedWork.alternate;
    const flags = finishedWork.flags;
    switch (finishedWork.tag) {
        case FunctionComponent: {
            // 递 归 执行
            recursivelyTraverseMutationEffects(root, finishedWork);
            // 插入、移动、更新元素
            commitReconciliationEffects(finishedWork);

            if (flags & Update) {
                // 卸载insertionEffect
                commitHookEffectListUnmount(
                    HookInsertion | HookHasEffect,
                    finishedWork,
                    finishedWork.return,
                );
                // 挂载insertionEffect
                // TODO: Use a commitHookInsertionUnmountEffects wrapper to record timings.
                commitHookEffectListMount(
                    HookInsertion | HookHasEffect,
                    finishedWork,
                );
                // 卸载layoutEffect
                commitHookLayoutUnmountEffects(
                    finishedWork,
                    finishedWork.return,
                    HookLayout | HookHasEffect,
                );
            }
            break;
        }
        case ClassComponent: {
            recursivelyTraverseMutationEffects(root, finishedWork);
            commitReconciliationEffects(finishedWork);

            if (flags & Ref) {
                // 卸载ref
                // safelyDetachRef(current, current.return);
            }

            break;
        }
        case HostComponent: {
            recursivelyTraverseMutationEffects(root, finishedWork);
            commitReconciliationEffects(finishedWork);
            if (flags & Ref) {
                // 卸载ref
                // safelyDetachRef(current, current.return);
            }
            if (finishedWork.flags & ContentReset) {
                // 更新文本
                // commitHostResetTextContent(finishedWork);
            }
            if (flags & Update) {
                // 更新属性
                const instance = finishedWork.stateNode;
                if (instance != null) {
                    // Commit the work prepared earlier.
                    // For hydration we reuse the update path but we treat the oldProps
                    // as the newProps. The updatePayload will contain the real change in
                    // this case.
                    const newProps = finishedWork.memoizedProps;
                    const oldProps = current ? current.memoizedProps : newProps;
                    commitHostUpdate(finishedWork, newProps, oldProps);
                }
            }
            break;
        }
        // Fallthrough
        default: {
            recursivelyTraverseMutationEffects(root, finishedWork);
            commitReconciliationEffects(finishedWork);

            break;
        }
    }
}
function recursivelyTraverseMutationEffects(root, parentFiber) {
    // Deletions effects can be scheduled on any fiber type. They need to happen
    // before the children effects have fired.
    const deletions = parentFiber.deletions;
    if (deletions) {
        for (let i = 0; i < deletions.length; i++) {
            const childToDelete = deletions[i];
            commitDeletionEffects(root, parentFiber, childToDelete);
        }
    }

    let child = parentFiber.child;
    while (child) {
        // 递归执行
        commitMutationEffectsOnFiber(child, root);
        child = child.sibling;
    }
}
let hostParent = null;
let hostParentIsContainer = false;
/**
 * 删除dom
 * @param {*} root
 * @param {*} returnFiber
 * @param {*} deletedFiber
 */
function commitDeletionEffects(root, returnFiber, deletedFiber) {
    let parent = returnFiber;
    // 找父dom
    findParent: while (parent) {
        switch (parent.tag) {
            case HostComponent: {
                hostParent = parent.stateNode;
                hostParentIsContainer = false;
                break findParent;
            }
        }
        parent = parent.return;
    }

    commitDeletionEffectsOnFiber(root, returnFiber, deletedFiber);
    hostParent = null;
    hostParentIsContainer = false;
    detachFiberMutation(deletedFiber);
}
/**
 * 切断fiber之间的链接
 * @param {*} fiber
 */
function detachFiberMutation(fiber) {
    const alternate = fiber.alternate;
    if (alternate) {
        alternate.return = null;
    }
    fiber.return = null;
}
function commitDeletionEffectsOnFiber(
    finishedRoot,
    nearestMountedAncestor,
    deletedFiber,
) {
    // 触发unMount事件
    // onCommitUnmount(deletedFiber);
    switch (deletedFiber.tag) {
        case FunctionComponent: {
            // 先执行insertionEffect的卸载，在执行layoutEffect的卸载
            commitHookEffectListUnmount(HookInsertion, deletedFiber);
            commitHookLayoutUnmountEffects(deletedFiber, HookLayout);
            recursivelyTraverseDeletionEffects(
                finishedRoot,
                nearestMountedAncestor,
                deletedFiber,
            );
            break;
        }
    }
}
function recursivelyTraverseDeletionEffects(
    finishedRoot,
    nearestMountedAncestor,
    parent,
) {
    // TODO: Use a static flag to skip trees that don't have unmount effects
    let child = parent.child;
    // 深度优先，找child
    while (child) {
        commitDeletionEffectsOnFiber(
            finishedRoot,
            nearestMountedAncestor,
            child,
        );
        // 找不到找兄弟
        child = child.sibling;
    }
}

export function commitLayoutEffects(finishedRoot, current, finishedWork) {
    commitLayoutEffectOnFiber(finishedRoot, current, finishedWork);
}
function commitLayoutEffectOnFiber(finishedRoot, current, finishedWork) {
    const flags = finishedWork.flags;
    switch (finishedWork.tag) {
        case FunctionComponent: {
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & Update) {
                commitHookLayoutEffects(
                    finishedWork,
                    HookLayout | HookHasEffect,
                );
            }
            break;
        }
        case ClassComponent: {
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);
            if (flags & Update) {
                // 触发componentDidMount/componentDidUpdate
                // commitClassLayoutLifecycles(finishedWork, current);
            }

            if (flags & Ref) {
                // 挂ref
                // safelyAttachRef(finishedWork, finishedWork.return);
            }
            break;
        }
        case HostComponent: {
            recursivelyTraverseLayoutEffects(finishedRoot, finishedWork);

            // Renderers may schedule work to be done after host components are mounted
            // (eg DOM renderer may schedule auto-focus for inputs and form controls).
            // These effects should only be committed when components are first mounted,
            // aka when there is no current/alternate.
            if (current === null) {
                if (flags & Update) {
                    commitHostMount(finishedWork);
                }
            }

            if (flags & Ref) {
                // 创建reg
                // safelyAttachRef(finishedWork, finishedWork.return);
            }
            break;
        }
    }
}
function recursivelyTraverseLayoutEffects(root, parentFiber) {
    if (parentFiber.subtreeFlags & LayoutMask) {
        let child = parentFiber.child;
        while (child) {
            const current = child.alternate;
            commitLayoutEffectOnFiber(root, current, child);
            child = child.sibling;
        }
    }
}
