import {
    FunctionComponent,
    HostComponent,
    HostRoot,
    HostText,
} from "./ReactWorkTags";
import { NoFlags, Update } from "./ReactFiberFlags";
import {
    createInstance,
    appendInitialChild,
    finalizeInitialChildren,
} from "../react-dom-binding/ReactFiberConfigDOM";

function markUpdate(workInProgress) {
    workInProgress.flags |= Update;
}
/**
 * flag冒泡
 * @param {*} completedWork
 * @returns
 */
function bubbleProperties(completedWork) {
    // Boilout优化点
    const didBailout =
        completedWork.alternate &&
        completedWork.alternate?.child === completedWork.child;
    if (didBailout) {
        // 说明当前的 fiber 对象没有发生变化，子节点也没有发生变化
        // 那么我们就不需要冒泡了，直接返回就行了
        return;
    }
    let subtreeFlags = NoFlags;
    let child = completedWork.child;
    // 将子节点的 flags 和 subtreeFlags 冒泡到父节点上
    while (child) {
        subtreeFlags |= child.subtreeFlags;
        subtreeFlags |= child.flags;

        child = child.sibling;
    }

    completedWork.subtreeFlags |= subtreeFlags;
}
function updateHostComponent(current, workInProgress, newProps) {
    // 这里我们需要比较新旧 props
    const oldProps = current.memoizedProps;
    if (oldProps === newProps) {
        // In mutation mode, this is sufficient for a bailout because
        // we won't touch this node even if children changed.
        return;
    }
    // 如果需要更新就标记更新，最终在commit阶段更新
    workInProgress.flags |= Update;
}
function appendAllChildren(parent, workInProgress) {
    let node = workInProgress.child;
    while (node) {
        if (node.tag === HostComponent || node.tag === HostText) {
            // 添加原始节点或者文本节点
            appendInitialChild(parent, node.stateNode);
        } else if (node.child) {
            // 递归执行
            node.child.return = node;
            node = node.child;
            continue;
        }
        if (node === workInProgress) {
            return;
        }
        // $FlowFixMe[incompatible-use] found when upgrading Flow
        while (node.sibling === null) {
            // 子节点没有了，就找兄弟节点
            // $FlowFixMe[incompatible-use] found when upgrading Flow
            if (node.return === null || node.return === workInProgress) {
                return;
            }
            node = node.return;
        }
        // $FlowFixMe[incompatible-use] found when upgrading Flow
        node.sibling.return = node.return;
        node = node.sibling;
    }
}

function completeWork(current, workInProgress) {
    console.log("completeWork", workInProgress);
    // 这里主要做的是根据fiber对象，创建真实的DOM节点对象，并且将子节点的DOM节点插入到父节点上
    // 更新dom属性
    // 处理属性冒泡
    switch (workInProgress?.tag) {
        case HostComponent: {
            // 原生标签
            // 处理mount和update两种情况
            // mount阶段，current为null，我们需要创建DOM节点对象，并且将子节点的DOM节点插入到父节点上
            // update阶段，current不为null，我们需要更新DOM节点对象的属性
            if (current !== null && workInProgress.stateNode !== null) {
                // update阶段
                // 这里我们需要更新DOM节点对象的属性
                // updateHostComponent方法会比较新旧props，找出需要更新的属性，然后进行更新
                updateHostComponent(
                    current,
                    workInProgress,
                    workInProgress.props,
                );
            } else {
                // mount阶段
                // 这里我们需要创建DOM节点对象，并且将子节点的DOM节点插入到父节点上
                const instance = createInstance(
                    workInProgress.type,
                    workInProgress.props,
                    null,
                    workInProgress,
                );
                // 添加子节点
                appendAllChildren(instance, workInProgress);
                // 将最终的dom挂在wip的stateNode上
                workInProgress.stateNode = instance;
                // 更新属性
                if (
                    finalizeInitialChildren(
                        instance,
                        workInProgress.type,
                        workInProgress.props,
                    )
                ) {
                    // 标记更新
                    markUpdate(workInProgress);
                }
            }

            bubbleProperties(workInProgress);
            return null;
            break;
        }
        case FunctionComponent: {
            // 函数组件，只做属性冒泡
            bubbleProperties(workInProgress);
            return null;
        }
        case HostText: {
            workInProgress.stateNode = document.createTextNode(
                workInProgress.props.children,
            );
            // 文本只做标记
            workInProgress.flags |= Update;
        }
        case HostRoot: {
            bubbleProperties(workInProgress);
        }
    }
}

export default completeWork;
