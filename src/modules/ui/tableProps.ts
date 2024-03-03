import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { arrToObj, arrsToObjs, batchAddEventListener, chooseFile, chooseFilePath, differObject, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import { TranslateService, TranslateServiceAccount } from "../translate/translateService";
import { getDom, getElementValue } from "./uiTools";
import { getDBSync } from "../database/database";
import { deleteAcount, getSerialNumberSync, getServiceAccount, getServiceAccountSync, getServices, getServicesFromDB, getTranslateService, validata } from "../translate/translateServices";
import { DEFAULT_VALUE, EmptyValue, addonDir } from '../../utils/constant';


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

    /*暂时做不到复用表格   
     if (addon.mountPoint.tables) {
           if (!addon.mountPoint.tables[id]) {
               () => { };
           } else {
               const doc = addon.data.prefs?.window?.document;
               const vtable = doc.querySelector(`#${containerId}`);
               if (vtable?.children.length) {
                   showInfo("表格已渲染");
               } else {
                   const htable = addon.mountPoint.tables[id];
                   htable.render(-1);
                   showInfo("表格已渲染");
                   return;
               }
           }
       }
    */

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
        win: addon.data.prefs!.window,
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

    async function deleteRecord(e: Event) { }

    async function editRecord(e: Event) { }

    async function searchRecord(e: Event) { }

    async function addRecordBulk(e: Event) {
        const filePath = await chooseFilePath();
        const extension = Zotero.File.getExtension(filePath);
        let text = '';
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
        if (!e.dataTransfer) return false;
        const dragData = Zotero.DragDrop.getDataFromDataTransfer(e.dataTransfer);
        if (!dragData) {
            Zotero.debug("No drag data");
            return false;
        }
        const data = dragData.data;
        let text: string = '';
        const allPromise = [];
        for (let i = 0; i < data.length; i++) {
            const file = data[i];
            const extension = Zotero.File.getExtension(file);
            const result = Zotero.File.getContentsAsync(file);
            if (typeof result == "string") {
                text += result;
            } else if (!(result instanceof Uint8Array)) {
                const readerLock = Zotero.Promise.defer();
                allPromise.push(readerLock);
                result.then(str => {
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




    // addon.data.prefs.window.addEventListener("blur");
    // ("beforeunload");

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
        if (tableTreeInstance.editIndex != void 0) {
            //tableTreeInstance.editingRow.currentCells.push({[cell.classList[1]]: cell.textContent});
            //@ts-ignore has
            const editingRow = tableTreeInstance._jsWindow._renderedRows.get(tableTreeInstance.editIndex);
            for (const cell of editingRow.children) {
                rows[tableTreeInstance.editIndex!][cell.classList[1]] = cell.textContent;
                //{[cell.classList[1]]: cell.textContent}
            }
            tableTreeInstance.invalidate();
            showInfo("当前行发生变化");
            //commitEditingRow();
            return true;
        }
        resizeColumnWidth(0, 200);
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
            if (Zotero.isWin) {
                x += 10;
            }
            const anchor = e.target;
            //contextMenu.menupopup.openPopup(anchor, x, y);
            contextMenu.menupopup.openPopup(anchor, 'after_pointer', 0, 0, true, false, e);
            contextMenu.menupopup.moveTo(x, y);
        };

        function testContextMenu(...args: any[]) {
            const menuPopupEvent = args.pop();
            const target = args.pop();

            const eventType = menuPopupEvent.type;

            const id = target.id;
            showInfo(["表格行右键菜单:" + id, `事件类型：${eventType}`],
                {
                    window: addon.data.prefs?.window,

                });
            const arg1 = args[0];
            const arg2 = args[1];
            showInfo("原始参数：" + arg1 + "<br><br>" + arg2);
        }



    }


    function handleKeyDown(e: KeyboardEvent) {
        // When pressing delete, delete selected line and refresh table.
        // Returning false to prevent default event.
        //return返回的值决定是否继续执行 virtualized-table.jsx 默认的按键功能
        //获取键码        //获取字符编码
        //getCharCode(e);



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
        if (e.key == "Delete" || e.key == "Backspace" || (Zotero.isMac && e.key == "Backspace")) {
            //获取要删除的单行数据，获得秘钥，和services中的秘钥比较,然后删除秘钥
            const rowsDataDelete = rows.filter(
                //@ts-ignore has
                (v: any, i: number) => tableTreeInstance.selection.isSelected(i)
            );
            //确认删除，点击cancel则取消
            const confirm = addon.data.prefs!.window.confirm(getString("info-delete-secretKey") + '\n'
                + getString("info-delete-confirm"));
            if (!confirm) return true;

            //过滤掉选中行的数据，保留未选中的数据为数组，赋值给rows
            //@ts-ignore has
            const selectedIndices = Array.from(tableTreeInstance.selection.selected);
            const rowsDelete = rows.filter((v: any, i: number) => selectedIndices.includes(i)) || [];

            //selectedIndexs.filter((i: number) => rows.splice(i, 1));//删除多个元素由于下标变化而出错
            //rows,tableTreeInstance.rows指向原数组，给rows重新赋值，则rows指向新数组，导致数据不一致
            //操作数组元素不改变指向
            const rowsBackup = [...rows];
            selectedIndices.sort((a, b) => a - b);
            selectedIndices.filter((indexValue: number, subIndex: number) => {
                const deleteIndex = indexValue - subIndex;
                rows.splice(deleteIndex, 1);
            });

            //rows = rows.filter((v: any, i: number) => !selectedIndices.includes(i)) || [];
            tableHelper.render();

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
        const editingRow = tableTreeInstance._jsWindow._renderedRows.get(indices[0]);
        const cellIndex = getcellIndex(event);
        /* if (tableTreeInstance.editIndex != void 0) {
            showInfo("提交之前的编辑数据");
            //commitEditingRow();
        } */
        //@ts-ignore has
        tableTreeInstance.OriginRow = { ...rows[indices[0]] };
        const cell = editingRow.children[cellIndex];
        const inputCell = cellChangeToInput(cell);
        setTimeout(() => {
            inputCell.focus();
            inputCell.select();
        });
        tableTreeInstance.editIndex = indices[0];
        //editingRow.addEventListener("mousedown", handleKeyDown);





        //listentRow();
    }
    function stopEvent(e: Event) {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();//@ts-ignore has
        if (e.nativeEvent) {//@ts-ignore has
            e.nativeEvent.stopImmediatePropagation();
            e.stopPropagation();
        }
    };

    function cellChangeToInput(cell: HTMLElement) {
        //const match = cell.parentElement?.id.match(/row-\d+$/);
        const inputCell = document.createElement('input');
        inputCell.placeholder = cell.textContent || "";
        inputCell.value = cell.textContent ? cell.textContent : "";
        //将行号作为class，作为编辑行的标志（blur时行号可能已经改变）
        const selectedRow = Array.from(tableTreeInstance.selection.selected)[0];
        inputCell.className = cell.classList[1];
        inputCell.classList.add(String(selectedRow));
        /*   if (match) {
              inputCell.classList.add(match[0]);
          } */
        inputCell.dir = 'auto';
        const cellBackgroundColor = window.getComputedStyle(cell).getPropertyValue('backgroundColor');
        //cell.textContent = '';
        const styleInput = {
            width: cell.clientWidth + 'px',
            height: cell.clientHeight + 'px',
            fontSize: '1.2rem',
            border: '1px',
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
        //inputCell.addEventListener('input', updateRowDebounce);
        batchAddEventListener([inputCell, ['keydown', 'input', 'mousedown', 'mouseup', 'dblclick'], [stopEvent]]);
        inputCell.addEventListener('blur', blurUpdateRow);


        function valueToRows(e: Event) {
            const currentCell = e.target as HTMLInputElement;
            if (!currentCell || !currentCell.value) return;
            const key = currentCell.classList[0];
            if (currentCell.classList[1] == void 0) return;
            const index = Number(currentCell.classList[1]);
            if (!rows[index] || !rows[index][key]) return;
            dataChanged(index, key, currentCell.value);
            //rows[index][key] = currentCell.value;   
            if (!tableTreeInstance.editIndex) tableTreeInstance.editIndex = index;
        }
        function blurUpdateRow(e: Event) {
            const value = (e.target as HTMLInputElement).value;
            if (value == cell.textContent) return;
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


    function dataChanged(index: number, key: string, value: any) {
        if (!tableTreeInstance.dataChangedCache) tableTreeInstance.dataChangedCache = {};
        //todo 删除行也要处理缓存的修改数据
        if (!tableTreeInstance.dataChangedCache[index]) tableTreeInstance.dataChangedCache[index] = {};
        const rowDataCache = tableTreeInstance.dataChangedCache[index];
        rowDataCache[key] = rows[index][key];
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
        if (!index) index = Array.from(tableTreeInstance.selection.selected)[0];//@ts-ignore has
        return tableTreeInstance._topDiv.querySelectorAll(`#${tableTreeInstance._jsWindowID} [aria-selected=true]`);

    }

    async function editCell(e: Event, indices: number[]) {
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
        tableTreeInstance.dataChangedCache = null;
        tableTreeInstance.editIndex = null;
        tableTreeInstance.editingRow = null;

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



    function listentRow() {
        const index = tableTreeInstance.editIndex;
        const win = addon.data.prefs?.window;
        if (index == void 0) return;
        const rowElement = getRowElement(index)[0];
        function commit(e: Event) {
            if (e.target != rowElement.parentElement) {
                // showInfo("请保存数据");
                //commitEditingRow();
                if (win) {
                    win.removeEventListener("click", commit);
                    win.removeEventListener("click", stopEvent);
                }
            }
        }

        if (win) {
            win.addEventListener("click", commit);
            win.addEventListener("click", stopEvent);
        }
    }
    function commitEditingRow() {
        if (!tableTreeInstance.editingRow) return;
        const oldCells = tableTreeInstance.editingRow["oldCells"];
        const currentCells = tableTreeInstance.editingRow["currentCells"];
        if (!oldCells || !currentCells) return;
        const keys = Object.keys(rows[0]);
        const changeCellIndices = [];
        if (tableTreeInstance.editIndex != void 0) {
            const rowElement = getRowElement(tableTreeInstance.editIndex)[0];
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


        stopRowEditing();
    }
    //@ts-ignore has
    tableTreeInstance.commitEditingRow = commitEditingRow;
    //更新翻译引擎账号，清除编辑标志，重新渲染表格
    function stopRowEditing() {
        const dataChangedCache = tableTreeInstance.dataChangedCache;
        if (!dataChangedCache) {
            clearEditing();
            return;
        }
        const indices = Object.keys(dataChangedCache);
        for (const index of indices) {
            if (index == void 0) return;
            const changedKeys = Object.keys(dataChangedCache[index]);
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
                notifyAccountSave(serviceAccount);
            } else {
                //新建账号
                const DB = getDBSync();
                DB.getNextID("translateServiceSN", "serialNumber")
                    .then(async (serialNumber) => {
                        const accuntOptions: any = {};
                        accuntOptions.serviceID = serviceID;
                        accuntOptions.serialNumber = serialNumber;
                        Zotero.Utilities.Internal.assignProps(accuntOptions, rowData);
                        accuntOptions.forbidden = false;
                        const account = new TranslateServiceAccount(accuntOptions);
                        //await account.save();
                        const service = await getTranslateService(serviceID);
                        if (!service) throw new Error("service not found");
                        if (!service.accounts) service.accounts = [];
                        service.accounts.push(account);
                        notifyAccountSave(account);
                    });
            }
        }
        clearEditing();
        tableTreeInstance.invalidate();
    }

    function notifyAccountSave(obj: any) {
        Zotero.Notifier.trigger('add', 'item', [999999999999], obj, true);
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
                /* const textArr = text.split(/\r?\n/).filter(e => e);
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
                rows.push(...newRows); */
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


    }

    function clearEditing() {
        tableTreeInstance.dataChangedCache = null;
        tableTreeInstance.editIndex = null;
        tableTreeInstance.editingRow = null;
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
    function resizeColumnWidth(columIndexOrKey: number | string, extendValue: number) {
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








