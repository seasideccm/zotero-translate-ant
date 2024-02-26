import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { arrToObj, arrsToObjs, batchAddEventListener, compareObj, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import { TranslateService, TranslateServiceAccount } from "../translate/translateService";
import { getElementValue } from "./uiTools";
import { getDB, getDBSync } from "../database/database";
import { deleteAcount, getSerialNumberSync, getServiceAccount, getServiceAccountSync, getServices, getServicesFromDB, getTranslateService, validata } from "../translate/translateServices";
import { DEFAULT_VALUE, EmptyValue } from "../../utils/constant";
import { serviceManage } from '../translate/serviceManage';


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
    const rows: any[] = await secretKeysTableRowsData(serviceID) || [];
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
        if (tableTreeInstance.editIndex != void 0) {
            commitEditingRow();
            return true;
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


        if (tableTreeInstance.editIndex != void 0) {
            if (e.key == 'Enter' || e.key == 'Escape') {
                if (e.key != 'Escape') {
                    commitEditingRow();
                } else {
                    discardEditing();
                }
            }
            if (e.key == ' ') {
                return false;
            }
            return false;
        }

        if ((e.ctrlKey || e.metaKey) && e.key == "z") {
            showInfo("恢复");
            return false;
        }

        if ((e.ctrlKey || e.metaKey) && e.key == "v") {
            pasteAccount();
            showInfo("粘贴，添加秘钥");
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
            //编辑中的行失焦后移除选项窗口的 click 事件和当前行 click 事件（阻止事件传递）
            rowElement.removeEventListener("click", stopEvent);
        });
        listentRow();
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
        const oldCells = tableTreeInstance.editingRow["oldCells"];
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
        const rowDataCache = tableTreeInstance.dataChangedCache[index];
        rowDataCache[key] = rows[index][key];
        //修改表格单元格数据
        rows[index][key] = inputCell.value;
        oldCell!.textContent = inputCell.value;
        inputCell.parentNode?.replaceChild(oldCell, inputCell);
    };



    function listentRow() {
        const index = tableTreeInstance.editIndex;
        const win = addon.data.prefs?.window;
        if (index == void 0) return;
        const rowElement = getRowElement(index)[0];
        function commit(e: Event) {
            if (e.target != rowElement.parentElement) {
                commitEditingRow();
                if (win) {
                    win.removeEventListener("click", commit);
                    //win.removeEventListener("click", stopEvent);
                }
            }
        }

        if (win) {
            win.addEventListener("click", commit);
            //win.addEventListener("click", stopEvent);
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
        const indices = Object.keys(dataChangedCache);

        for (const index of indices) {
            if (index == void 0) return;
            const changedKeys = Object.keys(dataChangedCache[index]);
            const rowData = rows[Number(index)];
            const serialNumber = getSerialNumberSync(serviceID, rowData.appID);
            //false==0结果为true
            if (typeof serialNumber != "boolean" && serialNumber != void 0) {
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
        const text = '20201001000577901#jQMdyV80ouaYBnjHXNKs';
        const textArr = text.split(/\r?\n/).filter(e => e);
        const valuesArr = textArr.map((str: string) => str.split(/[#\s,;@]/).filter(e => e));
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

        const sameRows = pasteRows.map((pasteRow: any) => rows.find((row: any) => compareObj(pasteRow, row)));
        const newRows = pasteRows.filter((pasteRow: any) => sameRows.some((row: any) => row != pasteRow));


        /* const values = text.split(/[#\s,;@]/).filter(e => e)
        const row: any = kvArrsToObject(keys)(values);
        Object.keys(row).filter((key: string, i: number) => {
            if ((row[key] as string).includes(EmptyValue)) {
                row[key] = DEFAULT_VALUE[key as keyof typeof DEFAULT_VALUE];
            }
        }); */


        rows.push(...newRows);
        tableHelper.render();
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
        let services = await getServices();
        let serviceSelected = services[serviceID];
        if (!serviceSelected || !serviceSelected.accounts || !serviceSelected.accounts.length) {
            services = await getServicesFromDB();
            serviceSelected = services[serviceID];
        }
        let rows: any[];
        if (!serviceSelected) return;
        if (!serviceSelected.hasSecretKey && !serviceSelected.hasToken) return;
        const secretKeyOrtoken = serviceSelected.hasSecretKey ? "secretKey" : "token";
        const keys = ["appID", secretKeyOrtoken, "usable", "charConsum"];
        if (!serviceSelected.accounts || !serviceSelected.accounts.length) {
            // 返回空数据
            return rows = [kvArrsToObject(keys)()];
        }

        const getRowDataValues = kvArrsToObject(keys);
        rows = serviceSelected.accounts.map((acount: TranslateServiceAccount) =>
            getRowDataValues(keys.map((key) => acount[key as keyof TranslateServiceAccount])));
        //const keys = Object.keys(secretKeys[0]);
        //const getRowDataValues = kvArrsToObject(keys);
        //rows = secretKeys.map((e: any) => getRowDataValues(Object.values(e)));
        return rows;
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
            return arrToObj(keys, keys.map((k, i) => values[i] !== void 0 ? values[i] : k + ': ' + EmptyValue));
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








