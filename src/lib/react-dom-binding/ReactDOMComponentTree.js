import { enableInternalInstanceMap } from "../shared/ReactFeatureFlags";

const PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
const internalInstanceMap = new PossiblyWeakMap();
const internalPropsMap = new PossiblyWeakMap();
const randomKey = Math.random().toString(36).slice(2);
const internalInstanceKey = "__reactFiber$" + randomKey;
const internalPropsKey = "__reactProps$" + randomKey;
const internalContainerInstanceKey = "__reactContainer$" + randomKey;
const internalEventHandlersKey = "__reactEvents$" + randomKey;
const internalEventHandlerListenersKey = "__reactListeners$" + randomKey;
const internalEventHandlesSetKey = "__reactHandles$" + randomKey;
const internalRootNodeResourcesKey = "__reactResources$" + randomKey;
const internalHoistableMarker = "__reactMarker$" + randomKey;
const internalScrollTimer = "__reactScroll$" + randomKey;
const internalLoadPendingKey = "__reactLoad$" + randomKey;

export function precacheFiberNode(hostInst, node) {
    if (enableInternalInstanceMap) {
        internalInstanceMap.set(node, hostInst);
        return;
    }
    node[internalInstanceKey] = hostInst;
}

export function updateFiberProps(node, props) {
    if (enableInternalInstanceMap) {
        internalPropsMap.set(node, props);
        return;
    }
    node[internalPropsKey] = props;
}

export function detachDeletedInstance(node) {
    if (enableInternalInstanceMap) {
        internalInstanceMap.delete(node);
        internalPropsMap.delete(node);
        delete node[internalEventHandlersKey];
        delete node[internalEventHandlerListenersKey];
        delete node[internalEventHandlesSetKey];
        delete node[internalRootNodeResourcesKey];
        return;
    }
    // TODO: This function is only called on host components. I don't think all of
    // these fields are relevant.
    delete node[internalInstanceKey];
    delete node[internalPropsKey];
    delete node[internalEventHandlersKey];
    delete node[internalEventHandlerListenersKey];
    delete node[internalEventHandlesSetKey];
}
