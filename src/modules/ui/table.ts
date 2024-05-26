import { deepClone, judgeAsync } from "../../utils/tools";

export class Table extends ztoolkit.VirtualizedTable {
    mount: Mount;
    constructor(option: TableFactoryOptions) {
        super(option.win);
        this.setContainerId(option.containerId);
        this.setProp(option.props);
        this.mount = {
            rowsData: option.rowsData,
            saveDate: async (fn?: Func, ...args: any[]) => {
                if (!this.mount.dataChangedCache) return;
                const cache = deepClone(this.mount.dataChangedCache);
                this.mount.dataHistory!.record(cache);
                if (fn) {
                    if (judgeAsync(fn)) {
                        fn(...args);
                    } else {
                        await fn(...args);
                    }
                }
                this.mount.clearEditing();
            },
            getFocusedElement: (where?: string) => {
                const focusedElem = this.treeInstance._topDiv.ownerDocument.activeElement as HTMLElement;
                const idOrClass = focusedElem.id || focusedElem.classList[1];
                const rowDiv = focusedElem.id ? focusedElem : focusedElem.parentElement!;
                const rowIndex = rowDiv.id.split("-").slice(-1)[0];
                ztoolkit.log(where + " 焦点行: " + rowIndex + " 焦点元素: " + idOrClass);
                return focusedElem;
            }
            startEditing:
                changeCellData:
            clearEditing:

        };

    }







    async init() {
        const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
        this.render(-1, () => {
            renderLock.resolve();
        });
        await renderLock.promise;
    }


}