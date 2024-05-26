import { batchListen, deepClone, judgeAsync } from "../../utils/tools";

async function tableFactory({
    win,
    containerId,
    props,
    rowsData,
}: TableFactoryOptions) {
    if (containerId == void 0) {
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
    /* setTimeout(() => {
        (tableHelper.treeInstance as any)._jsWindow.render();//延迟渲染防止显示不全
    }, 1000); */
    const treeInstance = tableHelper.treeInstance as VirtualizedTable;
    const mount: Mount = {
        rowsData: rowsData,
        getFocusedElement,
        startEditing,
        changeCellData,
        clearEditing,
        saveDate,
    };
    treeInstance.mount = mount;
    mount.dataHistory = new DataHistory();
    addon.mountPoint.tables[tableHelper.props.id] = tableHelper;
    return tableHelper;
    /**
     * 
     * @param indexRow 
     * @param key 
     * @param value 
     * @returns 
     */
    function changeCellData(indexRow: number, key: string, value: string) {
        if (value == void 0) {
            ztoolkit.log("changeCellData: value is null");
            value = "";
        }
        const rows = treeInstance.mount.rowsData!;
        //存储旧数据，新数据从 rows 获取
        if (!treeInstance.mount.dataChangedCache)
            treeInstance.mount.dataChangedCache = {};
        const cache = treeInstance.mount.dataChangedCache;
        if (!cache[indexRow]) cache[indexRow] = {};
        // 存储整行原始数据
        if (!cache[indexRow]["originRow"])
            cache[indexRow]["originRow"] = deepClone(rows[indexRow]);
        // 存储 key 的原始数据，即单元格数据
        // 提交之前，单元格的数据只会保留最后一次修改前的原始数据
        if (!cache[indexRow][key]) cache[indexRow][key] = deepClone(rows[indexRow][key]);
        //修改单元格数据 当前数据源为 rows
        //刷新表格后 rows 中修改的数据会显示在单元格中
        if (treeInstance.handleValue) {
            value = treeInstance.handleValue(key, value);
        }
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
        if (!treeInstance.mount.dataChangedCache) return;
        const cache = deepClone(treeInstance.mount.dataChangedCache);
        treeInstance.mount.dataHistory!.record(cache);
        if (fn) {
            if (judgeAsync(fn)) {
                fn(...args);
            } else {
                await fn(...args);
            }
        }
        treeInstance.mount.clearEditing();
    }

    /**
     * row or cell of table start editing
     * @param {number} cellIndex2Edit?:number 切换为可编辑状态的单元格序号
     * @param {number} rowIndex2Edit?:number 切换为可编辑状态的行序号
     * @param {number} focusCell?:number 聚焦单元格序号
     * @returns {boolean}
     */
    function startEditing(cellIndex2Edit?: number, rowIndex2Edit?: number, focusCell?: number) {
        if (rowIndex2Edit == void 0) rowIndex2Edit = treeInstance.selection.focused || 0;
        let rowSelected = treeInstance._topDiv.children[1].children[0].children[rowIndex2Edit] as HTMLDivElement;
        if (!rowSelected.dataset.cloneRow) {
            const rowNew = rowSelected.cloneNode(true) as HTMLDivElement;
            rowNew.dataset.cloneRow = "true";
            //rowNew.setAttribute("tabindex", "0");编辑单元格，不要设置行可聚焦，以免行聚焦时导致单元格失焦
            rowSelected.parentElement?.replaceChild(rowNew, rowSelected);
            rowSelected = rowNew;
            switchReactEvent("focusin", "off");//避免重复绑定

            //rowNew.style.position = "absolute";
            //rowNew.style.zIndex = "100";           
            //导致 react 表格聚焦的原生事件为 focusin，根节点为 container
        }
        // 单元格或行切换为编辑状态
        cellIndex2Edit ? toEdit(rowSelected, cellIndex2Edit) : toEdit(rowSelected);
        setTimeout(() => { // 任务入列，函数执行完毕后开始执行该任务
            focusCell = focusCell || cellIndex2Edit;
            const elem = focusCell != void 0 ? (rowSelected.children[focusCell] as HTMLElement) : rowSelected;
            elem.focus();
            const idStr = elem.id ? "id: " + elem.id : "class: " + elem.classList[1];
            getFocusedElement("After focused " + idStr);

        });
        return false;
    }
    function toEdit(rowNew: HTMLElement, cellIndex?: number) {
        const elem = cellIndex ? rowNew.children[cellIndex] as HTMLElement : rowNew;
        if (!elem.dataset.shortcutEditable) {
            elem.dataset.shortcutEditable = "true";
            elem.setAttribute("contenteditable", "true");
            elem.setAttribute("tabindex", "0");
            elem.style.pointerEvents = 'auto'; //允许光标文本选择和光标移动           
            elem.addEventListener("blur", funcListener);
            elem.addEventListener("keydown", keydownAction);
            batchListen([[elem, actions1, stopEvent]]);
            //const container = elem.ownerDocument.querySelector("#" + containerId) as HTMLElement;
            //container.addEventListener("keydown", stopEvent, true);
            treeInstance.mount.editingElement = elem;
            treeInstance._topDiv.removeAttribute("tabindex");
            treeInstance._topDiv.children[1].removeAttribute("tabindex");
        }
        function funcListener(this: any, e: Event) {
            let rowNew = e.target as HTMLElement;
            if (!rowNew.dataset.cloneRow) rowNew = rowNew.parentElement as HTMLElement;
            const idStr = rowNew.id ? "id: " + rowNew.id : "class: " + rowNew.classList[1];
            const rowIndex = Number(rowNew.id.split("-").slice(-1)[0]);
            ztoolkit.log(rowNew.id || rowNew.classList.toString(), e.type, e);
            //const selectedIndex = getSelectedIndex();
            if (rowIndex == treeInstance.selection.focused) {
                if (e.type != "blur") e.stopImmediatePropagation();
                (e.target as HTMLElement).focus();
                getFocusedElement(`${idStr} blur then refocused`);
                return;
            }
            this.removeEventListener("keydown", keydownAction);
            this.removeEventListener("blur", funcListener);
            stopEditing(rowNew);
            getFocusedElement(`after ${idStr} blur`);
        }
    }

    function keydownAction(this: any, e: any) {
        const selection = win.getSelection();
        if (!selection || !selection.anchorNode) return;
        const anchorNode = selection.anchorNode;
        const str = selection.anchorNode.textContent;
        if (["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(e.code)) {
            e.preventDefault();
            e.stopImmediatePropagation;





            let offset = ["ArrowLeft", "Backspace"].includes(e.code) ? -1 : 1;
            if (e.code == "Delete") offset -= 1;
            offset += selection.anchorOffset;
            if (offset > anchorNode!.textContent!.length) offset = anchorNode!.textContent!.length;
            if (offset < 0) offset = 0;
            switch (e.code) {
                case "ArrowLeft":
                case "ArrowRight":
                    selection.setPosition(selection.anchorNode, offset);
                    break;
                case "Backspace":
                case "Delete":
                    if (!str) return;
                    anchorNode.textContent = str.substring(0, offset) + str.substring(offset + 1);
                    selection.setPosition(selection.anchorNode, offset);
                    break;
            }
        }
    }

    function stopEditing(rowNew: HTMLElement, rowIndex2Edit?: number) {
        if (rowIndex2Edit == void 0) {
            rowIndex2Edit = Number(rowNew.id.split("-").slice(-1)[0]);
        }
        const rowOld = treeInstance._jsWindow.getElementByIndex(rowIndex2Edit);
        modifyRowsData(rowNew, rowOld, rowIndex2Edit);
        rowNew.parentElement?.replaceChild(rowOld, rowNew);
        treeInstance.invalidate();
        switchReactEvent("focusin", "on");
        treeInstance._topDiv.setAttribute("tabindex", "0");
        treeInstance._topDiv.children[1].setAttribute("tabindex", "-1");
        treeInstance.mount.editingElement = void 0;
    }

    function modifyRowsData(rowNew: HTMLElement, rowOld: HTMLElement, rowIndex2Edit: number) {
        const showRawValueMap = treeInstance.mount.showRawValueMap;
        for (let i = 0; i < rowNew.children.length; i++) {
            let newValue = rowNew.children[i].textContent;
            let oldValue = rowOld.children[i].textContent;
            if (newValue == oldValue) continue;
            const key = rowNew.children[i].classList[1];
            newValue = valueVerify(key, newValue, showRawValueMap) || '';
            oldValue = valueVerify(key, oldValue, showRawValueMap) || '';
            treeInstance.changeData(rowIndex2Edit, key, newValue);
        }
        /**
        * 校验数据，并按需将显示值转为原始值
        * @param key 
        * @param value 
        * @param showRawValueMap showValue→rawValue
        * @returns 
        */
        function valueVerify(key: string, value: string | null, showRawValueMap?: Map<string, string>) {
            let rawValue = value;
            if (showRawValueMap && value != void 0) {
                if (showRawValueMap.has(value)) {
                    rawValue = showRawValueMap.get(value) || null;
                }
            }
            if (rawValue == void 0) return null;
            if (treeInstance.mount.EmptyValue) {
                if (!rawValue.includes(treeInstance.mount.EmptyValue)) return rawValue;//返回非空值
                if (treeInstance.mount.Nonempty_Keys) {
                    if (treeInstance.mount.Nonempty_Keys.includes(key)) return null;
                    if (treeInstance.mount.DEFAULT_VALUE) {
                        return treeInstance.mount.DEFAULT_VALUE[key as keyof typeof treeInstance.mount.DEFAULT_VALUE];//用默认值替换空值标志  
                    }
                }
            }
            return rawValue;
        }
    }

    function switchReactEvent(eventType: keyof DocumentEventMap, change: "off" | "on" = "off") {
        const doc = treeInstance._topDiv.ownerDocument!;
        const container = doc.querySelector("#" + containerId) as HTMLElement;
        if (!container) return;
        if (change == "on") {
            container.removeEventListener(eventType, stopIt);
            ztoolkit.log(eventType + ' 事件监听被撤销。');
            return;
        }
        // 捕获和冒泡阶段都阻止，会导致监听不能被移除
        container.addEventListener(eventType, stopIt);
        ztoolkit.log(eventType + ' 事件被监听。');
        function stopIt(this: any, e: Event) {
            //preventDefault: 如果当前event.cancelable属性为true, 则取消当前默认的动作, 但不阻止当前事件进一步传播.
            //stopPropagation: 阻止当前冒泡或者捕获阶段的进一步传播 .
            //stopImmediatePropagation: 阻止调用相同事件的其他监听器
            // 阻断原生事件到 document 的传播，react 自身的 e.type 事件回调不会再执行

            const phase = e.eventPhase == e.BUBBLING_PHASE ? "冒泡阶段" : "捕获阶段";
            e.stopImmediatePropagation();
            ztoolkit.log(this.id, `${phase} ${e.type}  事件被触发, 紧接着被阻断，避免 react 相应合成事件的执行。`);
        }
    }

    function getFocusedElement(where?: string) {
        const focusedElem = treeInstance._topDiv.ownerDocument.activeElement as HTMLElement;
        const idOrClass = focusedElem.id || focusedElem.classList[1];
        const rowDiv = focusedElem.id ? focusedElem : focusedElem.parentElement!;
        const rowIndex = rowDiv.id.split("-").slice(-1)[0];
        ztoolkit.log(where + " 焦点行: " + rowIndex + " 焦点元素: " + idOrClass);
        return focusedElem;
    }
    function getSelectedRow() {
        const focusedIndex = treeInstance.selection.focused;
        return treeInstance._topDiv.children[1].children[0].children[focusedIndex] as HTMLDivElement;
    }

    function getSelectedIndex() {
        const selectedRow = getSelectedRow();
        return Number(selectedRow.id.split("-").slice(-1)[0]);
    }

}

function focusHandler(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(range);
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
function stopEvent(this: any, e: Event) {//@ts-ignore has

    if (e.stopImmediatePropagation) {
        e.stopImmediatePropagation();//@ts-ignore has
    } else if (e.nativeEvent) {//@ts-ignore has
        e.nativeEvent!.stopImmediatePropagation();
    }
    ztoolkit.log(this.id || this.classList.toString(), e.type, e);
    // react 没有 stopImmediatePropagation
    // stopImmediatePropagation 阻止原生事件向父级和自身同类监听冒泡
    // e.nativeEvent react 自定义事件中的原始事件
    // e.nativeEvent.stopImmediatePropagation();阻止原生事件向父级和自身同类监听冒泡
    // e.stopPropagation(); e为自定义事件时，阻止自定义事件向父级冒泡，实际执行的是原生事件的 stopPropagation
    // e.stopPropagation(); 阻止原生事件向父级冒泡
    //e.preventDefault()//阻止默认行为
}

const actions1 = ["keydown", "keyup", "input", "mousedown", "mouseup", "click", "dblclick"];
//  focus    ：在元素获取焦点时触发，不支持冒泡;
//  blur     ：在元素失去焦点时触发，不支持冒泡;
//  focusin  ：在元素获取焦点时触发，支持冒泡;
//  focusout ：在元素失去焦点时触发，支持冒泡;

//react 表格行元素 （node）监听的事件
//'dragstart','dragend', 'mousedown','mouseup', 'dblclick',

// mousedown,先触发，再阻止
const actions2 = ["mousedown", "mouseup", "dblclick", "click"];
export {
    tableFactory,
    stopEvent,
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

