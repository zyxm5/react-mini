import { HostComponent, HostRoot, HostText } from "./ReactWorkTags";
import {
    insertBefore,
    appendChild,
    commitUpdate,
    commitMount,
} from "../react-dom-binding/ReactFiberConfigDOM";
import { Placement } from "./ReactFiberFlags";
export function commitFragmentInstanceDeletionEffects(fiber) {
    let parent = fiber.return;
    while (parent !== null) {
        if (isHostParent(parent)) {
            return;
        }

        parent = parent.return;
    }
}

function isHostParent(fiber) {
    return fiber.tag === HostComponent || fiber.tag === HostRoot;
}
/**
 * 寻找节点的兄弟节点
 * @param {*} fiber
 * @returns
 */
function getHostSibling(fiber) {
    // We're going to search forward into the tree until we find a sibling host
    // node. Unfortunately, if multiple insertions are done in a row we have to
    // search past them. This leads to exponential search for the next sibling.
    // TODO: Find a more efficient way to do this.
    let node = fiber;
    siblings: while (true) {
        // If we didn't find anything, let's try the next sibling.
        while (node.sibling === null) {
            if (node.return === null || isHostParent(node.return)) {
                // If we pop out of the root or hit the parent the fiber we are the
                // last sibling.
                return null;
            }
            // $FlowFixMe[incompatible-type] found when upgrading Flow
            node = node.return;
        }
        node.sibling.return = node.return;
        node = node.sibling;
        while (
            node.tag !== HostComponent &&
            node.tag !== HostText &&
            node.tag !== DehydratedFragment
        ) {
            // If this is a host singleton we go deeper if it's not a special
            // singleton scope. If it is a singleton scope we skip over it because
            // you only insert against this scope when you are already inside of it
            if (
                supportsSingletons &&
                node.tag === HostSingleton &&
                isSingletonScope(node.type)
            ) {
                continue siblings;
            }

            // If it is not host node and, we might have a host node inside it.
            // Try to search down until we find one.
            if (node.flags & Placement) {
                // If we don't have a child, try the siblings instead.
                continue siblings;
            }
            // If we don't have a child, try the siblings instead.
            // We also skip portals because they are not part of this host tree.
            if (node.child === null || node.tag === HostPortal) {
                continue siblings;
            } else {
                node.child.return = node;
                node = node.child;
            }
        }
        // Check if this host node is stable or about to be placed.
        if (!(node.flags & Placement)) {
            // Found it!
            return node.stateNode;
        }
    }
}
export function commitHostPlacement(finishedWork) {
    // Recursively insert all host nodes into the parent.
    let hostParentFiber;
    let parentFragmentInstances = null;
    let parentFiber = finishedWork.return;
    // 向上查找父节点
    while (parentFiber !== null) {
        if (isHostParent(parentFiber)) {
            hostParentFiber = parentFiber;
            break;
        }
        parentFiber = parentFiber.return;
    }

    switch (hostParentFiber.tag) {
        case HostComponent: {
            const parent = hostParentFiber.stateNode;
            const before = getHostSibling(finishedWork);
            // We only have the top Fiber that was inserted but we need to recurse down its
            // children to find all the terminal nodes.
            insertOrAppendPlacementNode(finishedWork, before, parent);
            break;
        }
        case HostRoot: {
            const parent = hostParentFiber.containerInfo;
            const before = getHostSibling(finishedWork);
            insertOrAppendPlacementNodeIntoContainer(
                finishedWork,
                before,
                parent,
            );
            break;
        }
        default:
            throw new Error(
                "Invalid host parent fiber. This error is likely caused by a bug " +
                    "in React. Please file an issue.",
            );
    }
}

function insertOrAppendPlacementNode(node, before, parent) {
    const { tag } = node;
    const isHost = tag === HostComponent || tag === HostText;
    if (isHost) {
        const stateNode = node.stateNode;
        if (before) {
            insertBefore(parent, stateNode, before);
        } else {
            appendChild(parent, stateNode);
        }
        return;
    }
    // 递归执行
    const child = node.child;
    if (child !== null) {
        insertOrAppendPlacementNode(
            child,
            before,
            parent,
            parentFragmentInstances,
        );
        let sibling = child.sibling;
        while (sibling !== null) {
            insertOrAppendPlacementNode(
                sibling,
                before,
                parent,
                parentFragmentInstances,
            );
            sibling = sibling.sibling;
        }
    }
}
function insertOrAppendPlacementNodeIntoContainer(node, before, parent) {
    const { tag } = node;
    const isHost = tag === HostComponent || tag === HostText;
    if (isHost) {
        const stateNode = node.stateNode;
        if (before) {
            insertBefore(parent, stateNode, before);
        } else {
            appendChild(parent, stateNode);
        }
        return;
    }
    const child = node.child;
    // 递归执行
    if (child !== null) {
        insertOrAppendPlacementNodeIntoContainer(child, before, parent);
        let sibling = child.sibling;
        while (sibling !== null) {
            insertOrAppendPlacementNodeIntoContainer(sibling, before, parent);
            sibling = sibling.sibling;
        }
    }
}

export function commitHostUpdate(finishedWork, newProps, oldProps) {
    commitUpdate(
        finishedWork.stateNode,
        finishedWork.type,
        oldProps,
        newProps,
        finishedWork,
    );
}

export function commitHostMount(finishedWork) {
    const type = finishedWork.type;
    const props = finishedWork.memoizedProps;
    const instance = finishedWork.stateNode;
    commitMount(instance, type, props, finishedWork);
}
