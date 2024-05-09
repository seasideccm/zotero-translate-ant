/* import { VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable"; */




declare type DataBase =
  typeof import("../src/modules/database/database").DataBase;



declare type DocItem = {
  itemID?: number;
  newItemID?: number;
  parentItemID?: number;
  key?: string;
  content: DocCell[];
  status?: "error" | "success" | "cache";
};

declare type DocCell = {
  id: string;
  type:
  | "img"
  | "table"
  | "paragraph"
  | "emptyLine"
  | "title"
  | "headMarker"
  | "tailMarker"
  | "contentEnd"
  | "citation"
  | "header"
  | "footer";
  rawContent: string;
  rawToTranslate?: string | string[];
  translation?: string | string[];
  result?: string;
  status?: string;
  serviceID?: string | string[];
  itemID?: number;
  imgsInLine?: string | string[];
};

declare type TransResult = {
  translation: string;
  serviceID: string;
  status: "error" | "success";
};

declare type OptionsPDFTranslate = {
  /**
   * The caller identifier.
   * This is for translate service provider to identify the caller.
   * If not provided, the call will fail.
   */
  pluginID: string;
  /**
   * Service id. See src/utils/config.ts > SERVICES
   * If not provided, the default service will be used.
   * If you want to use multiple services, please provide an array of service ids.
   * The first service in the array will be used as the default service.
   * Others will be used as fallback services.
   */
  service?: string | string[];
  /**
   * Zotero item id.
   *
   * For language auto-detect check.
   * If not set, use the default value.
   */
  itemID?: number;
  /**
   * From language
   *
   * If not set, generate at task runtime.
   */
  langfrom?: string;
  /**
   * To language.
   *
   * If not set, generate at task runtime.
   */
  langto?: string;
};

/**
 * ```
 * window 显示在哪个窗口中，默认为 Zotero 主窗口
 * closeOnClick 单击关闭，默认为 true
 * closeTime 延迟关闭时间，默认 5s, -1 禁用自动关闭
 * closeOtherProgressWindows 关闭其他消息窗口
 * ```
 */
declare type OptionsPopupWin = {
  window?: Window;
  closeOnClick?: boolean;
  closeTime?: number;
  closeOtherProgressWindows?: boolean;
};

declare type OptionsPopupWinCreateLine = {
  type?: string;
  icon?: string;
  text?: string;
  progress?: number;
  idx?: number;
};

declare type OptionsPopupWinChangeLine = {
  type?: string;
  icon?: string;
  text?: string;
  progress?: number;
  idx?: number;
};

declare type Func = (...args: any[]) => any | void;

declare type MenuProps = [label: string, func?: Func, args?: any[]];



declare type MenuitemProps = {
  label: string;
  accesskey: string;
  acceltext: string;
  func: Func;
  args: any[];
};


declare type SecretKey = {
  serialNumber: number;
  appID: string;
  secretKey: string;
  usable: boolean;
  charConsum: number;
  dateMarker?: string;
};

declare type AccessToken = {
  serialNumber: number;
  appID?: string;
  token: string;
  usable: boolean;
  charConsum: number;
  dateMarker?: string;
};

declare type LimitService = {
  charasPerTime: number;
  QPS: number;
  limitMode: string;
  charasLimit: number;
  configID?: number;
};

declare type CellBox = {
  columnIndex: number;
  rowIndex?: number;
  top: number;
  bottom: number;
  left: number;
  //right: number;
  items: PDFItem[];
};

declare type PDFItem = {
  /*   chars: {
      baseline: number;
      c: string;
      fontName: string;
      fontSize: number;
      rect: number[];
      rotation: number;
    }[]; */
  dir: string;
  fontName: string;
  height: number;
  str: string;
  transform: number[];
  width: number;
  hasEOL: boolean;
};

/**
 * 将一段字符串转换为行，一整行可以有多个行
 */
declare type PDFLine = {
  x: number;
  _x?: number[];
  y: number;
  text: string;
  height: number;
  _height: number[];
  width: number;
  pageIndex: number;
  lineIndex?: number;
  lineSpaceTop: number;
  lineSpaceBottom: number;
  sourceLine: PDFItem[];
  fontName: string;
  _fontName: string[];
  isReference: boolean;
  //0非悬挂，1悬挂首行，2悬挂后续行
  hangingIndent: 0 | 1 | 2;
};

declare type PDFParagraph = {
  lineHeight: number;
  text: string;
  _height: number[];
  left: number;
  right: number;
  top: number;
  bottom: number;
  pageIndex: number;
  width: number;
  isReference: boolean;
  sourceLines: PDFItem[][];
  lines: PDFLine[];
  fontName: string;
  paraSpaceTop: number;
  paraSpaceBottom: number;
  lineSpaceTop: number;
  headingLevel: number;
};

declare type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

declare type EncryptAESInfo = {
  encryptAESString?: string;
  signatureString?: string;
  decryptAlgorithm?: {
    name: string;
  };
  ivString: string;
  wrapedAESKeyString?: string;
  wrapedSignKeyString?: string;
};

declare type KEYSNAME = {
  PUBLICKEY_NAME: string;
  PRIVATEKEY_NAME: string;
  AESCBCKEY_NAME?: string;
};







declare namespace XUL {
  interface MenuPopup {
    state: string;
    anchorNode: nsIDOMElement;
    triggerNode: nsIDOMNode;
    openPopup(
      anchor: nsIDOMElement,
      position: string,
      x: number,
      y: number,
      isContextMenu: boolean,
      attributesOverride: boolean,
      triggerEvent: Event,
    ): void;
  }
}

declare type Services = {
  [key: string]: typeof TranslateService;
};













declare type TableFactoryOptions = {
  win: Window;
  containerId: string;
  props: Partial<VirtualizedTableProps>;
};






/* declare type VirtualizedTableProps = ReturnType<
  typeof import("../src/modules/ui/tableFactory").createVirtualizedTableProps
>; */

/* declare type VirtualizedTable = ReturnType<
  typeof import("../src/modules/ui/tableFactory").createVirtualizedTable
>; */

interface VirtualizedTableProps extends ReturnType<
  typeof import("../src/modules/ui/tableFactory").createVirtualizedTableProps
> {

}

interface TreeSelection extends ReturnType<
  typeof import("../src/modules/ui/tableFactory").createTreeSelection
> {

}


interface VirtualizedTable extends ReturnType<
  typeof import("../src/modules/ui/tableFactory").createVirtualizedTable
> {
  selection: TreeSelection;
  invalidate: () => void;
  _topDiv?: HTMLDivElement;
  _jsWindow: any;
  scrollToRow: Func;
  _getVisibleColumns: () => any[];
  rows?: any[];
  editIndex?: number;
  editIndices?: number[];
  editingRow?: any;
  dataHistory?: any[];
  invalidateRow: (row: number) => void;
  commitEditingRow: () => void;
  dataChangedCache?: any;
  props: Partial<VirtualizedTableProps>;

}






