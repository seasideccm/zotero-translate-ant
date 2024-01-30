//declare function coroutine(generatorFunction: Function, options?: { yieldHandler: any }): () => Promise<any>;

declare namespace Zotero {
  interface Promise<T = void> extends _ZoteroTypes.Bluebird<T> {
    coroutine(
      generatorFunction: (...args: any[]) => any,
      options?: { yieldHandler: any; },
    ): () => Promise<any>;
  }
}
