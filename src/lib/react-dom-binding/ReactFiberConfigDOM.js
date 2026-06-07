import { DOCUMENT_NODE } from "./HTMLNodeType.js";
import {
    precacheFiberNode,
    updateFiberProps,
} from "./ReactDOMComponentTree.js";
import { setInitialProperties, updateProperties } from "./ReactDOMComponent.js";
import { enableMoveBefore } from "../shared/ReactFeatureFlags.js";

/**
 * 初始后dom的属性
 * @param {*} domElement
 * @param {*} type
 * @param {*} props
 * @returns
 */
export function finalizeInitialChildren(domElement, type, props) {
    setInitialProperties(domElement, type, props);
    switch (type) {
        case "button":
        case "input":
        case "select":
        case "textarea":
            return !!props.autoFocus;
        case "img":
            return true;
        default:
            return false;
    }
}

export function appendInitialChild(parentInstance, child) {
    parentInstance.appendChild(child);
}
export function createInstance(type, props, root, internalInstanceHandle) {
    const domElement = document.createElement(type);
    // 缓存fiberNode
    precacheFiberNode(internalInstanceHandle, domElement);
    updateFiberProps(domElement, props);
    return domElement;
}
// 判断当前环境是否支持moveBefore，chrome133已支持
const supportsMoveBefore =
    // $FlowFixMe[prop-missing]: We're doing the feature detection here.
    enableMoveBefore &&
    typeof window !== "undefined" &&
    typeof window.Element.prototype.moveBefore === "function";
export function insertBefore(parentInstance, child, beforeChild) {
    if (supportsMoveBefore && child.parentNode !== null) {
        // $FlowFixMe[prop-missing]: We've checked this with supportsMoveBefore.
        parentInstance.moveBefore(child, beforeChild);
    } else {
        parentInstance.insertBefore(child, beforeChild);
    }
}
export function appendChild(parentInstance, child) {
    if (supportsMoveBefore && child.parentNode !== null) {
        // $FlowFixMe[prop-missing]: We've checked this with supportsMoveBefore.
        parentInstance.moveBefore(child, null);
    } else {
        parentInstance.appendChild(child);
    }
}
export function commitUpdate(domElement, type, oldProps, newProps) {
    // Diff and update the properties.
    updateProperties(domElement, type, oldProps, newProps);

    // Update the props handle so that we know which props are the ones with
    // with current event handlers.
    updateFiberProps(domElement, newProps);
}

export function commitMount() {}

export { detachDeletedInstance } from "./ReactDOMComponentTree";
