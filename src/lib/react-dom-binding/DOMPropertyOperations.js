export function setValueForKnownAttribute(node, name, value) {
    if (value === null) {
        node.removeAttribute(name);
        return;
    }
    switch (typeof value) {
        case "undefined":
        case "function":
        case "symbol":
        case "boolean": {
            node.removeAttribute(name);
            return;
        }
    }
    node.setAttribute(name, value);
}

export function setValueForAttribute(node, name, value) {
    // If the prop isn't in the special list, treat it as a simple attribute.
    // shouldRemoveAttribute
    if (value === null) {
        node.removeAttribute(name);
        return;
    }
    switch (typeof value) {
        case "undefined":
        case "function":
        case "symbol":
            node.removeAttribute(name);
            return;
        case "boolean": {
            const prefix = name.toLowerCase().slice(0, 5);
            if (prefix !== "data-" && prefix !== "aria-") {
                node.removeAttribute(name);
                return;
            }
        }
    }
    node.setAttribute(name, value);
}
