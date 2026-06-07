import { REACT_ELEMENT_TYPE } from "../shared/ReactSymbols";
import createFiber from "./ReactFiber";
import { Placement } from "./ReactFiberFlags";
import { HostText } from "./ReactWorkTags";
import { isArray } from "../shared/utils";
function createChildReconciler(shouldTrackSideEffects) {
    function reconcileSingleTextNode(
        returnFiber,
        currentFirstChild,
        textContent,
    ) {
        if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
            // 说明这是一个文本节点，并且可以复用
            deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
            const existing = useFiber(currentFirstChild, textContent);
            existing.return = returnFiber;
            return existing;
        }
        // 不能复用的话，说明这是一个新的文本节点，我们需要创建一个新的 fiber 对象
        deleteRemainingChildren(returnFiber, currentFirstChild);
        const created = createFiber(textContent, returnFiber);
        created.return = returnFiber;
        return created;
    }
    /**
     * 这里涉及到要删除多个节点，删除多个节点的核心思想也就是一个一个去删除
     * @param {*} returnFiber 父 fiber
     * @param {*} currentFirstChild 旧的第一个待删除的子 fiber
     */
    function deleteRemainingChildren(returnFiber, currentFirstChild) {
        let childToDelete = currentFirstChild;
        while (childToDelete) {
            deleteChild(returnFiber, childToDelete);
            childToDelete = childToDelete.sibling;
        }
    }

    /**
     * 将旧的子节点构建到一个 map 结构里面
     * @param {*} currentFirstChild
     */
    function mapRemainingChildren(currentFirstChild) {
        // 首先第一步肯定是创建一个 map
        const existingChildren = new Map();

        let existingChild = currentFirstChild;

        while (existingChild) {
            existingChildren.set(
                existingChild.key || existingChild.index,
                existingChild,
            );
            // 切换到下一个兄弟节点
            existingChild = existingChild.sibling;
        }

        return existingChildren;
    }
    /**
     * 该方法专门用于更新 lastPlacedIndex
     * @param {*} newFiber  上面刚刚创建的新的 fiber 对象
     * @param {*} lastPlacedIndex 上一次的 lastPlacedIndex，也就是上一次插入的最远位置，初始值是 0
     * @param {*} newIndex 当前的下标，初始值也是 0
     * old >> 1 2 3 4 5
     * new >> 5 1 2 3 4
     * 5 之前的索引为 4，那么我就要记录这个值
     * 通过记录这个值，我能够判断出当前的 fiber 究竟应该是修改还是移动
     */
    function placeChild(newFiber, lastPlacedIndex, newIndex) {
        // 更新 fiber 对象上面的 index
        // fiber 对象上面的 index 记录当前 fiber 节点在当前层级下的位置
        newFiber.index = newIndex;
        if (!shouldTrackSideEffects) {
            // 进入此 if，说明当前是初次渲染
            // 那么我们就不需要记录节点位置了
            return lastPlacedIndex;
        }

        // 首先拿到旧的 fiber 节点
        const current = newFiber.alternate;
        if (current) {
            // 首先获取到旧的 fiber 的 index 值
            const oldIndex = current.index;
            if (oldIndex < lastPlacedIndex) {
                // 说明当前的节点是需要移动的
                newFiber.flags |= Placement;
                return lastPlacedIndex;
            } else {
                // 进入此分支，说明 oldIndex 应该作为最新的 lastPlacedIndex
                return oldIndex;
            }
        } else {
            // 进入此分支，说明当前的 fiber 是初次渲染
            newFiber.flags |= Placement;
            return lastPlacedIndex;
        }
    }
    // 多节点的协调算法
    function reconcileChildrenArray(returnFiber, currentFirstChild, children) {
        // 接下来需要做一些准备工作
        // 如果只有一个子节点，那么 children 就是一个 vnode 对象
        // 如果有多个子节点，那么 children 就是一个 vnode 数组
        // 所以我们这一步，就是为了将 children 统一都转为数组，方便我们后续的处理
        const newChildren = isArray(children) ? children : [children];
        // 第二个准备工作：我们需要声明一些变量
        let resultingFirstChild = null; // 保存第一个子节点
        let previousNewFiber = null; // 上一个 fiber 对象
        let oldFiber = returnFiber.alternate?.child; // 上一个 fiber 对象对应的旧 fiber 对象
        let i = 0; // 记录 children 数组的索引（下标）
        let lastPlacedIndex = 0; // 上一次 DOM 节点插入的最远位置
        // 是否需要追踪副作用，该变量是一个布尔值
        // true 代表组件更新
        // false 代表组件初次渲染
        // 该变量有两个作用：
        // 1. 存储下一个旧的 fiber 对象
        // 2. 临时存储当前的旧的 fiber 对象
        let nextOldFiber = null;

        // 接下来就是我们整个 diff 核心的算法思想：
        // 整体来讲分为 5 个大的步骤：
        // 1. 第一轮遍历，从左往右遍历新节点（vnode），在遍历的同时比较新旧节点（旧节点是 fiber 对象）
        // 如果节点可以复用，那么复用，循环继续往右边走
        // 如果节点不能够复用，那么就跳出循环，结束第一轮遍历
        // 2. 检查 newChildren 是否完成了遍历，因为从上面第一步出来，就两种：
        // 要么是提前跳出来的
        // 要么是遍历完了跳出来，如果新节点完成了整个遍历，但是旧节点（fiber对象）还存在，那么就将旧节点删除
        // 3. 初次渲染（这一步我们其实之前已经完成了）
        // 还有一种情况也是属于初次渲染：旧节点遍历完了，新节点还有剩余，那么这些新节点就是属于初次渲染
        // 4. 处理新旧节点都还有剩余的情况
        // （1）将剩下旧节点放入到一个 map 结构里面，方便之后使用
        // （2）遍历剩余的新节点，通过新节点的 key 去 map 里面进行查找，看有没有能够复用的旧节点，如果有，拿来复用，并且会从 map 中删除对应的旧节点
        // 5. 整个新节点遍历完成后，如果 map 中还有剩余的旧节点，这些旧节点也就没有用了，直接删除即可

        // 1. 第一轮遍历，从左往右遍历新节点（vnode），在遍历的同时比较新旧节点（旧节点是 fiber 对象）
        // 第一轮遍历，会尝试复用节点
        // 复用节点意味着你首先得有这些节点，才能说能不能复用的问题
        for (; oldFiber && i < newChildren.length; i++) {
            // 第一次是不会进入到这个循环的，因为一开始压根儿没有 oldFiber

            // 首先我们拿到当前的 vnode
            const newChild = newChildren[i];
            if (newChild === null) continue;

            // 在判断是否能够复用之前，我们先给 nextOldFiber 赋值
            // 这里有一种情况
            // old 一开始是 1 2 3 4 5，进行了一些修改，现在只剩下 5 和 4
            // old >> 5(4) 4(3)
            // new >> 4(3) 1 2 3 5(4)
            // 此时旧的节点的 index 是大于 i，因此我们需要将 nextOldFiber 暂存为 oldFiber
            if (oldFiber.index > i) {
                nextOldFiber = oldFiber;
                oldFiber = null;
            } else {
                nextOldFiber = oldFiber.sibling;
            }

            // 接下来下一步，就是判断是否能够复用
            const same = sameNode(newChild, oldFiber);

            if (!same) {
                // 在退出第一轮遍历之前，我们会做一些额外的工作
                if (oldFiber === null) {
                    // 我们需要将 oldFiber 原本的值还原，方便后面使用
                    oldFiber = nextOldFiber;
                }
                // 如果不能复用，那么就跳出循环，第一轮遍历就结束了
                break;
            }

            // 如果没有进入到上面的 if，那么代码走到这里，就说明可以复用
            const newFiber = createFiber(newChild, returnFiber);
            // 复用旧 fiber 上面的部分信息，特别是 DOM 节点
            Object.assign(newFiber, {
                stateNode: oldFiber.stateNode,
                alternate: oldFiber,
                flags: Update,
            });

            // 更新 lastPlacedIndex 的值
            lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, i);

            // 最后，我们需要将 newFiber 加入到 fiber 链表中去
            if (previousNewFiber === null) {
                // 说明你是第一个子节点
                resultingFirstChild = newFiber;
            } else {
                // 进入此分支，说明当前生成的 fiber 节点并非父 fiber 的第一个节点
                previousNewFiber.sibling = newFiber;
            }

            // 将 previousNewFiber 设置为 newFiber
            previousNewFiber = newFiber;
            // oldFiber 存储下一个旧节点信息
            oldFiber = nextOldFiber;
        }

        // 2. 检查 newChildren 是否完成了遍历
        // 从上面的 for 循环出来，有两种情况
        // 1. oldFiber 为 null，说明是初次渲染
        // 2. i === newChildren.length，说明是遍历完了出来的
        if (i === newChildren.length) {
            // 如果还剩余有旧的 fiber 节点，那么就需要将其删除掉
            deleteRemainingChildren(returnFiber, oldFiber);
            return resultingFirstChild;
        }

        // 3. 接下来就是我们初次渲染的情况
        if (!oldFiber) {
            // 说明是初次渲染
            // 那么我们需要将 newChildren 数组中的每一个元素都生成一个 fiber 对象
            // 然后将这些 fiber 对象串联起来
            for (; i < newChildren.length; i++) {
                const newChildVnode = newChildren[i];
                // 那么我们这一次就不处理，直接跳到下一次
                if (newChildVnode === null || newChildVnode === undefined)
                    continue;

                // 下一步就应该根据 vnode 生成新的 fiber
                const newFiber = createFiber(newChildVnode, returnFiber);

                // 接下来我们需要去更新 lastPlacedIndex 这个值
                lastPlacedIndex = placeChild(
                    newFiber,
                    lastPlacedIndex,
                    i,
                    shouldTrackSideEffects,
                );

                // 接下来非常重要了，接下来我们要将新生成的 fiber 加入到 fiber 链表里面去
                if (previousNewFiber === null) {
                    // 说明你是第一个子节点
                    resultingFirstChild = newFiber;
                } else {
                    // 进入此分支，说明当前生成的 fiber 节点并非父 fiber 的第一个节点
                    previousNewFiber.sibling = newFiber;
                }
                // 将 previousNewFiber 设置为 newFiber
                // 从而将当前 fiber 更新为上一个 fiber
                previousNewFiber = newFiber;
            }
            console.log("resultingFirstChild", resultingFirstChild);
            return resultingFirstChild;
        }

        // 4. 处理新旧节点都还有剩余的情况
        // 首先我们需要创建一个 map 结构，用于存储剩余的旧节点
        const existingChildren = mapRemainingChildren(oldFiber);
        // 去遍历剩余的新节点
        for (; i < newChildren.length; i++) {
            // 先拿到当前的 vnode
            const newChild = newChildren[i];
            if (newChild === null) continue;

            // 根据新节点的 vnode 去生成新的 fiber
            const newFiber = createFiber(newChild, returnFiber);

            // 接下来就需要去哈希表里面寻找是否有可以复用的节点
            const matchedFiber = existingChildren.get(
                newFiber.key || newFiber.index,
            );
            // 这里就有两种情况：
            // 有可能从哈希表里面找到了，也有可能没有找到
            if (matchedFiber) {
                // 说明找到了，那么我们就可以复用
                // 复用旧 fiber 上面的部分信息，特别是 DOM 节点
                Object.assign(newFiber, {
                    stateNode: matchedFiber.stateNode,
                    alternate: matchedFiber,
                    flags: Update,
                });
                // 删除哈希表中的旧 fiber
                existingChildren.delete(newFiber.key || newFiber.index);
            }

            // 更新 lastPlacedIndex 的值
            lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, i);

            // 形成链表
            if (previousNewFiber === null) {
                // 说明你是第一个子节点
                returnFiber.child = newFiber;
            } else {
                // 进入此分支，说明当前生成的 fiber 节点并非父 fiber 的第一个节点
                previousNewFiber.sibling = newFiber;
            }
            // 不要忘了更新 previousNewFiber
            previousNewFiber = newFiber;

            // 5. 整个新节点遍历完成后，如果 map 中还有剩余的旧节点，这些旧节点也就没有用了，直接删除即可
            if (shouldTrackSideEffects) {
                existingChildren.forEach((child) => {
                    deleteChild(returnFiber, child);
                });
            }
        }
        return resultingFirstChild;
    }
    function useFiber(fiber, pendingProps) {
        // 该函数的作用是复用旧的 fiber 对象
        const clone = {
            type: fiber.type,
            key: fiber.key,
            props: pendingProps,
            stateNode: fiber.stateNode,
            child: fiber.child,
            sibling: null,
            return: fiber.return,
            flags: fiber.flags,
            index: fiber.index,
            alternate: fiber,
        };
        return clone;
    }
    function deleteChild(returnFiber, childToDelete) {
        if (!shouldTrackSideEffects) {
            // 如果不需要追踪副作用，说明这是在 mount 阶段，我们不需要删除节点
            return;
        }
        const deletions = returnFiber.deletions;
        if (deletions) {
            // 说明之前已经有需要删除的节点了，我们将当前需要删除的节点添加到 deletions 数组中
            returnFiber.deletions.push(childToDelete);
        } else {
            // 说明之前没有需要删除的节点，我们需要创建一个 deletions 数组来保存需要删除的节点
            returnFiber.deletions = [childToDelete];
        }
    }
    function placeSingleChild(newFiber) {
        // 该函数的作用是为单节点添加 flags 标记
        if (shouldTrackSideEffects && newFiber.alternate === null) {
            newFiber.flags |= SideEffectTag.Insertion;
        }
        return newFiber;
    }
    function reconcileSingleElement(returnFiber, currentFirstChild, element) {
        const key = element.key;
        let child = currentFirstChild;
        // 通过 key 来寻找匹配的子节点
        while (child) {
            if (child.key === key) {
                // 进入此 if，说明找到了 key 相同的子节点
                if (child.type === element.type) {
                    // 进入此 if，说明找到了 type 也相同的子节点
                    // 说明这个子节点可以复用，我们需要将它的 props 更新为新的 props
                    const existing = useFiber(child, element.props);
                    existing.return = returnFiber;
                    return existing;
                } else {
                    // 进入此 else，说明虽然 key 相同，但是 type 不同
                    // 说明这个子节点不能复用，我们需要删除它
                    deleteChild(returnFiber, child);
                }
                child = child.sibling;
            }
        }
        // 代码来到这里，说明没有找到 key 相同的子节点
        // 说明这个子节点是一个新的节点，我们需要创建一个新的 fiber 对象
        const created = createFiber(element, returnFiber);
        return created;
    }
    function reconcileChildFibersImpl(
        returnFiber,
        currentFirstChild,
        children,
    ) {
        const newChild = children;
        if (typeof newChild === "object" && newChild !== null) {
            // 处理单个react子节点
            switch (newChild.$$typeof) {
                case REACT_ELEMENT_TYPE: {
                    const firstChild = placeSingleChild(
                        reconcileSingleElement(
                            returnFiber,
                            currentFirstChild,
                            newChild,
                        ),
                    );
                    return firstChild;
                }
            }
            // 处理多个子节点
            if (isArray(newChild)) {
                // We created a Fragment for this child with the debug info.
                // No need to push again.
                const firstChild = reconcileChildrenArray(
                    returnFiber,
                    currentFirstChild,
                    newChild,
                );
                return firstChild;
            }
            // 处理文本节点
            if (
                (typeof newChild === "string" && newChild !== "") ||
                typeof newChild === "number" ||
                typeof newChild === "bigint"
            ) {
                return placeSingleChild(
                    reconcileSingleTextNode(
                        returnFiber,
                        currentFirstChild,
                        // $FlowFixMe[unsafe-addition] Flow doesn't want us to use `+` operator with string and bigint
                        "" + newChild,
                        lanes,
                    ),
                );
            }
        }
    }
    function reconcileChildFibers(returnFiber, currentFirstChild, children) {
        const firstChildFiber = reconcileChildFibersImpl(
            returnFiber,
            currentFirstChild,
            children,
        );
        return firstChildFiber;
    }
    return reconcileChildFibers;
}
export const reconcileChildFibers = createChildReconciler(true);
export const mountChildFibers = createChildReconciler(false);
