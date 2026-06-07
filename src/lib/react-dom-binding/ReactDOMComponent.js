import setTextContent from "./setTextContent";
import {
    setValueForKnownAttribute,
    setValueForAttribute,
} from "./DOMPropertyOperations";
import { setValueForStyles } from "./CSSPropertyOperations";

export function setInitialProperties(domElement, type, props) {
    for (const propKey in props) {
        if (!props.hasOwnProperty(propKey)) {
            continue;
        }
        const propValue = props[propKey];
        if (propValue == null) {
            continue;
        }
        setProp(domElement, propKey, propValue, props, null);
    }
}

function setProp(domElement, key, value, props, prevValue) {
    switch (key) {
        case "children":
            {
                if (typeof value === "string") {
                    // 文本
                    setTextContent(domElement, "" + value);
                }
            }
            break;
        case "className":
            setValueForKnownAttribute(domElement, "class", value);
            break;
        case "style": {
            setValueForStyles(domElement, value, prevValue);
            return;
        }
        // 不处理innerText和textContent
        case "innerText":
        case "textContent":
            return;
        // ...省略一大堆属性
        default: {
            if (
                key.length > 2 &&
                (key[0] === "o" || key[0] === "O") &&
                (key[1] === "n" || key[1] === "N")
            ) {
                // 开发环境对事件名称做校验，必须是on或者ON开头
                // Updating events doesn't affect the visuals.
                return;
            } else {
                setValueForAttribute(domElement, key, value);
            }
        }
    }
}

export function updateProperties(domElement, tag, lastProps, nextProps) {
    for (const propKey in lastProps) {
        const lastProp = lastProps[propKey];
        if (
            lastProps.hasOwnProperty(propKey) &&
            lastProp != null &&
            !nextProps.hasOwnProperty(propKey)
        ) {
            setProp(domElement, propKey, null, nextProps, lastProp);
        }
    }
    for (const propKey in nextProps) {
        const nextProp = nextProps[propKey];
        const lastProp = lastProps[propKey];
        if (
            nextProps.hasOwnProperty(propKey) &&
            nextProp !== lastProp &&
            (nextProp != null || lastProp != null)
        ) {
            setProp(domElement, propKey, nextProp, nextProps, lastProp);
        }
    }
}
