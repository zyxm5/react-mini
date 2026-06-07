function setValueForStyle(style, styleName, value) {
    const isCustomProperty = styleName.indexOf("--") === 0;

    if (value == null || typeof value === "boolean" || value === "") {
        if (isCustomProperty) {
            style.setProperty(styleName, "");
        } else if (styleName === "float") {
            style.cssFloat = "";
        } else {
            style[styleName] = "";
        }
    } else if (isCustomProperty) {
        style.setProperty(styleName, value);
    } else if (typeof value === "number" && value !== 0) {
        style[styleName] = value + "px"; // Presumes implicit 'px' suffix for unitless numbers
    } else {
        if (styleName === "float") {
            style.cssFloat = value;
        } else {
            style[styleName] = ("" + value).trim();
        }
    }
}
/**
 * Sets the value for multiple styles on a node.  If a value is specified as
 * '' (empty string), the corresponding style property will be unset.
 *
 * @param {DOMElement} node
 * @param {object} styles
 */
export function setValueForStyles(node, styles, prevStyles) {
    if (styles != null && typeof styles !== "object") {
        throw new Error(
            "The `style` prop expects a mapping from style properties to values, " +
                "not a string. For example, style={{marginRight: spacing + 'em'}} when " +
                "using JSX.",
        );
    }
    const style = node.style;

    if (prevStyles != null) {
        for (const styleName in prevStyles) {
            if (
                prevStyles.hasOwnProperty(styleName) &&
                (styles == null || !styles.hasOwnProperty(styleName))
            ) {
                // Clear style
                const isCustomProperty = styleName.indexOf("--") === 0;
                if (isCustomProperty) {
                    style.setProperty(styleName, "");
                } else if (styleName === "float") {
                    style.cssFloat = "";
                } else {
                    style[styleName] = "";
                }
            }
        }
        for (const styleName in styles) {
            const value = styles[styleName];
            if (
                styles.hasOwnProperty(styleName) &&
                prevStyles[styleName] !== value
            ) {
                setValueForStyle(style, styleName, value);
            }
        }
    } else {
        for (const styleName in styles) {
            if (styles.hasOwnProperty(styleName)) {
                const value = styles[styleName];
                setValueForStyle(style, styleName, value);
            }
        }
    }
}
