import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { arrToObj, arrsToObjs, batchAddEventListener, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import { TranslateService, TranslateServiceAccount } from "../translate/translateService";
import { getElementValue } from "./uiTools";
import { getDB } from "../database/database";
import { deleteAcount, getSerialNumberSync, getServiceAccount, getServices, getTranslateService, validata } from "../translate/translateServices";


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
    //delete addon.mountPoint.tables[tableID];
    return tableHelper;

}

export async function replaceSecretKeysTable() {
    if (addon.data.prefs?.window == undefined) return;
    const id = `${config.addonRef}-` + "secretKeysTable";



    const serviceID = getElementValue("serviceID");
    const columnPropKeys = ["dataKey", "label", "staticWidth", "fixedWidth", "flex"];
    //数据 rows 表格创建后挂载至 tableTreeInstance 表格实例上
    let rows: any[] = await secretKeysTableRowsData(serviceID) || [];
    if (!rows || rows.length == 0) return;

    const containerId = `${config.addonRef}-table-container`;

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
        getRowString: ((index: number) => rows[index].key || ""),
        onKeyDown: handleKeyDown,
        onSelectionChange: handleSelectionChange,
        //@ts-ignore has
        onActivate: handleActivate,
        onItemContextMenu: handleItemContextMenu,
    };

    const options: TableFactoryOptions = {
        win: addon.data.prefs!.window,
        containerId: containerId,
        props: props,
    };

    const tableHelper = await tableFactory(options);
    const tableTreeInstance = tableHelper.treeInstance as VTable;
    tableTreeInstance.rows = rows;


    // addon.data.prefs.window.addEventListener("blur");
    // ("beforeunload");






    function handleSelectionChange(selection: TreeSelection, shouldDebounce: boolean) {
        if (tableTreeInstance.editIndex) {
            commitEditingRow();
            stopRowEditing();
        }
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
        async function onCollectionsContextMenuOpen(event: Event, x: number, y: number) {
            const contextMenu = buildContextMenu();
            //@ts-ignore has
            x = x || event.screenX; //@ts-ignore has
            y = y || event.screenY;
            // TEMP: Quick fix for https://forums.zotero.org/discussion/105103/
            if (Zotero.isWin) {
                x += 10;
            }
            const anchor = event.target;
            //contextMenu.menupopup.openPopup(anchor, x, y);
            contextMenu.menupopup.openPopup(anchor, 'after_pointer', 0, 0, true, false, event);
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
                stopRowEditing();
            }
            if (e.key == ' ') {
                return false;
            }
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
            rows = rows.filter((v: any, i: number) => !selectedIndices.includes(i)) || [];
            tableHelper.render();

            //从services中删除
            const service = addon.mountPoint.services[serviceID];

            const appIDsDelete = rowsDelete.map(row => row.appID);
            const accountsDelete = service.accounts.filter((account: TranslateServiceAccount) => appIDsDelete.includes(account.appID));
            if (!accountsDelete || !accountsDelete.length) return false;

            service.accountsDelete = accountsDelete;

            const accounts = service?.accounts?.filter((account: TranslateServiceAccount) => !appIDsDelete.includes(account.appID));
            service.accounts = accounts;


            //删除数据库数据
            //移到回收站？添加删除标志?
            for (const row of rowsDelete) {
                const sn = getSerialNumberSync(serviceID, row.appID);
                deleteAcount(Number(sn));
            }

            tableTreeInstance.invalidate();
            return false;
        }
        if ((e.ctrlKey || e.metaKey) && e.key == "z") {
            showInfo("恢复");
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
        let cellIndex = getcellIndex(event);
        const rowElement = getRowElement(indices[0])[0];
        if (tableTreeInstance.editingRow) {
            commitEditingRow();
            await stopRowEditing();
        }
        tableTreeInstance.editingRow = {
            oldCells: [],
            currentCells: []
        };

        for (const cell of rowElement.children) {
            const input = cellChangeToInput(cell);
            tableTreeInstance.editingRow.oldCells.push(cell);
            tableTreeInstance.editingRow.currentCells.push(input);
        }
        setTimeout(() => {
            if (cellIndex == void 0) {
                cellIndex = 0;
            }
            rowElement.children[cellIndex].focus();
            rowElement.children[cellIndex].select();
        });
        tableTreeInstance.editIndex = indices[0];
        rowElement.addEventListener('blur', async (e: Event) => {
            commitEditingRow();
            await stopRowEditing();
            //编辑中的行失焦后移除选项窗口的 click 事件和当前行 click 事件（阻止事件传递）
            //@ts-ignore has
            event.view?.removeEventListener("click", blurEditingRow);
            rowElement.removeEventListener("click", stopEvent);
        });
        // 单击当前编辑的行阻止事件传递，防止触发prefs窗口单击触发当前编辑行失焦
        // 表格行鼠标事件定义在行元素上
        //chrome\content\zotero\components\virtualized-table.jsx
        //node.addEventListener('mouseup', e => this._handleMouseUp(e, index), { passive: true });
        rowElement.addEventListener('click', stopEvent);
        //单击表格以外触发编辑中的行失焦,失败，改为提交修改
        async function blurEditingRow(e: Event) {
            if (e.target != rowElement) {
                commitEditingRow();
                await stopRowEditing();//@ts-ignore has
                event.view.removeEventListener("click", blurEditingRow);
            }
            //rowElement.blur();
        }        //@ts-ignore has
        event.view.addEventListener("click", blurEditingRow);
        //event.view?.addEventListener("click", saveDebounce);

        //@ts-ignore has
        /* event.view?.addEventListener("blur",
            function (e: Event) {                //@ts-ignore has
                showInfo("失焦：" + event.view.location.href);
                e.stopImmediatePropagation();
            },
            { once: true }); */
        //const isFocus = window.document.hasFocus();//@ts-ignore has
        //const win = rowElement.ownerGlobal;
        //const doc = rowElement.ownerDocument;
        //const isFocuswin = win.document.hasFocus();//@ts-ignore has
    }

    function cellChangeToInput(cell: HTMLElement | ChildNode) {
        const inputCell = document.createElement('input');
        inputCell.placeholder = cell.textContent || "";
        inputCell.value = cell.textContent ? cell.textContent : "";
        inputCell.className = 'cell-text';
        inputCell.dir = 'auto';
        batchAddEventListener([inputCell, ['input', 'mousedown', 'mouseup', 'dblclick'], [stopEvent]]);
        if (cell.parentElement) cell.parentElement.replaceChild(inputCell, cell);
        return inputCell;
    }
    function stopEvent(e: Event) { e.stopImmediatePropagation(); };

    function getRowElement(index?: number) {
        if (!index) index = Array.from(tableTreeInstance.selection.selected)[0];//@ts-ignore has
        return tableTreeInstance._topDiv.querySelectorAll(`#${tableTreeInstance._jsWindowID} [aria-selected=true]`);

    }

    async function editCell(event: Event, indices: number[]) {
        //处理前一个单元格的编辑状态
        if (tableTreeInstance.editIndex) commitEditingRow();
        if (!event.target) return true;
        const div = event.target as HTMLElement;
        const cellIndex = getcellIndex(event);
        if (cellIndex == void 0) return true;
        const cell = div.childNodes[cellIndex];
        const cellNext = div.childNodes[cellIndex + 1];
        if (!cell) return true;

        const inputCell = cellChangeToInput(cell);


        //@ts-ignore has
        const width = cellNext ? cellNext.screenX - cell.screenX : cell.clientWidth;
        inputCell.style.width = width + "px";
        inputCell.addEventListener('blur', async (e) => {
            const isFocus = window.document.hasFocus();//@ts-ignore has
            const win = div.ownerGlobal;
            const doc = div.ownerDocument;
            const isFocuswin = win.document.hasFocus();//@ts-ignore has
            commitEditing();
            await stopRowEditing();           //@ts-ignore has
            event.view?.removeEventListener("click", blurEditingRow);
        });        //@ts-ignore has
        event.view?.addEventListener("blur", function (e) {
            //@ts-ignore has
            showInfo("失焦：" + event.view.location.href);
            e.stopImmediatePropagation();
        },
            { once: true });
        window.addEventListener("blur", function () {
            showInfo("失焦：" + window.location.href);
        },
            { once: true });
        function blurEditingRow(e: Event) {
            if (e.target != div) {
                div.blur();
                //@ts-ignore has
                event.view?.removeEventListener("click", blurEditingRow);
            }
        }
        //@ts-ignore has
        event.view?.addEventListener("click", blurEditingRow);
        // Feels like a bit of a hack, but it gets the job done
        setTimeout(() => {
            inputCell.focus();
            inputCell.select();

        });


        if (tableTreeInstance.editingRow) {
            commitEditingRow();
            await stopRowEditing();
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

    function commitEditingRow() {
        if (!tableTreeInstance.editingRow) return;
        const oldCells = tableTreeInstance.editingRow["oldCells"];
        const currentCells = tableTreeInstance.editingRow["currentCells"];
        if (!oldCells || !currentCells) return;
        for (let i = 0; i < currentCells.length; i++) {
            commitEditing(currentCells[i], oldCells[i]);
        }
    }
    function discardEditing() {
        //是否需要恢复行数据？
        const oldCells = tableTreeInstance.editingRow["oldCells"];
        const currentCells = tableTreeInstance.editingRow["currentCells"];
        if (!oldCells || !currentCells) return;
        for (let i = 0; i < currentCells.length; i++) {
            currentCells[i].parentNode?.replaceChild(oldCells[i], currentCells[i],);
        }
        tableTreeInstance.dataChangedCache = null;
        tableTreeInstance.editIndex = null;
        if (tableTreeInstance.editingRow) {
            tableTreeInstance.editingRow = null;
        }
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
            //默认空值不会保存
            inputCell.parentNode?.replaceChild(oldCell, inputCell);
            return;
        }
        if (!tableTreeInstance.dataChangedCache) tableTreeInstance.dataChangedCache = {};
        //todo 删除行也要处理缓存的修改数据
        if (!tableTreeInstance.dataChangedCache[index]) tableTreeInstance.dataChangedCache[index] = {};
        const rowDataCache = tableTreeInstance.dataChangedCache[index];
        rowDataCache[key] = rows[index][key];
        //修改表格单元格数据
        rows[index][key] = inputCell.value;
        oldCell!.textContent = inputCell.value;
        inputCell.parentNode?.replaceChild(oldCell, inputCell);
    };




    //@ts-ignore has
    tableTreeInstance.commitEditing = commitEditing;
    //更新翻译引擎账号，清除编辑标志，重新渲染表格
    async function stopRowEditing() {
        //注意0
        if (tableTreeInstance.editIndex == void 0) {
            tableTreeInstance.dataChangedCache = null;
            tableTreeInstance.editingRow = null;
            return;
        }
        const dataChangedCache = tableTreeInstance.dataChangedCache;
        tableTreeInstance.editIndex = null;
        if (!dataChangedCache) {
            tableTreeInstance.dataChangedCache = null;
            tableTreeInstance.editingRow = null;
            return;
        }
        for (const index of Object.keys(dataChangedCache)) {
            if (index == void 0) return;
            const changedKeys = Object.keys(dataChangedCache[index]);
            const rowData = rows[Number(index)];
            let serialNumber = await getSerialNumber(serviceID, rows[Number(index)]);
            //false==0结果为true
            if (typeof serialNumber != "boolean") {
                //更新账号
                const serviceAccount = await getServiceAccount(serviceID, serialNumber);
                if (!serviceAccount) continue;
                changedKeys.filter((key) => {
                    if (rowData[key] != serviceAccount[key as keyof TranslateServiceAccount]) {
                        if (!serviceAccount.changedData) serviceAccount.changedData = {};
                        serviceAccount.changedData[key] = rowData[key];
                        if (!serviceAccount.previousData) serviceAccount.previousData = {};
                        serviceAccount.previousData[key] = serviceAccount[key as keyof TranslateServiceAccount];
                        //@ts-ignore has
                        serviceAccount[key] = rowData[key];
                    }
                });
                if (!serviceAccount.changedData) continue;
                await serviceAccount.save();

            }
            else {
                //新建账号
                const DB = await getDB();
                serialNumber = await DB.getNextID("translateServiceSN", "serialNumber");
                const accuntOptions: any = {};
                accuntOptions.serviceID = serviceID;
                accuntOptions.serialNumber = serialNumber;
                Zotero.Utilities.Internal.assignProps(accuntOptions, rowData);
                accuntOptions.forbidden = false;
                const account = new TranslateServiceAccount(accuntOptions);
                await account.save();
                const service = await getTranslateService(serviceID);
                service?.accounts?.push(account);
            }
        }
        tableTreeInstance.dataChangedCache = null;
        tableTreeInstance.editIndex = null;
        if (tableTreeInstance.editingRow) {
            tableTreeInstance.editingRow = null;
        }
        tableTreeInstance.invalidate();
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


    /*   const saveDebounce = Zotero.Utilities.debounce(saveTx, 10000);
      const saveThrottle = Zotero.Utilities.throttle(
          saveTx,
          10000,
          {
              leading: false,
              trailing: true
          }
      ); */





    async function isNewServiceItem(serviceID: string, row?: any) {
        return !(await getSerialNumber(serviceID, row));
    }

    async function getSerialNumber(serviceID: string, row?: any) {
        let sql = `SELECT serialNumber FROM translateServiceSN WHERE serviceID = '${serviceID}'`;
        if (row) sql += `AND appID = '${row.appID}'`;
        const DB = await getDB();
        return await DB.valueQueryAsync(sql);
    }




    function getcellIndex(event: Event) {
        //@ts-ignore has
        //如果代码触发双击，则返回 0
        const x = event.x;
        if (!x) return 0;
        if (!event.target) return 0;
        const parent = event.target as HTMLElement;
        function left(el: HTMLElement) { return el.getBoundingClientRect().x; }
        function right(el: HTMLElement) { return el.getBoundingClientRect().x + el.getBoundingClientRect().width; }
        for (let i = 0; i < parent.childNodes.length; i++) {
            //@ts-ignore has
            if (event.x >= left(parent.childNodes[i]) && event.x <= right(parent.childNodes[i])) {
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


    async function secretKeysTableRowsData<T extends keyof TranslateService>(serviceID: T) {
        const services = await getServices();
        const serviceSelected = services[serviceID];
        let rows: any[];
        if (!serviceSelected) return;
        if (!serviceSelected.hasSecretKey && !serviceSelected.hasToken) return;
        const secretKeyOrtoken = serviceSelected.hasSecretKey ? "secretKey" : "token";
        const keys = ["appID", secretKeyOrtoken, "usable", "charConsum"];
        if (!serviceSelected.accounts) {
            // 返回空数据
            return rows = [kvArrsToObjects(keys)()];
        }
        const getRowDataValues = kvArrsToObjects(keys);
        rows = serviceSelected.accounts.map((acount: TranslateServiceAccount) =>
            getRowDataValues(keys.map((key) => acount[key as keyof TranslateServiceAccount])));
        //const keys = Object.keys(secretKeys[0]);
        //const getRowDataValues = kvArrsToObjects(keys);
        //rows = secretKeys.map((e: any) => getRowDataValues(Object.values(e)));
        return rows;
    };

    /**
     * Auto fill with " key + ': No Data' " when no values
     * @param keys 
     * @returns 
     */
    function kvArrsToObjects(keys: string[]) {
        return function (values?: any | any[]) {
            if (!values) values = [];
            if (!Array.isArray(values)) values = [values];
            return arrToObj(keys, keys.map((k, i) => values[i] !== void 0 ? values[i] : k + ': No Data'));
        };
    }
    function resizeColumnWidth(index: number) {
        const onResizeData: any = {};
        const column = getColumn(index);
        onResizeData[column.dataKey] = column.width + 10;//@ts-ignore has
        tableTreeInstance._columns.onResize(onResizeData);
    }
    function resize() {
        //@ts-ignore has
        const columns = tableTreeInstance._getVisibleColumns();//@ts-ignore has
        //@ts-ignore has
        tableTreeInstance._columns.onResize(Object.fromEntries(columns.map(c => [c.dataKey, c.width])));
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
/* export function testtest() {
    const res = validateRowData(row);
} */







