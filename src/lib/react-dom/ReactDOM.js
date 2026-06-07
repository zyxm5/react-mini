import createFiber from "../reconciler/ReactFiber";
import { scheduleUpdateOnFiber } from "../reconciler/ReactFiberWorkLoop";
import { HostRoot } from "../reconciler/ReactWorkTags";
function ReactDOMRoot(internalRoot) {
    this._internalRoot = internalRoot;
}
ReactDOMRoot.prototype.render = function (children) {
    const root = this._internalRoot;
    const fiber = createFiber(children, root);
    root.child = fiber;
    console.log("fiber", fiber);
    // 开始创建后续fiber对象
    scheduleUpdateOnFiber(root);
};

export function createRoot(container) {
    const root = {
        containerInfo: container,
        type: container.nodeName.toLowerCase(),
        stateNode: container,
        tag: HostRoot,
    };
    return new ReactDOMRoot(root);
}
