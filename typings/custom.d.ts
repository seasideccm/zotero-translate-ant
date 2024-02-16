//declare function coroutine(generatorFunction: Function, options?: { yieldHandler: any }): () => Promise<any>;

declare namespace Zotero {
  interface Promise<T = void> extends _ZoteroTypes.Bluebird<T> {
    coroutine(
      generatorFunction: (...args: any[]) => any,
      options?: { yieldHandler: any; },
    ): () => Promise<any>;
  }
}

declare type OptionsZPT = {
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