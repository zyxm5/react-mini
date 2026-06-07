// 在 beginWork 中，主要就是根据 fiber 不同的 tag 值，调用不同的方法来处理
// 主要流程如下
// 1. 深度优先遍历
// 2. 根据 fiber 的 tag 值，调用不同的方法来处理
// 3. 生成子节点的 fiber 对象（mount创建fiber对象，update使用diff算法来比较新旧fiber对象，生成flags，placement、deletions），
// 4. 生成ref
// 4. 将子节点的 fiber 对象挂载到父节点的 child 属性上
// 5. 将子节点的 fiber 对象通过 sibling 属性串联起来

import { FunctionComponent, HostComponent, HostText } from "./ReactWorkTags";
import { reconcileChildFibers, mountChildFibers } from "./ReactChildFiber";
import { renderWithHooks } from "./ReactFiberHooks";

/**
 * 生成子节点的 fiber 对象（mount创建fiber对象，update使用diff算法来比较新旧fiber对象，生成flags，placement、deletions），
 * 真正的dom操作在commit阶段进行
 * @param {*} current
 * @param {*} wip
 */
function beginWork(current, wip) {
    const tag = wip.tag;

    switch (tag) {
        // 处理原生标签
        case HostComponent: {
            updateHostComponent(current, wip);
            break;
        }
        // 处理函数组件
        case FunctionComponent: {
            const Component = workInProgress.type;
            updateFunctionComponent(current, wip, Component);
            break;
        }
        // 处理普通文本
        case HostText: {
            // 不做任何事
            break;
        }
    }
}

function updateHostComponent(current, workInProgress) {
    reconcileChildren(current, workInProgress, workInProgress.props.children);
}
function updateFunctionComponent(current, workInProgress, Component) {
    const nextChildren = renderWithHooks(current, workInProgress, Component);
    reconcileChildren(current, workInProgress, nextChildren);
    return workInProgress.child;
}

function reconcileChildren(current, workInProgress, nextChildren) {
    if (current === null) {
        // 如果 current 为空，说明这是一个 mount 阶段，我们需要创建新的 fiber 对象
        workInProgress.child = mountChildFibers(
            workInProgress,
            null,
            nextChildren,
        );
    } else {
        // 如果 current 不为空，说明这是一个 update 阶段，我们需要比较新旧 fiber 对象，生成 flags
        workInProgress.child = reconcileChildFibers(
            workInProgress,
            current.child,
            nextChildren,
        );
    }
}

export default beginWork;
