import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { arrToObj, arrsToObjs, batchAddEventListener, chooseFilePath, deepClone, differObject, objOrder, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import { TranslateService, TranslateServiceAccount } from "../translate/translateService";
import { getDom, getElementValue } from "./uiTools";
import { deleteAcount, getNextServiceSNSync, getSerialNumberSync, getServiceAccountSync, getServices, getServicesFromDB, validata } from "../translate/translateServices";
import { DEFAULT_VALUE, EmptyValue, } from '../../utils/constant';


declare type TableFactoryOptions = { win: Window, containerId: string, props: VirtualizedTableProps; };
export async function tableFactory({ win, containerId, props }: TableFactoryOptions) {
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
    addon.mountPoint.tables[tableHelper.props.id] = tableHelper;
    return tableHelper;

}

export async function replaceSecretKeysTable() {
    const win = addon.data.prefs?.window;
    if (!win) return;
    const id = `${config.addonRef}-` + "secretKeysTable";
    const containerId = `${config.addonRef}-table-container`;
    const serviceID = getElementValue("serviceID");
    const columnPropKeys = ["dataKey", "label", "staticWidth", "fixedWidth", "flex"];
    //数据 rows 表格创建后挂载至 tableTreeInstance 表格实例上
    const rows: any[] = await secretKeysTableRowsData(serviceID) || [];
    if (!rows || rows.length == 0) return;
    //props
    const columnPropValues = makeColumnPropValues(rows[0]);
    const columnsProp = arrsToObjs(columnPropKeys)(columnPropValues) as ColumnOptions[];

    const props: VirtualizedTableProps = {
        id: id,
        columns: columnsProp,
        staticColumns: false,
        showHeader: true,
        multiSelect: true,
        getRowCount: () => rows.length,
        getRowData: (index: number) => rows[index],
        getRowString: handleGetRowString,
        onKeyDown: handleKeyDown,
        onSelectionChange: handleSelectionChange,
        //@ts-ignore has
        onActivate: handleActivate,
        onItemContextMenu: handleItemContextMenu,
        onDrop: handleDrop,
        onDragOver: handleDragOver,
        onFocus: handleFocus,
    };

    const options: TableFactoryOptions = {
        win: win,
        containerId: containerId,
        props: props,
    };

    const tableHelper = await tableFactory(options);
    const tableTreeInstance = tableHelper.treeInstance as VTable;
    //tableTreeInstance.invalidateRow(rows.length - 1);
    //@ts-ignore has
    tableTreeInstance.scrollToRow(rows.length - 1);
    //win.resizeBy(200, 200);
    //win.resizeBy(-200, -200);
    tableTreeInstance.rows = rows;

    //绑定事件，增删改查
    getDom("addRecord")!.addEventListener("command", addRecord);
    getDom("addRecordBulk")!.addEventListener("command", addRecordBulk);
    win.addEventListener("beforeunload", () => {
        saveAccounts();
    });
    win.addEventListener("click", clickTableOutsideCommit);

    //@ts-ignore has//切换选项标签
    const visibleKeys = tableTreeInstance._getVisibleColumns().map((e: any) => e.dataKey);//可见列的key
    adjustWidth(rows, visibleKeys);


    function adjustWidth(rows: any[], visibleKeys?: string[]) {

        const onResizeData: any = {};
        const totalWidth = tableTreeInstance._topDiv?.clientWidth;//表格宽度
        if (!totalWidth) return;
        const colums: any[][] = rowsToColums(rows, visibleKeys) || [[]];
        const longestCells = strMax(colums);
        const keys = visibleKeys || Object.keys(rows[0]);//可指定keys
        const keyWidth: { [key: string]: number; } = {};
        for (let i = 0; i < keys.length; i++) {
            const cellText = longestCells[i];
            const key = keys[i];
            const width = caculateCellWidth(key, cellText, i);
            keyWidth[key] = width || 0;
        }
        const sum = Object.values(keyWidth).reduce((prev, curr) => { return prev + curr; }, 0);
        if (!sum) return;

        if (sum >= totalWidth) {
            //只关注可见列，除了最宽列，均最佳显示
            let sumTemp = sum;         //根据列的内容（筛选出每列字符数最多的值）排序
            const values = Object.values(keyWidth).sort();
            let keys = Object.keys(keyWidth);
            let lengthMax: number;
            while (sumTemp >= totalWidth) {
                lengthMax = values.pop() || 0;
                const keyMax = keys.find(key => keyWidth[key] == lengthMax);
                keys = keys.filter(key => key != keyMax);
                sumTemp = values.reduce((prev, curr) => { return prev + curr; }, 0);
            }
            for (const key of keys) {
                onResizeData[key] = (keyWidth[key] || 0);
            }

        } else {
            const diff = totalWidth - sum;
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                onResizeData[key] = keyWidth[key] + Math.round(diff * (keyWidth[key] / sum));
            }
        }//@ts-ignore has        
        tableTreeInstance._columns.onResize(onResizeData);//@ts-ignore has
        tableTreeInstance.rerender();
    }

    function caculateCellWidth(key: string, cellText: string, index: number = 0) {
        tableTreeInstance._topDiv?.scrollIntoView();//@ts-ignore has
        tableTreeInstance.rerender();
        const container = tableTreeInstance._topDiv?.children[1].children[0].children[0] as HTMLDivElement;

        if (!container) return;
        const span = container.children.item(index);
        if (!span || span?.classList[1] !== key) {
            showInfo("行元素有错误");
            return;
        }
        const spanClone = span.cloneNode(true) as HTMLSpanElement;
        container.appendChild(spanClone);
        spanClone.style.position = "fixed";
        spanClone.style.top = "-1000px";
        spanClone.textContent = cellText;
        const clientWidth = spanClone.clientWidth;
        return spanClone.scrollWidth;

    }

    function strMax(colums: any[][]) {
        const longestCells = [];
        for (const column of colums) {
            let tempLength = 0;
            let strMax = '';
            for (const str of column) {
                const length = String(str).length;
                if (length > tempLength) {
                    tempLength = length;
                    strMax = str;
                }
            }
            longestCells.push(strMax);
        }
        return longestCells;
    }
    /**
     * 每列值为一组，依据key的顺序成组
     * @param rows 
     * @param visibleKeys 
     * @returns 
     */
    function rowsToColums(rows: any[], visibleKeys?: string[]) {
        visibleKeys ? visibleKeys : Object.keys(rows[0]);
        if (!visibleKeys || visibleKeys.length == 0) return;
        const colums: any[] = [];
        visibleKeys.filter((key, index) => {
            colums.push([]);
        });
        for (const row of rows) {
            visibleKeys.filter((key, index) => {
                colums[index].push(row[key]);
            });

        }
        return colums as any[][];
    }
    async function addRecord(e: Event) {
        // const table = getTableByID(`${config.addonRef}-` + "secretKeysTable");
        if (tableTreeInstance.editIndex != void 0) {//@ts-ignore has
            tableTreeInstance.commitEditingRow();
        }
        const rows = tableTreeInstance.rows || [];
        const emptyrows = await secretKeysTableRowsData(serviceID, true) || [];
        if (emptyrows.length == 0) {
            const keys = Object.keys(rows[0]);
            const row = arrToObj(keys, keys.map((k) => k + ': No Data'));
            emptyrows.push(row);
        }
        rows.push(emptyrows[0]);
        tableTreeInstance.render();
        tableTreeInstance.selection.select(rows.length - 1);//@ts-ignore has        
        const seletedRow = tableTreeInstance._topDiv.querySelectorAll(`#${tableTreeInstance._jsWindowID} [aria-selected=true]`)[0];
        if (!seletedRow) {
            showInfo("No seletedRow");
            return;
        }
        const dblClickEvent = new window.MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
        });
        seletedRow.dispatchEvent(dblClickEvent);//发送鼠标双击，模拟激活节点，直接开始编辑
    }


    async function addRecordBulk(e: Event) {
        const filePath = await chooseFilePath();//
        const extension = Zotero.File.getExtension(filePath);
        let text = '';//
        const result = Zotero.File.getContentsAsync(filePath);
        if (typeof result == "string") {
            text += result;
        } else if (!(result instanceof Uint8Array)) {
            text += await result;

        };
        //showInfo([text, extension]);
        batchAddAccount(text);
        tableHelper.render();
    }
    /**
     * 获取引擎账号或空数据
     * @param serviceID 
     * @param getEmptyData 
     * @returns 
     */
    async function secretKeysTableRowsData<T extends keyof TranslateService>(serviceID: T, getEmptyData: boolean = false) {
        let services = await getServices();
        let serviceSelected = services[serviceID];
        if (!serviceSelected || !serviceSelected.accounts) {
            services = await getServicesFromDB();
            serviceSelected = services[serviceID];
            if (!serviceSelected) return;
        }
        let rows: any[];
        if (!serviceSelected.hasSecretKey && !serviceSelected.hasToken) return;
        const secretKeyOrtoken = serviceSelected.hasSecretKey ? "secretKey" : "token";
        const keys = ["appID", secretKeyOrtoken, "usable", "charConsum"];
        if (!serviceSelected.accounts || !serviceSelected.accounts.length || getEmptyData) {
            return rows = [kvArrsToObject(keys)()];  // 返回空数据   
        }
        //const keys = Object.keys(serviceSelected.accounts[0]);// feild much more
        const getRowDataValues = kvArrsToObject(keys);
        rows = serviceSelected.accounts.map((acount: TranslateServiceAccount) =>
            getRowDataValues(keys.map((key) => acount[key as keyof TranslateServiceAccount])));
        return rows;
    };
    function handleFocus(e: any) {        //@ts-ignore has
        if (tableTreeInstance && tableTreeInstance.prevFocusCell) {//@ts-ignore has
            tableTreeInstance.prevFocusCell.focus();
            if (e && e.stopPropagation) {
                e.stopPropagation();
            } else {
                //@ts-ignore has
                if (window.event) window.event.cancelBubble = true;
            }
            if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
        return false;
    }

    function handleDragOver(e: DragEvent) {
        if (!e.dataTransfer) return false;
        e.preventDefault();
        e.stopPropagation();//@ts-ignore has
        if (e.dataTransfer.types.contains("application/x-moz-file")) {
            //
            if (!Zotero.isMac) {
                if (e.shiftKey) {
                    if (e.ctrlKey) {
                        e.dataTransfer.dropEffect = "link";
                    }
                    else {
                        e.dataTransfer.dropEffect = "move";
                    }
                }
                else {
                    e.dataTransfer.dropEffect = "copy";
                }
            }
        }
        return false;
    }

    function handleDrop(e: DragEvent) {
        if (!e.dataTransfer) return false;//
        const dragData = Zotero.DragDrop.getDataFromDataTransfer(e.dataTransfer);
        if (!dragData) {//
            Zotero.debug("No drag data");
            return false;
        }
        const data = dragData.data;
        let text: string = '';
        const allPromise = [];
        for (let i = 0; i < data.length; i++) {
            const file = data[i];//
            const extension = Zotero.File.getExtension(file);//
            const result = Zotero.File.getContentsAsync(file);
            if (typeof result == "string") {
                text += result;
            } else if (!(result instanceof Uint8Array)) {//
                const readerLock = Zotero.Promise.defer();
                allPromise.push(readerLock);
                result.then((str: any) => {
                    if (typeof str == "string") text += str;
                    readerLock.resolve();
                });

            };
            showInfo("drop file extension:" + extension);
        }        //@ts-ignore has
        Zotero.Promise.all(allPromise).then(() => {
            batchAddAccount(text);
            tableHelper.render();
            return false;
        });
        return false;
    }





    function handleGetRowString(index: number) {
        const rowCellsString = Object.values(rows[index]).filter(e => typeof e === "string") as string[];
        if (rowCellsString.length === 0) return "";//@ts-ignore has
        const typingString = tableTreeInstance._typingString as string;
        const matchCells = rowCellsString.filter((str: string) => str.toLowerCase().includes(typingString));
        if (matchCells.length > 0) {
            return matchCells[0];
        } else {
            return "";
        }
    }

    function handleSelectionChange(selection: TreeSelection, shouldDebounce: boolean) {
        if (tableTreeInstance.dataChangedCache) saveAccounts();
        //@ts-ignore has
        const visibleKeys = tableTreeInstance._getVisibleColumns().map((e: any) => e.dataKey);
        adjustWidth(rows, visibleKeys);
        return true;
    }

    function handleItemContextMenu(...args: any[]) {

        const [event, x, y] = args;
        onCollectionsContextMenuOpen(event, x, y);
        return false;
        function buildContextMenu() {
            const keys = ["label", "func", "args"];
            const menuPropsGroupsArr = [
                [
                    ["菜单1", testContextMenu, ["菜单1", "第1位"]],
                    ["菜单2", testContextMenu, ["菜单2", "第2位"]],
                ],
                [
                    ["菜单4", testContextMenu, ["菜单4", "第3位"]],
                    ["菜单3", testContextMenu, ["菜单3", "第4位"]],
                ],
            ];
            const idPostfix = "tableContextMenu";
            const contextMenu = new ContextMenu({ keys, menuPropsGroupsArr, idPostfix });
            return contextMenu;
        };
        async function onCollectionsContextMenuOpen(e: Event, x: number, y: number) {
            const contextMenu = buildContextMenu();
            //@ts-ignore has
            x = x || e.screenX; //@ts-ignore has
            y = y || e.screenY;
            // TEMP: Quick fix for https://forums.zotero.org/discussion/105103/
            //
            if (Zotero.isWin) {
                x += 10;
            }
            const anchor = e.target;
            //contextMenu.menupopup.openPopup(anchor, x, y);
            contextMenu.menupopup.openPopup(anchor, 'after_pointer', 0, 0, true, false, e);//
            contextMenu.menupopup.moveTo(x, y);
        };

        function testContextMenu(...args: any[]) {
            const menuPopupEvent = args.pop();
            const target = args.pop();

            const eventType = menuPopupEvent.type;

            const id = target.id;
            showInfo(["表格行右键菜单:" + id, `事件类型：${eventType}`],
                {
                    window: win,

                });
            const arg1 = args[0];
            const arg2 = args[1];
            showInfo("原始参数：" + arg1 + "<br><br>" + arg2);
        }



    }


    function handleKeyDown(e: KeyboardEvent) {
        // Returning false to prevent default event.
        //return返回的值决定是否继续执行 virtualized-table.jsx 默认的按键功能
        //
        if (e.key == "Delete" || e.key == "Backspace" || (Zotero.isMac && e.key == "Backspace")) {
            const confirm = win?.confirm(getString("info-delete-secretKey") + '\n'
                + getString("info-delete-confirm"));
            if (!confirm) return true;            //确认删除，点击cancel则取消

            //过滤掉选中行的数据，保留未选中的数据为数组，赋值给rows
            //@ts-ignore has
            const selectedIndices = Array.from(tableTreeInstance.selection.selected);
            const rowsDelete = rows.filter((v: any, i: number) => selectedIndices.includes(i)) || [];
            const rowsBackup = [...rows];
            selectedIndices.sort((a, b) => a - b);
            selectedIndices.filter((indexValue: number, subIndex: number) => {
                const deleteIndex = indexValue - subIndex;//避免下标变化而出错
                rows.splice(deleteIndex, 1);
            });

            //从services中删除
            const service = addon.mountPoint.services[serviceID];
            const appIDsDelete = rowsDelete.map(row => row.appID);
            const secretkeysDelete = [];
            for (const row of rowsDelete) {
                const secretkeyDelete = getSerialNumberSync(serviceID, row.appID);
                secretkeysDelete.push(secretkeyDelete);
            }
            const accountsDelete = service.accounts.filter((account: TranslateServiceAccount) => appIDsDelete.includes(account.appID));
            if (!accountsDelete || !accountsDelete.length) return false;
            service.accountsDelete = accountsDelete;
            const accounts = service?.accounts?.filter((account: TranslateServiceAccount) => !appIDsDelete.includes(account.appID));
            service.accounts = accounts;


            //删除数据库数据
            //移到回收站？添加删除标志?
            for (const secretkeyDelete of secretkeysDelete) {
                deleteAcount(Number(secretkeyDelete));
            }

            tableTreeInstance.invalidate();
            return false;
        }

        if (tableTreeInstance.editIndex != void 0) {
            if (e.key == 'Enter' || e.key == 'Escape') {
                if (e.key != 'Escape') {
                    commitEditingRow();
                } else {
                    discardEditing();
                }
                return false;
            }
            /* if (e.key == ' ') {
                return false;
            } */
            return false;
        }


        if ((e.ctrlKey || e.metaKey) && e.key == "z") {
            showInfo("恢复");
            return false;
        }

        if ((e.ctrlKey || e.metaKey) && e.key == "v") {
            pasteAccount();
            return false;
        }


        /* if (e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)) {
            //@ts-ignore has
            const selectedElem = document.querySelector(`#${tableTreeInstance._jsWindowID} [aria-selected=true]`);
            if (!selectedElem) return;
            const boundingRect = selectedElem.getBoundingClientRect();
            tableTreeInstance.props.onItemContextMenu(
                e,
                window.screenX + boundingRect.left + 50,
                window.screenY + boundingRect.bottom
            );
            return;
        } */
        return true;
    }

    async function handleActivate(event: Event, indices: number[]) {
        //@ts-ignore has
        const editingRow = tableTreeInstance._jsWindow._renderedRows.get(indices[0]) as HTMLDivElement;
        const cellIndex = getcellIndex(event);
        if (cellIndex == void 0) return;

        //@ts-ignore has
        tableTreeInstance.OriginRow = { ...rows[indices[0]] };
        const cell = editingRow.children[cellIndex] as HTMLSpanElement;
        const inputCell = cellChangeToInput(cell);
        setTimeout(() => {
            inputCell.focus();
            inputCell.select();
        });


    }
    function stopEvent(e: Event) {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();//@ts-ignore has
        if (e.nativeEvent) {//@ts-ignore has
            e.nativeEvent.stopImmediatePropagation();
            e.stopPropagation();
        }
    };
    //todo
    function validateSecretKey(index: number) {
        const validateFunc = {
            appID: (value: any) => {
                if (typeof value != "string") throw "value not string";
                if (value.length != 17) throw "value length not equal 17";
                if (!value.match(/^\d+$/)) throw "value has none figure";
            }


        };
        //const validateFunc = sevices[serviceID].validateFunc;
        const row = rows[index];
        Object.keys(row).forEach((key) => {
            validateFunc[key as keyof typeof validateFunc](row[key]);
        });
    }

    function cellChangeToInput(cell: HTMLElement) {
        //const match = cell.parentElement?.id.match(/row-\d+$/);
        const inputCell = document.createElement('input');
        inputCell.placeholder = cell.textContent || "";
        inputCell.value = cell.textContent ? cell.textContent : "";
        //将行号作为class，作为编辑行的标志（blur时行号可能已经改变）
        const selectedRow = tableTreeInstance.selection.focused;
        inputCell.className = cell.classList[1];
        inputCell.classList.add(String(selectedRow));
        inputCell.dir = 'auto';
        const cellBackgroundColor = window.getComputedStyle(cell).getPropertyValue('backgroundColor');
        //const color = window.getComputedStyle(cell).getPropertyValue('color');
        const color = "#4072e5";
        const styleInput = {
            width: Math.round(cell.clientWidth / cell.parentElement!.clientWidth * 100) + '%',
            height: cell.clientHeight + 'px',
            fontSize: '1.3rem',
            borderLeft: `4px solid ${color}`,
            borderRight: `4px solid ${color}`,
            marginTop: 'auto',
            marginBottom: 'auto',
            left: cell.offsetLeft + 'px',
            backgroundColor: `${cellBackgroundColor}`,
            position: `absolute`,
            zIndex: "100",
        };
        Object.assign(inputCell.style, styleInput);
        cell.parentElement!.appendChild(inputCell);


        //const updateRowDebounce = Zotero.Utilities.debounce(valueToRows, 1000);
        inputCell.addEventListener('input', updateWidth);
        inputCell.addEventListener('input', valueToRows);
        inputCell.addEventListener('focus', upLevel);
        batchAddEventListener([inputCell, ['keydown', 'keyup', 'input', 'mousedown', 'mouseup', 'dblclick'], [stopEvent]]);

        function upLevel() {
            const cells = inputCell.parentElement?.querySelectorAll("input");
            if (!cells) return;
            const zIndexs = [];//
            for (const cell of Array.from(cells)) {
                Number(cell.style.zIndex || 0);
                zIndexs.push(Number(cell.style?.zIndex || 0));
            }
            const zIndex = Math.max(...zIndexs) + 100;
            inputCell.style.zIndex = `${zIndex}`;
        }
        //当选中的行发生变化，先更新表，所以 input 消失了，也未能触发 blur 事件 focusin focusou
        //inputCell.addEventListener('blur', blurUpdateRow);
        function valueToRows(e: Event) {
            const key = inputCell.classList[0];
            const index = Number(inputCell.classList[1]);
            if (!rows[index] || !rows[index][key]) return;//空数据也在rows内
            dataChanged(index, key, inputCell.value);
            if (!tableTreeInstance.editIndex) tableTreeInstance.editIndex = index;
            let ei = tableTreeInstance.editIndex;
            if (!tableTreeInstance.editIndices) tableTreeInstance.editIndices = [];
            const eis = tableTreeInstance.editIndices;
            if (index != ei) {
                eis.push(ei);
                ei = index;
            }
        }
        function blurUpdateRow(e: Event) {
            const value = (e.target as HTMLInputElement).value;
            if (value == cell.textContent) {
                inputCell.remove();
                return;
            }
            if (!tableTreeInstance.editIndex) tableTreeInstance.editIndex = Number((e.target as HTMLInputElement).classList[1]);
            valueToRows(e);
            //@ts-ignore has
            tableTreeInstance.invalidateRow(tableTreeInstance.editIndex);
            inputCell.remove();

        }
        const doResizeInput = resizeInput(inputCell);
        function updateWidth(e: Event) {
            doResizeInput(inputCell);
        }
        return inputCell;
    }

    function dataHistory(dataChangedCache: any) {
        if (!tableTreeInstance.dataHistory) tableTreeInstance.dataHistory = [];
        const dh = tableTreeInstance.dataHistory;
        dh.push(dataChangedCache);
    }
    /**
     * 更新表格数据，缓存单元格旧数据
     * @param index 
     * @param key 
     * @param value 
     */
    function dataChanged(index: number, key: string, value: any) {
        if (!tableTreeInstance.dataChangedCache) tableTreeInstance.dataChangedCache = {};
        const dc = tableTreeInstance.dataChangedCache;
        if (!dc[index]) dc[index] = {};
        if (!dc[index]["originRow"]) dc[index]["originRow"] = deepClone(rows[index]);
        if (!dc[index][key]) dc[index][key] = rows[index][key];
        //修改表格单元格数据
        rows[index][key] = value;
    }


    function resizeInput(inputCell: HTMLInputElement) {
        const cacheValue = { value: inputCell.value };
        return function dodo(inputCellCurrent: HTMLInputElement) {
            if (cacheValue.value.length > inputCellCurrent.value.length + 5) {
                while (inputCellCurrent.scrollWidth <= inputCellCurrent.clientWidth) {
                    const old = inputCellCurrent.clientWidth;
                    inputCellCurrent.style.width = inputCellCurrent.scrollWidth - 10 + "px";
                    if (old == inputCellCurrent.clientWidth) {
                        break;
                    }
                };
                cacheValue.value = inputCellCurrent.value;
            }
            if (inputCellCurrent.scrollWidth > inputCellCurrent.clientWidth) {
                inputCellCurrent.style.width = inputCellCurrent.scrollWidth + 50 + "px";
                cacheValue.value = inputCellCurrent.value;
            }
        };
    }


    function caculateInputWidth(inputCell: HTMLInputElement) {
        const topContainer = inputCell.ownerDocument.querySelector(`#zotero-prefpane-${config.addonRef}`);
        const spanContainer = inputCell.ownerDocument.createElement("div");
        const spanShowWidth = inputCell.ownerDocument.createElement("span");
        spanContainer.appendChild(spanShowWidth);
        topContainer?.appendChild(spanContainer);
        spanContainer.style.position = "fixed";
        spanContainer.style.top = "-1000px";//@ts-ignore has
        tableTreeInstance.spanShowWidth = spanShowWidth;
        return function () {
            spanShowWidth.textContent = inputCell.value;
            if (inputCell.scrollWidth < inputCell.clientWidth)
                inputCell.style.width = spanShowWidth.scrollWidth + "px";
        };
        //return width2;
    }



    function getRowElement(index?: number) {
        if (!index) index = tableTreeInstance.selection.focused;//@ts-ignore has
        return tableTreeInstance._jsWindow.getElementByIndex(index);
    }

    /*  async function editCell(e: Event, indices: number[]) {
         //处理前一个单元格的编辑状态
         if (tableTreeInstance.editIndex) commitEditingRow();
         if (!e.target) return true;
         const div = e.target as HTMLElement;
         const cellIndex = getcellIndex(e);
         if (cellIndex == void 0) return true;
         const cell = div.childNodes[cellIndex];
         const cellNext = div.childNodes[cellIndex + 1];
         if (!cell) return true;//@ts-ignore has
         const inputCell = cellChangeToInput(cell);
 
 
         //@ts-ignore has
         const width = cellNext ? cellNext.screenX - cell.screenX : cell.clientWidth;
         inputCell.style.width = width + "px";
         inputCell.addEventListener('blur', async (e) => {
             commitEditingRow();
             addon.data.prefs?.window.removeEventListener("click", blurEditingRow);
         });        //@ts-ignore has
 
         addon.data.prefs?.window.addEventListener("click", blurEditingRow);
         function blurEditingRow(e: Event) {
             if (e.target != div) {
                 div.blur();
                 addon.data.prefs?.window.removeEventListener("click", blurEditingRow);
             }
         }
         // Feels like a bit of a hack, but it gets the job done
         setTimeout(() => {
             inputCell.focus();
             inputCell.select();
         });
 
         if (tableTreeInstance.editingRow) {
             commitEditingRow();
         }
         tableTreeInstance.editingRow = {
             oldCells: [],
             currentCells: []
         };
 
         //tableTreeInstance.oldCell = cell;//@ts-ignore has
         tableTreeInstance.editingRow.oldCells.push(cell);
         //tableTreeInstance.inputCell = inputCell;//@ts-ignore has
         tableTreeInstance.editingRow.currentCells.push(inputCell);
         tableTreeInstance.editIndex = indices[0];
         div.replaceChild(inputCell, cell);
         //禁用默认操作
         return false;
 
     }
  */
    function getColumn(index: number) {
        //@ts-ignore has
        const columns = tableTreeInstance._getVisibleColumns();//@ts-ignore has
        return columns[index];
    }
    function discardEditing() {
        //是否需要恢复行数据？
        if (!tableTreeInstance.editingRow) return;
        const oldCells = tableTreeInstance.editingRow["oldCells"];
        if (!oldCells) return;
        const currentCells = tableTreeInstance.editingRow["currentCells"];
        if (!oldCells || !currentCells) return;
        for (let i = 0; i < currentCells.length; i++) {
            currentCells[i].parentNode?.replaceChild(oldCells[i], currentCells[i],);
        }
        clearEditing();

        tableTreeInstance.invalidate();


    }
    //单元格从编辑状态复原
    function commitEditing(newCell?: HTMLElement, oldCell?: HTMLElement) {
        //@ts-ignore has
        if (!oldCell) oldCell = tableTreeInstance.oldCell;//@ts-ignore has
        if (!oldCell) return;//@ts-ignore has
        const inputCell = newCell ? newCell : tableTreeInstance.inputCell;//@ts-ignore has
        if (!inputCell) return;
        const index = tableTreeInstance.editIndex;
        if (index == void 0) return;
        //@ts-ignore has
        const key: string = oldCell.classList[1];
        if (oldCell!.textContent == inputCell.value) {
            inputCell.parentNode?.replaceChild(oldCell, inputCell);
            return;

        }
        //存储旧数据，新数据从 rows 获取
        if (!tableTreeInstance.dataChangedCache) tableTreeInstance.dataChangedCache = {};
        //todo 删除行也要处理缓存的修改数据
        if (!tableTreeInstance.dataChangedCache[index]) tableTreeInstance.dataChangedCache[index] = {};
        tableTreeInstance.dataChangedCache[index][key] = rows[index][key];
        //修改表格单元格数据
        rows[index][key] = inputCell.value;
        /*         oldCell!.textContent = inputCell.value;
                inputCell.parentNode?.replaceChild(oldCell, inputCell); */
    };




    function clickTableOutsideCommit(e: MouseEvent) {
        if (!outside(e, tableTreeInstance._topDiv!)) return;
        saveAccounts();
    }


    /**
     * 坐标在矩形外
     * @param e 
     * @returns 
     */
    function outside(e: MouseEvent, element: HTMLElement) {
        const tableRect = element.getBoundingClientRect();
        const mouseX = e.x;
        const mouseY = e.y;
        return mouseX < tableRect.left ||
            mouseX > tableRect.right ||
            mouseY < tableRect.top ||
            mouseY > tableRect.bottom;
    }

    function getSelectedRow() {
        //@ts-ignore has
        return tableTreeInstance._topDiv.querySelectorAll(`#${tableTreeInstance._jsWindowID} [aria-selected=true]`)[0] as HTMLElement;
    }

    function commitEditingRow() {
        if (!tableTreeInstance.editingRow) return;
        const oldCells = tableTreeInstance.editingRow["oldCells"];
        const currentCells = tableTreeInstance.editingRow["currentCells"];
        if (!oldCells || !currentCells) return;
        const keys = Object.keys(rows[0]);
        const changeCellIndices = [];
        if (tableTreeInstance.editIndex != void 0) {
            const rowElement = getRowElement(tableTreeInstance.editIndex);
            if (rowElement.children[0].tagName == "span") {
                clearEditing();
                return;
            }


        }
        /* const selectedIndex = Array.from(tableTreeInstance.selection.selected)[0];
        if (selectedIndex != tableTreeInstance.editIndex){
     
        } */
        for (let i = 0; i < currentCells.length; i++) {
            if (oldCells[i].textContent != currentCells[i].value) {

                changeCellIndices.push(i);
            }
            if (currentCells[i].value.includes(EmptyValue) && [keys[0], keys[1]].includes(keys[i])) {
                showInfo(keys[0] + " or " + keys[1] + " cannot be the default EmptyValue");
                //@ts-ignore has

                return;
            }
        }
        if (!changeCellIndices.length) return;

        for (let i = 0; i < currentCells.length; i++) {
            if (currentCells[i].value.includes(EmptyValue)) {
                currentCells[i].value = DEFAULT_VALUE[keys[i] as keyof typeof DEFAULT_VALUE];
                if (!currentCells[i].value) return;
            }
            commitEditing(currentCells[i], oldCells[i]);
        }
        // stopRowEditing();
    }
    //@ts-ignore has
    tableTreeInstance.commitEditingRow = commitEditingRow;
    //更新翻译引擎账号，清除编辑标志，重新渲染表格
    function saveAccounts() {
        const dc = tableTreeInstance.dataChangedCache;
        if (!dc) return;
        const indices = Object.keys(dc);
        if (!dc || !indices?.length) {
            clearEditing();
            return;
        }
        const serviceAccountsSave = [];
        for (const index of indices) {
            if (index == void 0) return;
            const changedKeys = Object.keys(dc[index]);
            const rowData = rows[Number(index)];
            const serialNumber = getSerialNumberSync(serviceID, rowData.appID);
            //比较false==0的结果为true
            //if (typeof serialNumber != "boolean" && serialNumber != void 0) {
            if (serialNumber >= 0) {
                //更新账号
                const serviceAccount = getServiceAccountSync(serviceID, serialNumber);
                if (!serviceAccount) continue;
                changedKeys.filter((key) => {
                    if (rowData[key] != serviceAccount[key as keyof TranslateServiceAccount]) {
                        if (!serviceAccount.changedData) serviceAccount.changedData = {};
                        serviceAccount.changedData[key] = rowData[key];
                        if (!serviceAccount.previousData) serviceAccount.previousData = {};
                        serviceAccount.previousData[key] = serviceAccount[key as keyof TranslateServiceAccount];
                        //@ts-ignore has 修改 services   
                        serviceAccount[key] = rowData[key];
                    }
                });
                //serviceAccount.save()
                serviceAccountsSave.push(serviceAccount);
            } else {
                try {
                    serviceAccountsSave.push(saveNewAccount(rowData));

                } catch (e) {
                    notifyAccountSave(serviceAccountsSave);
                    clearEditing();
                    tableTreeInstance.invalidate();
                    throw e;
                }

            }
        }
        notifyAccountSave(serviceAccountsSave);
        clearEditing();
        tableTreeInstance.invalidate();
    }
    function saveNewAccount(rowData: any) {
        const serialNumber = getNextServiceSNSync();
        const accuntOptions: any = {};
        accuntOptions.serviceID = serviceID;
        accuntOptions.serialNumber = serialNumber;//
        Zotero.Utilities.Internal.assignProps(accuntOptions, rowData);
        accuntOptions.forbidden = false;
        const account = new TranslateServiceAccount(accuntOptions);
        const service = addon.mountPoint.services[serviceID];
        if (!service) {
            throw new Error("service not found: " + service);
        }
        if (!service.accounts) service.accounts = [];
        service.accounts.push(account);
        return account;
    }
    function saveNewAccounts(rows: any[]) {
        const serviceAccountsSave = [];
        for (const rowData of rows) {
            try {
                serviceAccountsSave.push(saveNewAccount(rowData));

            } catch (e) {
                notifyAccountSave(serviceAccountsSave);
                clearEditing();
                tableTreeInstance.invalidate();
                throw e;
            }
        }
        notifyAccountSave(serviceAccountsSave);
        clearEditing();
        tableTreeInstance.invalidate();
    }

    function notifyAccountSave(obj: any | any[]) {
        if (!Array.isArray(obj)) obj = [obj];//
        Zotero.Notifier.trigger('add', 'item', [999999999999], { data: obj }, true);
        //event, type, ids, extraData, force
        /**
    * Trigger a notification to the appropriate observers
    *
    * Possible values:
    *
    * 	event: 'add', 'modify', 'delete', 'move' ('c', for changing parent),
    *		'remove' (ci, it), 'refresh', 'redraw', 'trash', 'unreadCountUpdated', 'index'
    * 	type - 'collection', 'search', 'item', 'collection-item', 'item-tag', 'tag',
    *		'group', 'relation', 'feed', 'feedItem'
    * 	ids - single id or array of ids
    *
    * Notes:
    *
    * - If event queuing is on, events will not fire until commit() is called
    * unless _force_ is true.
    *
    * - New events and types should be added to the order arrays in commit()
    **/

        //var _types = [		'collection', 'search', 'share', 'share-items', 'item', 'file',		'collection-item', 'item-tag', 'tag', 'setting', 'group', 'trash',		'bucket', 'relation', 'feed', 'feedItem', 'sync', 'api-key', 'tab',		'itemtree'	]


        /* 
        
        Zotero.Notifier.trigger('add', 'tab', [id], { [id]: data }, true);
    ('close', 'tab', [closedIDs], true);
    ('select', 'tab', [tab.id], { [tab.id]: { type: tab.type } }, true);
    ('open', 'file', item.id);
    ('redraw', 'item', []);
    ('open', 'file', attachment.id);
    () on an undo or redo
    (eventParts[0], eventParts[1], data['id']);
    ('delete', 'collection', 'document');
    ('add', 'collection', 'document');
    ('modify', 'item', [item.id]);
    ('refresh', 'item', [itemID]);
    ('refresh', 'item', itemIDs);
    ('redraw', 'item', item.id, { column: "hasAttachment" });
    ('redraw', 'item', parentItem.id, { column: "hasAttachment" });
    (event, 'setting', [id], extraData);
    ('delete', 'setting', [id], extraData);
    ('statusChanged', 'feed', this.id);
    ('unreadCountUpdated', 'feed', this.id);
    ('modify', 'item', ids, {});
    ('refresh', 'item', this.id);
    ('removeDuplicatesMaster', 'item', item.id, null, true);
    ('refresh', 'trash', libraryID);
    ('refresh', 'item', idsToRefresh);
    ('redraw', 'item', affectedItems, { column: 'title' });
    ('download', 'file', item.id);
    ('delete', 'api-key', []);
    ('modify', 'api-key', []);
    ('start', 'sync', []);
    ('finish', 'sync', librariesToSync || []);
    ('redraw', 'collection', []);
        
        */

    }


    function pasteAccount() {
        window.navigator.clipboard
            .readText()
            .then((v) => {
                const text: string = v;
                batchAddAccount(text);
                tableHelper.render();
            })
            .catch((v) => {
                ztoolkit.log("Failed To Read Clipboard: ", v);
            });
    }

    function batchAddAccount(text: string) {
        const textArr = text.split(/\r?\n/).filter(e => e);
        const valuesArr = textArr.map((str: string) => str.split(/[# \t,;@，；]+/).filter(e => e));
        const keys = Object.keys(rows[0]);
        const pasteRows = valuesArr.map((values: string[]) => {
            const row: any = kvArrsToObject(keys)(values);
            Object.keys(row).filter((key: string, i: number) => {
                if ((row[key] as string).includes(EmptyValue)) {
                    row[key] = DEFAULT_VALUE[key as keyof typeof DEFAULT_VALUE];
                }
            });
            return row;
        });
        const newRows = pasteRows.filter((pasteRow: any) => !(rows.find((row: any) => !differObject(pasteRow, row))));
        if (newRows && pasteRows && newRows.length != pasteRows.length) {
            ztoolkit.log(pasteRows.length - newRows.length + ' ' + getString("info-filtered"));
        }
        rows.push(...newRows);
        saveNewAccounts(newRows);


    }

    function clearEditing() {
        ['dataChangedCache', 'editIndex', 'editingRow', 'editIndices', 'editingRow'].forEach((key) => {
            (tableTreeInstance as any)[key] = void 0;
        });
    }

    function getSelectedTranlateServiceItems() {
        const selectedIndices = Array.from(tableTreeInstance.selection.selected);
        //selectedIndexs.filter((i: number) => rows.splice(i, 1));//删除多个元素由于下标变化而出错
        return rows.filter((v: any, i: number) => selectedIndices.includes(i));
    }

    function getColumnWidth(index: number) {
        const COLUMN_PADDING = 16;
        //@ts-ignore has
        const columns = tableTreeInstance._getVisibleColumns();
        const proportion = columns[index].width / columns.map((c: any) => c.width).reduce((sum: number, number: number) => sum + number, 0);

        //@ts-ignore has
        const tableWidth = tableTreeInstance._topDiv.getBoundingClientRect().width;
        return Math.round(proportion * tableWidth * window.devicePixelRatio);
    }


    // const saveDebounce = Zotero.Utilities.debounce(saveTx, 10000);

    function getcellIndex(e: Event) {
        //@ts-ignore has
        //如果代码触发双击，则返回 0
        let x = e.x;
        if (!x) {
            return 0;
            const clickEvent = new window.MouseEvent('click', {
                bubbles: true,
                cancelable: true,
            });
            e.target!.dispatchEvent(clickEvent);
            x = clickEvent.x;
        };
        if (!e.target) return 0;
        const parent = e.target as HTMLElement;
        function left(el: HTMLElement) { return el.getBoundingClientRect().x; }
        function right(el: HTMLElement) { return el.getBoundingClientRect().x + el.getBoundingClientRect().width; }
        for (let i = 0; i < parent.childNodes.length; i++) {
            //@ts-ignore has
            if (e.x >= left(parent.childNodes[i]) && e.x <= right(parent.childNodes[i])) {
                return i;
            }
        }
    }



    function makeColumnPropValues(row: any) {
        // 本地化 ftl 文件中条目的前缀
        const prefTableStringPrefix = "prefs-table-";

        const temp = Object.keys(row).map((key: string, i: number) => {
            //let type = '';
            // getString 未找到相应本地化字符串时，返回`${config.addonRef}-${localeString}`
            let label = getString(`${prefTableStringPrefix}${key}`);
            if (!label || label.startsWith(config.addonRef)) {
                label = key;
            }
            const result: any[] = [key, label];
            result.push(false, false);
            if (i == 1) {
                result.push(2);
            } else {
                result.push(1);
            }
            /* if (key == "usable") {
                type = 'checkbox';
            }
            result.push(type); */
            return result;
        });
        return temp;
    };




    /**
     * Auto fill with " key + ': '+ EmptyValue " when no values
     * @param keys 
     * @returns 
     */
    function kvArrsToObject(keys: string[]) {
        return function (values?: any | any[]) {
            if (!values) values = [];
            if (!Array.isArray(values)) values = [values];
            return arrToObj(keys, keys.map((k, i) => values[i] !== void 0 ? String(values[i]) : k + ': ' + EmptyValue));
        };
    }
    function resizeColumnWidth(columIndexOrKey: number | string, extendValue?: number) {
        const onResizeData: any = {};
        let column;
        if (typeof columIndexOrKey === 'number') {
            column = getColumn(columIndexOrKey);
        }
        if (typeof columIndexOrKey === "string") {            //@ts-ignore has
            const temps = tableTreeInstance._getColumns().filter((e: any) => e.dataKey == columIndexOrKey);
            if (temps.length == 0) return;
            column = temps[0];
        }
        if (!column) return;
        onResizeData[column.dataKey] = column.width + extendValue;//@ts-ignore has
        tableTreeInstance._columns.onResize(onResizeData);
    }
    function resize() {
        //@ts-ignore has
        const columns = tableTreeInstance._getVisibleColumns();//@ts-ignore has
        //@ts-ignore has
        tableTreeInstance._columns.onResize(Object.fromEntries(columns.map(c => [c.dataKey, c.width])));

        // const styleIndex = tableTreeInstance._columns._columnStyleMap[dataKey]
        //@ts-ignore has
        // tableTreeInstance._columns._stylesheet.sheet.cssRules[styleIndex].style.setProperty('flex-basis', `200px`);
    }




}



export function getTableByID(tableID?: string) {
    if (!addon.mountPoint.tables) return;
    const tables = addon.mountPoint.tables;
    if (!tableID) return tables;
    return tables[tableID];
}

function makeTableProps(options: VTableProps, rows: any[]) {
    const defaultVtableProps: VTableProps = {
        getRowCount: () => rows.length,
        getRowData: (index: number) => rows[index],
        showHeader: true,
        multiSelect: true,
        getRowString: ((index: number) => rows[index].key || ""),
    };
    //清理options
    const columnPropAvilableKeys = [
        "id",
        "getRowCount",
        "getRowData",
        "renderItem",
        "linesPerRow",
        "disableFontSizeScaling",
        "alternatingRowColors",
        "label",
        "role",
        "showHeader",
        "columns",
        "onColumnPickerMenu",
        "onColumnSort",
        "getColumnPrefs",
        "storeColumnPrefs",
        "getDefaultColumnOrder",
        "staticColumns",
        "containerWidth",
        "treeboxRef",
        "hide",
        "multiSelect",
        "onSelectionChange",
        "isSelectable",
        "getParentIndex",
        "isContainer",
        "isContainerEmpty",
        "isContainerOpen",
        "toggleOpenState",
        "getRowString",
        "onKeyDown",
        "onKeyUp",
        "onDragOver",
        "onDrop",
        "onActivate",
        "onActivate",
        "onFocus",
        "onItemContextMenu",];
    const optionsKeys = Object.keys(options);
    optionsKeys.filter((key: string) => {
        if (!columnPropAvilableKeys.includes(key)) {
            delete options[key as keyof VTableProps];
        }
    });

    return Object.assign(defaultVtableProps, options);
}



/**
 * 有无效数据则返回false
 * @param row 
 * @returns 
 */
function validateRowData(row: any) {
    const keys = Object.keys(row);
    //数据无效时返回key值
    const res = keys.find((key) => {
        const fn = validata[key as keyof typeof validata];
        if (typeof fn != "function") return true;
        return !fn(row[key]);
    });
    if (res) {
        showInfo(res + " invalid value: " + row[res]);
    }
    //有无效数据则返回false
    return !!res;
}










// ("beforeunload");

async function deleteRecord(e: Event) { }

async function editRecord(e: Event) { }

async function searchRecord(e: Event) { }
