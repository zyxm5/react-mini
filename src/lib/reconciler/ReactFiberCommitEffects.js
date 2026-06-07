/**
 * 依次执行fiber上绑定hook的destroy
 * @param {*} finishedWork
 * @param {*} flags
 */
export function commitHookPassiveUnmountEffects(finishedWork, flags) {
    // updateQueue的数据结构
    //   {
    //     lastEffect: null,
    //     events: null,
    //     stores: null,
    //     memoCache: null,
    //   };
    const updateQueue = finishedWork.updateQueue;
    // 拿到最后一个hook
    const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
    if (lastEffect !== null) {
        // 根据last拿到next
        const firstEffect = lastEffect.next;
        let effect = firstEffect;
        // effect结构如下：
        // {
        //   tag,
        //   create,
        //   deps,
        //   inst,
        //   // Circular
        //   next: null,
        // }
        do {
            // 开始遍历收集
            if ((effect.tag & flags) === flags) {
                // Unmount
                const inst = effect.inst;
                // 拿到destory
                const destroy = inst.destroy;
                if (destroy !== undefined) {
                    inst.destroy = undefined;
                    // 执行destory
                    destroy();
                }
            }
            effect = effect.next;
        } while (effect !== firstEffect);
    }
}

export function commitHookEffectListMount(finishedWork, flags) {
    // updateQueue的数据结构
    //   {
    //     lastEffect: null,
    //     events: null,
    //     stores: null,
    //     memoCache: null,
    //   };
    const updateQueue = finishedWork.updateQueue;
    // 拿到最后一个hook
    const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
    if (lastEffect !== null) {
        // 根据last拿到next
        const firstEffect = lastEffect.next;
        let effect = firstEffect;
        // effect结构如下：
        // {
        //   tag,
        //   create,
        //   deps,
        //   inst,
        //   // Circular
        //   next: null,
        // }
        do {
            // 开始遍历收集
            if ((effect.tag & flags) === flags) {
                // Mount
                let destroy;
                const create = effect.create;
                const inst = effect.inst;
                // 将create执行的返回付给destroy
                destroy = create();
                inst.destroy = destroy;
            }
            effect = effect.next;
        } while (effect !== firstEffect);
    }
}

/**
 * 卸载effect，依次执行destroy
 * @param {*} flags
 * @param {*} finishedWork
 */
export function commitHookEffectListUnmount(flags, finishedWork) {
    const updateQueue = finishedWork.updateQueue;
    const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
    if (lastEffect !== null) {
        const firstEffect = lastEffect.next;
        let effect = firstEffect;
        do {
            if ((effect.tag & flags) === flags) {
                // Unmount
                const inst = effect.inst;
                const destroy = inst.destroy;
                if (destroy !== undefined) {
                    inst.destroy = undefined;
                    destroy();
                }
            }
            effect = effect.next;
        } while (effect !== firstEffect);
    }
}
/**
 * 卸载layoutEffect
 * @param {*} finishedWork
 * @param {*} hookFlags
 */
export function commitHookLayoutUnmountEffects(finishedWork, hookFlags) {
    commitHookEffectListUnmount(hookFlags, finishedWork);
}
export function commitHookLayoutEffects(finishedWork, hookFlags) {
    commitHookEffectListMount(hookFlags, finishedWork);
}
