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

declare type MenuitemProps = {
  label: string;
  accesskey: string;
  acceltext: string;
  func: Func;
  args: any[];
};
export const makeMenuitem = (option: MenuitemProps, menupopup: any) => {
  localLabel(option);
  const attributes: any = {};
  Zotero.Utilities.Internal.assignProps(attributes, option, [
    "label",
    "accesskey",
    "acceltext",
  ]);
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
  option.args ? option.args : (option.args = []);
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
    label =
      label.startsWith(config.addonRef) || label == void 0 || label == ""
        ? option.label
        : label;
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
@param idSuffix: string
*/
export function getElementValue(idSuffix: string) {
  const ele = selectEle(idSuffix);
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
  @param idSuffix: string
*/
export function selectEle(idSuffix: string) {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) {
    return;
  }
  const selector = "#" + makeId(idSuffix);
  const ele = doc.querySelector(selector);
  return ele;
}

export function getDom(idSuffix: string) {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) return;
  let elem = doc.querySelector(`#${makeId(idSuffix)}`);
  if (elem) return elem;
  elem = doc.querySelector(`#${idSuffix}`);
  return elem;
}

/**
参数均为字符串，能够更具元素值类型自动转换
@param idSuffix: string
@param value: string)
*/
export function setElementValue(
  idSuffix: string,
  value: string | boolean | number,
) {
  const ele = selectEle(idSuffix);
  if (!ele) return;
  //return (ele as Element).setAttribute("value", value)
  //setAttribute是尖括号内的属性，不获取值
  if ((ele as any).tagName == "checkbox") {
    (ele as XUL.Checkbox).checked = Boolean(value);
  } else if ((ele as any).tagName == "textbox") {
    (ele as any).textContent = String(value);
  } else if (typeof (ele as any).value == "number") {
    (ele as any).value = Number(value);
  } else if (typeof (ele as any).value == "string") {
    (ele as any).value = String(value);
  }
}
