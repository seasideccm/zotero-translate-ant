import { ElementProps, TagElementProps } from "zotero-plugin-toolkit/dist/tools/ui";

/**
 * @param option 
 * @returns TagElementProps * 
 * @example
 * ```
 * 传入的参数会覆盖原默认参数, 同时处理 children 属性
 * 默认参数
 * tag 默认为 div
 * ignoreIfExists: true,根据 id 查找元素，如果有则仅返回该元素。
 * skipIfExists：true，不新建元素，继续处理 props/attrs/children
 * removeIfExists: false, 
 * namespace: "xul",
 * enableElementRecord: false,
 * enableElementJSONLog: false,
 * enableElementDOMLog: false,
 * //其他属性
 * tag: string;     
 * classList ?: Array<string>; 
 * styles ?: Partial<CSSStyleDeclaration>; 、
 * properties ?: {*[key: string]: unknown;*}; 
 * attributes ?: {*[key: string]: string | boolean | number | null | undefined;*}; 
 * listeners ?: Array<{
 *  type: string;
 *  listener: EventListenerOrEventListenerObject | ((e: Event) => void) | null | undefined;
 *  options?: boolean | AddEventListenerOptions;}>;
 * children ?: Array<TagElementProps>;
 * skipIfExists ?: boolean;
 * removeIfExists ?: boolean;
 * checkExistenceParent ?: HTMLElement;
 * customCheck ?: (doc: Document, options: ElementProps) => boolean;
 * subElementOptions ?: Array<TagElementProps>;
 * ```
 * @see  {@link ElementProps} for detail
 */
export function makeTagElementProps(option: ElementProps | TagElementProps) {
    const preDefined = {
        enableElementRecord: false,
        enableElementDOMLog: false,
        enableElementJSONLog: false,
        ignoreIfExists: true,
        namespace: "xul",
    };
    if (option.children) {
        option.children.filter((child: ElementProps | TagElementProps) => {
            child = makeTagElementProps(child);
        });
    }
    if (!option.tag) option.tag = "div";
    return Object.assign(preDefined, option) as TagElementProps;
}
