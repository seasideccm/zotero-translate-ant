import { DEFAULT_VALUE, EmptyValue, Nonempty_Keys } from "../../utils/constant";
import { batchListen, deepClone, judgeAsync, showInfo } from "../../utils/tools";


async function tableFactory({
    win,
    containerId,
    props,
}: TableFactoryOptions) {
    if (!containerId) {
        throw "Must pass propsOption.containerId which assign table location";
    }
    const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
    const tableHelper = new ztoolkit.VirtualizedTable(win);
    if (!addon.mountPoint.tables) addon.mountPoint.tables = {};
    tableHelper.setContainerId(containerId);
    tableHelper.setProp(props);
    tableHelper.render(-1, () => {
        renderLock.resolve();
    });
    await renderLock.promise;
    setTimeout(() => {
        (tableHelper.treeInstance as any)._jsWindow.render();//延迟渲染防止显示不全
    }, 1000);
    const treeInstance = tableHelper.treeInstance as VirtualizedTable;
    treeInstance.changeData = changeCellData;
    treeInstance.dataHistory = new DataHistory();
    treeInstance.clearEditing = clearEditing;
    treeInstance.saveDate = saveDate;
    addon.mountPoint.tables[tableHelper.props.id] = tableHelper;
    return tableHelper;
    /**
     * 
     * @param indexRow 
     * @param key 
     * @param value 
     * @returns 
     */
    function changeCellData(indexRow: number, key: string, value: any) {
        if (!treeInstance.rows) return;
        const rows = treeInstance.rows;
        //存储旧数据，新数据从 rows 获取
        if (!treeInstance.dataChangedCache)
            treeInstance.dataChangedCache = {};
        const cache = treeInstance.dataChangedCache;
        if (!cache[indexRow]) cache[indexRow] = {};
        // 存储整行原始数据
        if (!cache[indexRow]["originRow"])
            cache[indexRow]["originRow"] = deepClone(rows[indexRow]);
        // 存储 key 的原始数据，即单元格数据
        // 提交之前，单元格的数据只会保留最后一次修改前的原始数据
        if (!cache[indexRow][key]) cache[indexRow][key] = deepClone(rows[indexRow][key]);
        //修改单元格数据 当前数据源为 rows
        //刷新表格后 rows 中修改的数据会显示在单元格中
        rows[indexRow][key] = value;
    }

    function clearEditing() {
        [
            "dataChangedCache",
            "editIndex",
            "editingRow",
            "editIndices",
            "editingRow",
        ].forEach((key) => {
            treeInstance[key as keyof VirtualizedTable] = void 0;
        });
    }

    /**
     * 保存数据至历史记录中，用以撤销和恢复操作
     * 若传入函数，执行函数后清除编辑状态和数据缓存
     * @param fn 
     * @param args 
     * @returns 
     */
    async function saveDate(fn?: Func, ...args: any[]) {
        if (!treeInstance.dataChangedCache) return;
        const cache = deepClone(treeInstance.dataChangedCache);
        treeInstance.dataHistory.record(cache);
        if (fn) {
            if (judgeAsync(fn)) {
                fn(...args);
            } else {
                await fn(...args);
            }
        }
        treeInstance.clearEditing();
    }
}



export class DataHistory {
    redoStack: DataStack;
    undoStack: DataStack;
    constructor() {
        this.redoStack = new DataStack();
        this.undoStack = new DataStack();
    }

    record(value: any) {
        this.undoStack.push(value);
    }

    undo() {
        const value = this.undoStack.pop();
        if (value == void 0) return;
        this.redoStack.push(value);
        return value;
    }
    redo() {
        const value = this.redoStack.pop();
        if (value == void 0) return;
        this.undoStack.push(value);
        return value;
    }
}

export class DataStack {

    arr: any[];
    constructor() {
        this.arr = [];
    }

    /**
     * 入栈
     * @param element 
     */
    push(element: any) {
        this.arr.push(element);
    }

