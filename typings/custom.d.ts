



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








interface VirtualizedTableProps extends ReturnType<
  typeof import("../src/modules/ui/tableFactory").createVirtualizedTableProps
> {

}

interface TreeSelection extends ReturnType<
  typeof import("../src/modules/ui/tableFactory").createTreeSelection
> {

}

declare class DataStack {
  arr: any[];
  push: (element: any) => void;
  pop: () => any;
  top: () => any;
  size: () => number;
  clear: () => boolean;
  toString: () => string;
}

declare class DataHistory {
  redoStack: DataStack;
  undoStack: DataStack;
  record: (value: any) => void;
  undo: () => any | undefined;
  redo: () => any | undefined;
}

interface VirtualizedTable extends ReturnType<
  typeof import("../src/modules/ui/tableFactory").createVirtualizedTable
> {
  [key: string]: any;
  selection: TreeSelection;
  _topDiv: HTMLDivElement;
  _jsWindow: WindowedList;
  //scrollToRow: Func;
  _getVisibleColumns: () => any[];
  rows?: any[];
  editIndex?: number;
  editIndices?: number[];
  editingRow?: any;
  EmptyValue?: string;
  Nonempty_Keys?: string[];
  DEFAULT_VALUE?: any;
  commitEditingRow?: () => void;
  dataChangedCache?: any;
  showRawValueMap?: Map<string, string>;
  props: Partial<VirtualizedTableProps>;
  changeData: (indexRow: number, key: string, value: any) => void;
  handleValue: Func;
  dataHistory: DataHistory;
  clearEditing: () => void;
  saveDate: (fn?: Func, ...args: any[]) => Promise<void>;
  rowToEdit: (focusCell?: number, rowIndex2Edit?: number) => false | undefined;
  /**
     * Ensure the tree scrolls when dragging over top and bottom parts of it
     */
  _onDragOver: (e: Event) => void;
  /**
   * Handles page up/down jumps
   * @param direction - -1 for up, 1 for down
   */
  _onJumpSelect(direction: Integer, selectTo: boolean): void;
  /**
   * Handles key down events in the tree's container.
   */
  _onKeyDown: (e: Event) => void;
  /**
   * Scroll the row into view. Delegates to windowed-list
   */
  scrollToRow(index: number): void;
  /**
   * Updates the selection object
   */
  _onSelection: (index: number, shiftSelect: boolean, toggleSelection: boolean, moveFocused: boolean, shouldDebounce: boolean) => void;
  /**
   * Get all columns including hidden ones
   */
  _getColumns(): void;
  /**
   * Toggle [title] attribute on cells when text is truncated
   * so that a tooltip gets displayed on hover.
   */
  _handleMouseOver: (event: Event) => void;
  /**
   * Manually handle tooltip setting for table cells with overflowing values.
   * Temporary, after
   * https://github.com/zotero/zotero/commit/8e2790e2d2a1d8b15efbf84935f0a80d58db4e44.
   */
  _handleMouseMove: (event: Event) => void;
  /**
   * Remove manually added fake tooltip from _handleMouseMove when the
   * mouse leaves the row completely.
   */
  _handleMouseLeave: (_: any) => void;

  _handleResizerDragStop: (event: any) => void;
  _handleColumnDragStart: (index: any, event: any) => false | undefined;
  _handleColumnDragStop: (event: any, cancelled: any) => void;
  _handleColumnDrag: (event: any) => void;
  _handleHeaderMouseUp: (event: any, dataKey: any, index: any) => void;
  _findColumnDragPosition(x: any): {
    index: number;
    offsetX: number;
  };
  componentDidMount(): void;
  /**
     * Called immediately before a component is destroyed.Perform any necessary cleanup in this method, such as * * * cancelled network requests, or cleaning up any DOM elements created in componentDidMount.
     */
  componentWillUnmount(): void;
  /**
   * Called immediately after updating occurs.Not called for the initial render.
   * The snapshot is only present if getSnapshotBeforeUpdate is present and returns non - null.
   * @param prevProps 
   */
  componentDidUpdate(prevProps: any): void;

  /**
   * Make HTML [title] attribute display a tooltip. Without this
   * HTML [title] attribute when embedded in a XUL window does not
   * trigger a tooltip to be displayed
   * @private
   */
  _setXulTooltip(): void;

  _getWindowedListOptions(): {
    getItemCount: any;
    itemHeight: number;
    renderItem: (index: any, oldElem?: null) => any;
    targetElement: HTMLElement | null;
  };

  _renderItem: (index: any, oldElem?: null) => any;

  _renderHeaderCells: () => JSX.Element[];

  render(): JSX.Element;

  /**
   * Invalidates the underlying windowed-list
   */
  invalidate(): void;
  /**
   * Rerenders/renders the underlying windowed-list. Use for container size changes
   * to render missing items and update widths
   */
  rerender: () => void;

  /**
     * @param customRowHeights an array of tuples specifying row index and row height: e.g. [[1, 10], [5, 10]]
     */
  updateCustomRowHeights: (customRowHeights?: any[]) => void;
  /**
   * Rerender a row in the underlying windowed-list
   */
  invalidateRow(index: number): void;

  /**
   * Rerender a row range in the underlying windowed-list
   */
  invalidateRange(startIndex: any, endIndex: any): void;
  /**
   * When performing custom event handling on rendered rows this allows to ensure that the
   * focus returns to the virtualized table for kb selection and other event handling
   */
  focus(): void;

}

/**
 * @param options - (required):
 * 	- getItemCount  a function that returns the number of items currently on display
 * 	- renderItem {Function} a function that returns a DOM element for an individual row to display
 * 	- itemHeight {Integer}
 * 	- targetElement {DOMElement} a container DOM element for the windowed-list
 * 	- customRowHeights {Array|optional} a sorted array of tuples [itemIndex, rowHeight]
 */
declare class WindowedList {
  constructor(options: (...params: any[]) => any);
  /**
   * Call once to add the windowed-list DOM element to the container
   */
  initialize(): void;
  /**
   * Call to remove the windowed-list from the container
   */
  destroy(): void;
  /**
   * Rerender an individual item. A no-op if the item is not in view
   */
  rerenderItem(index: Integer): void;
  /**
   * Rerender items within the scrollbox. Call sparingly
   */
  invalidate(): void;
  /**
   * Render all items within the scrollbox and remove those no longer visible
   */
  render(): void;
  /**
   * Use to update constructor params
   * @param options - (see constructor())
   */
  update(options: any): void;
  getWindowHeight(): any;
  getElementByIndex: any;
  /**
   * Scroll the top of the scrollbox to a specified location
   * @param scrollOffset - offset for the top of the tree
   */
  scrollTo(scrollOffset: Integer): void;
  /**
   * Scroll the scrollbox to a specified item. No-op if already in view
   */
  scrollToRow(index: any): void;
  getFirstVisibleRow(): any;
  getLastVisibleRow(): any;
  _getItemPosition: any;
  _getRangeToRender(): any;
  _getItemCount(): any;
  _handleScroll: any;
  _binarySearchOffsets(array: any, searchValue: any, lookupByOffset: any): any;
  _resetScrollDirection: any;
}




