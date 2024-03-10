import {
  ElementProps,
  TagElementProps,
} from "zotero-plugin-toolkit/dist/tools/ui";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";

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

export const makeClickButton = (
  id: string,
  menuitemGroupArr: any[][],
  thisButton?: HTMLButtonElement,
) => {
  const menupopup: any = makeMenupopup(id);
  menuitemGroupArr.filter((menuitemGroup: any[], i: number) => {
    menuitemGroup.map((e: any) => makeMenuitem(e, menupopup));
    //首个菜单组之后，每组均添加分割条，最后一组之后不添加
    if (i < menuitemGroupArr.length - 1) {
      menuseparator(menupopup);
    }
  });
  if (thisButton)
    menupopup.openPopup(thisButton, "after_start", 0, 0, false, false);
  return menupopup;
};
export const menuseparator = (menupopup: any) => {
  ztoolkit.UI.appendElement(
    {
      tag: "menuseparator",
      namespace: "xul",
    },
    menupopup,
  );
};

export const makeMenupopup = (id: string) => {
  const menupopup = ztoolkit.UI.appendElement(
    {
      tag: "menupopup",
      id: id,
      namespace: "xul",
      children: [],
    },
    document.querySelector("#browser")!,
  ) as XUL.MenuPopup;
  return menupopup;
};

declare type MenuitemProps = { label: string; accesskey: string; acceltext: string, func: (...args: any[]) => any | void; args: any[]; };
export const makeMenuitem = (
  option: MenuitemProps,
  menupopup: any,
) => {
  localLabel(option);
  const attributes: any = {};
  Zotero.Utilities.Internal.assignProps(attributes, option, ['label', 'accesskey', "acceltext"]);
  const makeMenuitem = ztoolkit.UI.appendElement(
    {
      tag: "menuitem",
      namespace: "xul",
      attributes: attributes,
    },
    menupopup,
  );
  /* makeMenuitem.addEventListener("command", () => {
        option.func(...option.args);
    }); */
  if (!option.func) return;
  option.args ? option.args : option.args = [];
  if (judgeAsync(option.func)) {
    makeMenuitem.addEventListener("command", async () => {
      await option.func(...option.args);
    });
  } else {
    makeMenuitem.addEventListener("command", () => {
      option.func(...option.args);
    });
  }

  function localLabel(option: MenuitemProps) {
    let label = getString(option.label);
    label = label.startsWith(config.addonRef) || label == void 0 || label == "" ? option.label : label;
    if (option.accesskey) label += ` (${option.accesskey.toLocaleUpperCase()})`;
    //if (option.acceltext) label += ` (${option.acceltext.toLocaleUpperCase()})`;
    option.label = label;
  }
};

export const judgeAsync = (fun: any) => {
  const AsyncFunction = (async () => { }).constructor;
  return fun instanceof AsyncFunction;
};

export function makeId(suffix: string) {
  return `${config.addonRef}-${suffix}`;
}

/**
@param keyword: string
*/
export function getElementValue(keyword: string) {
  const ele = selectEle(keyword);
  if (ele !== undefined && ele != null) {
    if ((ele as any).tagName == "checkbox") {
      return (ele as XUL.Checkbox).checked;
    } else {
      return (ele as any).value;
    }
  }
}

export function getElementValueByElement(ele: Element) {
  if (!ele) return;
  if (ele.tagName == "checkbox") {
    return (ele as XUL.Checkbox).checked;
  } else {
    return (ele as any).value;
  }
}
/**
  @param keyword: string
*/
export function selectEle(keyword: string) {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }
  const selector = "#" + makeId(keyword);
  const ele = doc.querySelector(selector);
  return ele;
}

export function getDom(idSuffix: string) {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) return;
  return doc.querySelector(`#${makeId(idSuffix)}`);
}