    /**
     * 出栈
     * @returns 
     */
    pop() {
        return this.arr.pop();
    }

    /**
     * 栈顶元素
     * @returns 
     */
    top() {
        return this.arr[this.arr.length - 1];
    }

    /**
     * 栈长
     * @returns 
     */
    size() {
        return this.arr.length;
    }

    /**
     * 清空栈 
     * @returns 
     */
    clear() {
        this.arr = [];
        return true;
    }
    /**
     * 转字符串
     * @returns 
     */
    toString() {
        return this.arr.toString();
    }
}




/**
 * react 渲染 node 添加的事件监听难以阻止 【 'dragstart','dragend', 'mousedown','mouseup', 'dblclick'】
 * 可通过克隆 node 清除事件监听
 * @param e 
 */
function stopEvent(e: Event) {//@ts-ignore has

    if (e.stopImmediatePropagation) {
        e.stopImmediatePropagation();//@ts-ignore has
    } else if (e.nativeEvent?.stopImmediatePropagation) {//@ts-ignore has
        e.nativeEvent?.stopImmediatePropagation();
    }
    // react 没有 stopImmediatePropagation
    // stopImmediatePropagation 阻止原生事件向父级和自身同类监听冒泡
    // e.nativeEvent react 自定义事件中的原始事件
    // e.nativeEvent.stopImmediatePropagation();阻止原生事件向父级和自身同类监听冒泡
    // e.stopPropagation(); e为自定义事件时，阻止自定义事件向父级冒泡，实际执行的是原生事件的 stopPropagation
    // e.stopPropagation(); 阻止原生事件向父级冒泡
    //e.preventDefault()//阻止默认行为
}

//const actions = ["keydown", "keyup", "input", "mousedown", "mouseup", "click", "dblclick"];
//  focus    ：在元素获取焦点时触发，不支持冒泡;
//  blur     ：在元素失去焦点时触发，不支持冒泡;
//  focusin  ：在元素获取焦点时触发，支持冒泡;
//  focusout ：在元素失去焦点时触发，支持冒泡;

//react 表格行元素 （node）监听的事件
//'dragstart','dragend', 'mousedown','mouseup', 'dblclick',

// mousedown,先触发，再阻止
const actions = ["mousedown", "mouseup", "dblclick"];
function rowToEdit(tableTreeInstance: VirtualizedTable, rowIndex2Edit?: number) {
    if (rowIndex2Edit == void 0) rowIndex2Edit = tableTreeInstance.selection.focused;
    if (rowIndex2Edit == void 0) return false;
    const rowOld = tableTreeInstance._jsWindow.getElementByIndex(rowIndex2Edit) as HTMLDivElement;
    if (!rowOld) return false;
    const rowNew = rowOld.cloneNode(true) as HTMLElement;
    rowOld.parentElement?.replaceChild(rowNew, rowOld);//替换行
    if (!rowNew.dataset.shortcutEditable) {
        rowNew.dataset.shortcutEditable = "true";
        rowNew.setAttribute("contenteditable", "true");
        rowNew.setAttribute("tabindex", "0");
        rowNew.addEventListener("blur", (e) => {
            const rowOld = tableTreeInstance._jsWindow.getElementByIndex(rowIndex2Edit) as HTMLDivElement;
            stopEditing(tableTreeInstance, rowOld, rowNew);//何时保存数据
            rowNew.parentElement?.replaceChild(rowOld, rowNew);//恢复替换的行
        });
        batchListen([rowNew, actions, [stopEvent],]);

    }

    setTimeout(() => {
        rowNew.focus();
    });
    return false;
}

