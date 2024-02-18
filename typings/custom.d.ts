//declare function coroutine(generatorFunction: Function, options?: { yieldHandler: any }): () => Promise<any>;

declare namespace Zotero {
  interface Promise<T = void> extends _ZoteroTypes.Bluebird<T> {
    coroutine(
      generatorFunction: (...args: any[]) => any,
      options?: { yieldHandler: any; },
    ): () => Promise<any>;
  }
}

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

declare type MenuProps = [label: string, func?: (...args: any[]) => any | void, args?: any[]];

declare type MenuItemProps = {
  label: string;
  func?: ((...args: any[]) => any) | undefined;
  args?: any[] | undefined;
};

declare type VTableProps = {
  id?: string;
  getRowCount?: () => number;
  getRowData?: (index: number) => {
    [dataKey: string]: string;
  };
  /**
   * Use `getRowData` instead. This property is generated automatically.
   * @param index
   * @param selection
   * @param oldElem
   * @param columns
   */
  renderItem?: (index: number, selection: TreeSelection, oldElem: HTMLElement, columns: ColumnOptions[]) => Node;
  linesPerRow?: number;
  disableFontSizeScaling?: boolean;
  alternatingRowColors?: Array<string>;
  label?: string;
  role?: string;
  showHeader?: boolean;
  columns?: Array<ColumnOptions>;
  onColumnPickerMenu?: (event: Event) => void;
  onColumnSort?: (event: Event) => void;
  getColumnPrefs?: () => {
    [dataKey: string]: any;
  };
  storeColumnPrefs?: (prefs: {
    [dataKey: string]: any;
  }) => void;
  getDefaultColumnOrder?: () => {
    [dataKey: string]: any;
  };
  staticColumns?: boolean;
  containerWidth?: number;
  treeboxRef?: (innerWindowedList: WindowedList) => any;
  hide?: boolean;
  multiSelect?: boolean;
  onSelectionChange?: (selection: TreeSelection, shouldDebounce: boolean) => void;
  isSelectable?: (index: number) => boolean;
  getParentIndex?: (index: number) => number;
  isContainer?: (index: number) => boolean;
  isContainerEmpty?: (index: number) => boolean;
  isContainerOpen?: (index: number) => boolean;
  toggleOpenState?: (index: number) => void;
  getRowString?: (index: number) => string;
  onKeyDown?: (e: KeyboardEvent) => boolean;
  onKeyUp?: (e: KeyboardEvent) => boolean;
  onDragOver?: (e: DragEvent) => boolean;
  onDrop?: (e: DragEvent) => boolean;
  onActivate?: ((e: MouseEvent) => boolean) | ((event: Event, indices: number[]) => boolean);
  onFocus?: (e: FocusEvent) => boolean;
  onItemContextMenu?: (e: MouseEvent | KeyboardEvent, x: number, y: number) => boolean;
};


interface VirtualizedTableProps {
  id: string;
  getRowCount: () => number;
  getRowData?: (index: number) => {
    [dataKey: string]: string;
  };
  /**
   * Use `getRowData` instead. This property is generated automatically.
   * @param index
   * @param selection
   * @param oldElem
   * @param columns
   */
  renderItem?: (index: number, selection: TreeSelection, oldElem: HTMLElement, columns: ColumnOptions[]) => Node;
  linesPerRow?: number;
  disableFontSizeScaling?: boolean;
  alternatingRowColors?: Array<string>;
  label?: string;
  role?: string;
  showHeader?: boolean;
  columns?: Array<ColumnOptions>;
  onColumnPickerMenu?: (event: Event) => void;
  onColumnSort?: (event: Event) => void;
  getColumnPrefs?: () => {
    [dataKey: string]: any;
  };
  storeColumnPrefs?: (prefs: {
    [dataKey: string]: any;
  }) => void;
  getDefaultColumnOrder?: () => {
    [dataKey: string]: any;
  };
  staticColumns?: boolean;
  containerWidth?: number;
  treeboxRef?: (innerWindowedList: WindowedList) => any;
  hide?: boolean;
  multiSelect?: boolean;
  onSelectionChange?: (selection: TreeSelection, shouldDebounce: boolean) => void;
  isSelectable?: (index: number) => boolean;
  getParentIndex?: (index: number) => number;
  isContainer?: (index: number) => boolean;
  isContainerEmpty?: (index: number) => boolean;
  isContainerOpen?: (index: number) => boolean;
  toggleOpenState?: (index: number) => void;
  getRowString?: (index: number) => string;
  onKeyDown?: (e: KeyboardEvent) => boolean;
  onKeyUp?: (e: KeyboardEvent) => boolean;
  onDragOver?: (e: DragEvent) => boolean;
  onDrop?: (e: DragEvent) => boolean;
  onActivate?: (e: MouseEvent) => boolean;
  onActivate?: (event: Event, indices: number[]) => boolean;
  onFocus?: (e: FocusEvent) => boolean;
  onItemContextMenu?: (e: MouseEvent | KeyboardEvent, x: number, y: number) => boolean;
}


declare type columnsProp = {
  dataKey: string,
  label: string,
  staticWidth: boolean,
  fixedWidth: boolean,
  flex: number;
};


declare type CS = {
  dataKey: string;
  label: string;
  iconLabel?: React.ReactElement;
  defaultSort?: 1 | -1;
  flex?: number;
  width?: number;
  fixedWidth?: boolean;
  staticWidth?: boolean;
  minWidth?: number;
  ignoreInColumnPicker?: boolean;
  submenu?: boolean;
};

declare type columnOption<K extends keyof ColumnOptions> = [K];

declare type CS2 = [dataKey: string,
  label: string,
  iconLabel?: React.ReactElement,
  defaultSort?: 1 | -1,
  flex?: number,
  width?: number,
  fixedWidth?: boolean,
  staticWidth?: boolean];

interface TreeSelection {
  _tree: VirtualizedTable;
  pivot: number;
  focused: number;
  selected: Set<number>;
  _selectEventsSuppressed: boolean;
  /**
   * @param tree {VirtualizedTable} The tree where selection occurs. Will be used to issue
   * updates.
   */
  new(tree: VirtualizedTable): this;
  /**
   * Returns whether the given index is selected.
   * @param index {Number} The index is 0-clamped.
   * @returns {boolean}
   */
  isSelected(index: number): boolean;
  /**
   * Toggles an item's selection state, updates focused item to index.
   * @param index {Number} The index is 0-clamped.
   * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
   */
  toggleSelect(index: number, shouldDebounce?: boolean): void;
  clearSelection(): void;
  /**
   * Selects an item, updates focused item to index.
   * @param index {Number} The index is 0-clamped.
   * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
   * @returns {boolean} False if nothing to select and select handlers won't be called
   */
  select(index: number, shouldDebounce?: boolean): boolean;
  rangedSelect(from: number, to: number, augment: boolean, isSelectAll: boolean): void;
  /**
   * Performs a shift-select from current pivot to provided index. Updates focused item to index.
   * @param index {Number} The index is 0-clamped.
   * @param augment {Boolean} Adds to existing selection if true
   * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
   */
  shiftSelect(index: number, augment: boolean, shouldDebounce?: boolean): void;
  /**
   * Calls the onSelectionChange prop on the tree
   * @param shouldDebounce {Boolean} Whether the update to the tree should be debounced
   * @private
   */
  _updateTree(shouldDebounce?: boolean): void;
  get count(): number;
  get selectEventsSuppressed(): boolean;
  set selectEventsSuppressed(val: boolean);
}