function cellToEdit(tableTreeInstance: VirtualizedTable, rowIndex2Edit?: number, cellIndex2Edit?: number) {
    if (cellIndex2Edit == void 0) cellIndex2Edit = 0;
    if (rowIndex2Edit == void 0) rowIndex2Edit = tableTreeInstance.selection.focused;
    if (rowIndex2Edit == void 0) return false;
    const rowOld = tableTreeInstance._jsWindow.getElementByIndex(rowIndex2Edit) as HTMLDivElement;
    if (!rowOld) return false;
    const rowNew = rowOld.cloneNode(true) as HTMLElement;
    rowOld.replaceWith(rowNew);//替换行
    const cell = rowOld.children[cellIndex2Edit] as HTMLSpanElement;
    if (!rowNew.dataset.shortcutEditable) {
        rowNew.dataset.shortcutEditable = "true";
        //row.setAttribute("contenteditable", "true");
        rowNew.setAttribute("tabindex", "0");
    }
    if (!cell.dataset.shortcutEditable) {
        cell.dataset.shortcutEditable = "true";
        cell.setAttribute("contenteditable", "true");
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("style", "text-transform: uppercase; text-align: center;");
        cell.addEventListener("blur", (e) => {
            if (!e.target) return;
            /* const target = e.target as HTMLElement;
            const marker = target.id || target.classList.toString();
            showInfo(marker + " 失去焦点：" + cell.innerText);
            ztoolkit.log(marker + " 失去焦点：" + cell.innerText); */
            const newRow = cell.parentElement;
            const rowOld = tableTreeInstance._jsWindow.getElementByIndex(rowIndex2Edit) as HTMLDivElement;
            newRow?.replaceWith(rowOld);//恢复替换的行
        });

        cell.addEventListener("focus", (e) => {
            if (!e.target) return;
            const target = e.target as HTMLElement;
            const marker = target.id || target.classList.toString();
            showInfo(marker + " 获得焦点：" + cell.innerText);
            ztoolkit.log(marker + " 获得焦点：" + cell.innerText);
        });

        batchListen([cell, actions, [stopEvent],]);//阻止相同事件冒泡应当在添加监听之后
    }

    // if (target.id == "shortcutTable") return false;
    // if (target.classList.contains("virtualized-table-header")) return false;
    // if (target.id.startsWith("virtualized-table-list")) return false;

    setTimeout(() => {
        cell.focus();
    });
    return false;
}

function stopEditing(tableTreeInstance: VirtualizedTable, rowNew: HTMLElement, rowOld: HTMLElement) {
    if (!tableTreeInstance.rows) return;
    const rowIndex2Edit = tableTreeInstance.selection.focused;
    for (let i = 0; i < rowNew.children.length; i++) {
        let newValue = rowNew.children[i].textContent;
        const key = rowOld.classList[1];
        newValue = valueVerify(key, newValue);
        if (!newValue) return;
        const oldValue = rowOld.children[i].textContent;
        if (newValue == oldValue) continue;
        tableTreeInstance.changeData(rowIndex2Edit, key, newValue);
    }
    tableTreeInstance.invalidateRow(rowIndex2Edit);


    function valueVerify(key: string, value: string | null) {
        if (value == void 0) {
            showInfo(key + `: cannot be "null"`);
            return null;
        }
        if (!value.includes(EmptyValue)) return value;//返回非空值
        if (Nonempty_Keys.includes(key)) {//不允许为空值
            showInfo(key + `: cannot be "${EmptyValue}"`);
            return null;
        }
        return DEFAULT_VALUE[key as keyof typeof DEFAULT_VALUE]; //用默认值替换空值标志      

    }
}




export {
    tableFactory,
    stopEvent,
    rowToEdit,

};


// 函数返回想要提取类型的对象，然后使用 ts 类型提取工具提取未导出的类型 custom.d.ts 

export { createVirtualizedTableProps, createVirtualizedTable, createTreeSelection };

function createVirtualizedTableProps() {
    const tableHelper = new ztoolkit.VirtualizedTable(window);
    const props = tableHelper.treeInstance.props;
    return props;
}

function createVirtualizedTable() {
    const tableHelper = new ztoolkit.VirtualizedTable(window);
    return tableHelper.treeInstance;
}

function createTreeSelection() {
    const tableHelper = new ztoolkit.VirtualizedTable(window);
    return tableHelper.treeInstance.selection;
}




