import { ColumnOptions } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { arrToObj, arrsToObjs, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import { TranslateService } from "../translate/translateService";
import { getElementValue } from "./uiTools";
import { getDB } from "../database/database";
import { getServicesFromDB } from "../translate/translateServices";


declare type TableFactoryOptions = { win: Window, containerId: string, props: VirtualizedTableProps; };
export async function tableFactory({ win, containerId, props }: TableFactoryOptions) {
    if (!containerId) {
        throw "Must pass propsOption.containerId which assign table location";
    }
    const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
    const tableHelper = new ztoolkit.VirtualizedTable(win);
    if (!addon.mountPoint.tables) addon.mountPoint.tables = {};
    //const tempID = `vtableTemp-${new Date().getTime()}`;
    //const tableID = props.id || tempID;
    //addon.mountPoint.tables[tableID] = tableHelper;


    //const tableProps = makeTableProps(props, tableHelper);
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
    const serviceID = getElementValue("serviceID");
    const columnPropKeys = ["dataKey", "label", "staticWidth", "fixedWidth", "flex"];
    //数据 rows 表格创建后挂载至 tableTreeInstance 表格实例上
    let rows = await secretKeysTableRowsData(serviceID);
    if (!rows) return;

    const containerId = `${config.addonRef}-table-container`;

    //props
    const columnPropValues = makeColumnPropValues(rows[0]);
    const columnsProp = arrsToObjs(columnPropKeys)(columnPropValues) as ColumnOptions[];
    const id = `${config.addonRef}-` + "secretKeysTable";

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
        onActivate: editCell,
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
    function handleSelectionChange(selection: TreeSelection, shouldDebounce: boolean) {
        const { selected } = selection;//@ts-ignore has
        if (tableTreeInstance.editIndex) {
            commitEditing();
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
        //@ts-ignore has
        if (tableTreeInstance.editIndex) {
            if (e.key == 'Enter' || e.key == 'Escape') {
                const target = e.target;
                if (e.key != 'Escape') {
                    //@ts-ignore has
                    commitEditing(tableTreeInstance.oldCell, target);

                } else {
                    //@ts-ignore has
                    discardEditing(tableTreeInstance.oldCell, target);
                }
                stopEditing();
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

            //删除数据库数据
            for (const row of rowsDelete) {
                getSerialNumber(serviceID, row).then(async (serialNumber: any) => {
                    await deleteAcount(Number(serialNumber));
                });
            }


            //上面先更新表格，刷新后再删除services中的秘钥
            /* const serviceID = getElementValue("serviceID");
            let secretKeyObj: SecretKeys[] | undefined = [];
            if (rowsDataDelete && serviceID && serviceID != '') {
                for (const rowData of rowsDataDelete) {
                    const secretkey = rowData.key;
                    secretKeyObj = services[serviceID].secretKey
                        ?.filter((e: any) => e.key != secretkey);
                    if (secretKeyObj) {
                        services[serviceID].secretKey = secretKeyObj;
                    }
                }

                if (serviceID.includes("baidu")) {
                    let serviceID2 = "";
                    if (serviceID.includes("Modify")) {
                        serviceID2 = serviceID.replace("Modify", "");
                    } else {
                        serviceID2 = serviceID + "Modify";
                    }
                    services[serviceID2].secretKey = services[serviceID].secretKey;
                }
            } */

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

    function editCell(event: Event, indices: number[]) {
        const COLUMN_PADDING = 16;
        //@ts-ignore has
        if (tableTreeInstance.editIndex) {
            commitEditing();
        }
        if (!event.target) true;
        const div = event.target as HTMLElement;
        const cellIndex = getcellIndex(event);
        if (cellIndex == void 0) return true;
        const cell = div.childNodes[cellIndex];
        const cellNext = div.childNodes[cellIndex + 1];
        if (!cell) return true;

        const label = document.createElement('input');
        label.placeholder = "测试" + cell.textContent;
        label.value = cell.textContent ? cell.textContent : "";
        label.className = 'cell-text';
        label.dir = 'auto';        //@ts-ignore has
        const width = cellNext ? cellNext.screenX - cell.screenX : cell.clientWidth;
        label.style.width = width + "px";
        label.addEventListener('input', e => {
            e.stopImmediatePropagation();
        });
        label.addEventListener('mousedown', (e) => e.stopImmediatePropagation());
        label.addEventListener('mouseup', (e) => e.stopImmediatePropagation());
        label.addEventListener('dblclick', (e) => e.stopImmediatePropagation());
        label.addEventListener('blur', async (e) => {
            const isFocus = window.document.hasFocus();
            const win = div.ownerGlobal;
            const doc = div.ownerDocument;
            const isFocuswin = win.document.hasFocus();

            //@ts-ignore has
            commitEditing(tableTreeInstance.oldCell, label, indices, cellIndex);
            //@ts-ignore has
            event.view?.removeEventListener("click", todo);
        });
        //@ts-ignore has
        event.view?.addEventListener("blur", function () {
            showInfo("失焦：" + event.view.location.href);
        },
            { once: true });
        window.addEventListener("blur", function () {
            showInfo("失焦：" + window.location.href);
        },
            { once: true });
        function todo(e: Event) {
            if (e.target != label) {
                label.blur();
                //@ts-ignore has
                event.view?.removeEventListener("click", todo);
            }
        }
        event.view?.addEventListener("click", todo);
        // Feels like a bit of a hack, but it gets the job done
        setTimeout(() => {
            label.focus();
            label.select();

        });

        //@ts-ignore has
        tableTreeInstance.oldCell = cell;//@ts-ignore has
        tableTreeInstance.label = label;//@ts-ignore has
        tableTreeInstance.editIndex = indices[0];
        div.replaceChild(label, cell);
        //禁用默认操作
        return false;

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

    function getColumn(index: number) {
        //@ts-ignore has
        const columns = tableTreeInstance._getVisibleColumns();//@ts-ignore has
        return columns[index];
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

    function commitEditing() {
        //@ts-ignore has
        const oldCell = tableTreeInstance.oldCell;//@ts-ignore has
        const label = tableTreeInstance.label;//@ts-ignore has
        const index = tableTreeInstance.editIndex;
        if (index == void 0) return;
        //@ts-ignore has
        const key: string = oldCell.classList[1];
        if (oldCell.textContent == label.value) {
            stopEditing();
            return;
        }
        if (!tableTreeInstance.dataChangedCache) tableTreeInstance.dataChangedCache = {};
        const tempObj: any = {};
        tempObj[key] = {
            previous: rows[index][key],
            current: label.value
        };
        tableTreeInstance.dataChangedCache[index] = tempObj;
        rows[index][key] = label.value;
        oldCell.textContent = label.value;
        label.parentNode?.replaceChild(oldCell, label);
        saveThrottle();
        stopEditing();
    };
    function getSelectedTranlateServiceItems() {
        const selectedIndices = Array.from(tableTreeInstance.selection.selected);
        //selectedIndexs.filter((i: number) => rows.splice(i, 1));//删除多个元素由于下标变化而出错
        return rows.filter((v: any, i: number) => selectedIndices.includes(i));
    }
    const saveThrottle = Zotero.Utilities.throttle(
        saveTx,
        3000,
        {
            leading: false,
            trailing: true
        }
    );
    async function saveTx() {
        //todo 防抖节流
        showInfo("fake save to database");
        let dataChangedCache = (tableTreeInstance as VTable).dataChangedCache;
        if (!dataChangedCache) return;
        const serviceID = getElementValue("serviceID");

        let tableNames: string[] = [];
        for (const index of Object.keys(dataChangedCache)) {
            const row = rows[Number(index)];

            let serialNumber = await getSerialNumber(serviceID, row);
            const DB = await getDB();
            if (!serialNumber) {
                await DB.executeTransaction(async () => {
                    serialNumber = await DB.getNextID("translateServiceSN", "serialNumber");
                    let sql = "INSERT INTO translateServiceSN (serialNumber, serviceID";
                    if (row.appID) {
                        sql += ", appID" + ") VALUES ('" + serialNumber + "','" + serviceID + "','" + row.appID + "')";
                    } else {
                        sql += ") VALUES ('" + serviceID + "','" + serialNumber + "')";
                    }
                    await DB.queryAsync(sql);

                    const keys = Object.keys(row);
                    if (keys.includes("token")) {
                        const tableName = "accessTokens";
                        const sqlColumns = ["serialNumber", "serviceID", "appID", "token"];
                        const sqlValues = [serialNumber, serviceID, row.appID, row.token];
                        //sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") "                            + "VALUES (" + sqlValues.join(", ") + ")";
                        sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") " + "VALUES (" + sqlValues.map(() => "?").join() + ")";
                        await DB.queryAsync(sql, sqlValues);
                    } else {
                        const tableName = "accounts";
                        const sqlColumns = ["serialNumber", "serviceID", "appID", "secretKey"];
                        const sqlValues = [serialNumber, serviceID, row.appID, row.secretKey];
                        sql = "INSERT INTO " + tableName + " (" + sqlColumns.join(", ") + ") " + "VALUES (" + sqlValues.map(() => "?").join() + ")";
                        await DB.queryAsync(sql, sqlValues);
                    }
                    let tableName = "charConsum";
                    sql = `INSERT INTO ${tableName} (serialNumber) VALUES (${serialNumber})`;
                    await DB.queryAsync(sql);
                    tableName = "totalCharConsum";
                    sql = `INSERT INTO ${tableName} (serialNumber) VALUES (${serialNumber})`;
                    await DB.queryAsync(sql);

                });
            } else {

                const tempObj = dataChangedCache[index];
                const sqls: string[] = [];
                for (const key of Object.keys(tempObj)) {
                    switch (key) {
                        case "secretKey":
                            tableNames = ['accounts'];
                            break;
                        case "token":
                            tableNames = ['accessTokens'];
                            break;
                        case "charConsum":
                            tableNames = ['charConsum'];
                            break;
                        case "appID":
                            tableNames = ['translateServiceSN', 'accounts', 'accessTokens'];
                            break;
                        case "usable":
                            tableNames = ['translateServiceSN'];
                            break;
                    }
                    tableNames.forEach(tableName => {
                        const sql = `UPDATE ${tableName} SET ${key} ='${tempObj[key].current}' WHERE serialNumber = ${serialNumber}`;
                        sqls.push(sql);
                    });

                }
                await DB.executeTransaction(async () => {
                    for (const sql of sqls) {
                        await DB.queryAsync(sql);
                    }
                });
            }
        }





        const index = tableTreeInstance.editIndex;

        const appID = "appID";
        const secretKey = "secretKey";
        const usable = "usable";
        const charConsum = "charConsum";
        const itemID = 1;
        const obj = {
            appID: appID,
            secretKey: secretKey,
            usable: usable,
            charConsum: charConsum,

        };
        const item = getItem(itemID);
        Zotero.Utilities.Internal.assignProps(item, obj);
        showInfo("fake save to database");
        dataChangedCache = null;

    };

    async function deleteAcount(serialNumber: number) {

        const DB = await getDB();
        await DB.queryAsync(`DELETE FROM translateServiceSN WHERE serialNumber='${serialNumber}'`);
    }

    function getServiceByServiceID(serviceID: string) {
        return {
            "serviceID": serviceID,
            serviceTypeID: 1
        };
    }
    async function isNewServiceItem(serviceID: string, row?: any) {
        return !(await getSerialNumber(serviceID, row));
    }

    async function getSerialNumber(serviceID: string, row?: any) {
        let sql = `SELECT serialNumber FROM translateServiceSN WHERE serviceID = '${serviceID}'`;
        if (row) sql += `AND appID = '${row.appID}'`;
        const DB = await getDB();
        return await DB.valueQueryAsync(sql);
    }

    function discardEditing(oldCell: ChildNode, label: HTMLInputElement) {
        label.parentNode?.replaceChild(oldCell, label);
    };

    function getcellIndex(event: Event) {
        //@ts-ignore has
        const x = event.x;
        if (!x) return;
        if (!event.target) return;
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



    function getItem(itemID: number) {
        const translateService = {};
        return translateService;
    }

    function stopEditing() {
        //@ts-ignore has
        tableTreeInstance.editIndex = null;
        // Returning focus to the tree container
        //Rerender items within the scrollbox. Call sparingly        
        tableTreeInstance.invalidate();
        //tableTreeInstance.;
    }

    function makeColumnPropValues(row: any) {
        // 本地化 ftl 文件中条目的前缀
        const prefTableStringPrefix = "prefs-table-";
        const temp = Object.keys(row).map((key: string, i: number) => {
            // getString 未找到相应本地化字符串时，返回`${config.addonRef}-${localeString}`
            let label = getString(`${prefTableStringPrefix}${key}`);
            if (!label || label.startsWith(config.addonRef)) {
                label = key;
            }
            const result: any[] = [key, label];
            result.push(false, false);
            if (i == 1) {
                result.push(2);
                return result;
            };
            result.push(1);
            return result;
        });
        return temp;
    };


    async function secretKeysTableRowsData<T extends keyof TranslateService>(serviceID?: T) {
        const services = await getServicesFromDB();
        const serviceSelected = serviceID ? services[serviceID] : undefined;
        let rows: any[];
        if (serviceSelected?.secretKeys?.length) {
            const secretKeys: object[] = serviceSelected.secretKeys;
            const keys = Object.keys(secretKeys[0]);
            const getRowDataValues = kvArrsToObjects(keys);
            rows = secretKeys.map((e: any) => getRowDataValues(Object.values(e)));
        } else {
            // 空数据
            rows = [kvArrsToObjects(["appID", "secretKey", "usable", "charConsum",])()];
        }
        return rows;
    };

    function kvArrsToObjects(keys: string[]) {
        return function (values?: any | any[]) {
            if (!values) values = [];
            if (!Array.isArray(values)) values = [values];
            return arrToObj(keys, keys.map((k, i) => values[i] || k + ' + empty'));
        };
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









/* const collectionTreeProps = {
    getRowCount: () => this._rows.length,
    id: this.id,
    ref: ref => this.tree = ref,
    treeboxRef: ref => this._treebox = ref,
    renderItem: this.renderItem,
    alternatingRowColors: null,

    onSelectionChange: this._handleSelectionChange,
    isSelectable: this.isSelectable,
    getParentIndex: this.getParentIndex,
    isContainer: this.isContainer,
    isContainerEmpty: this.isContainerEmpty,
    isContainerOpen: this.isContainerOpen,
    toggleOpenState: this.toggleOpenState,
    getRowString: this.getRowString.bind(this),

    onItemContextMenu: (...args) => this.props.onContextMenu && this.props.onContextMenu(...args),

    onKeyDown: this.handleKeyDown,
    onActivate: this.handleActivate,

    role: 'tree',
    label: Zotero.getString('pane.collections.title')
};

const defaultProps = {
    label: '',
    role: 'grid',
    linesPerRow: 1,
    showHeader: false,
    // Array of column objects like the ones in itemTreeColumns.js
    columns: [],
    onColumnSort: noop,
    onColumnPickerMenu: noop,
    getColumnPrefs: () => ({}),
    storeColumnPrefs: noop,
    staticColumns: false,
    alternatingRowColors: Zotero.isMac ? ['-moz-OddTreeRow', '-moz-EvenTreeRow'] : null,

    // Render with display: none
    hide: false,

    multiSelect: false,

    onSelectionChange: noop,

    // The below are for arrow-key navigation
    isSelectable: () => true,
    getParentIndex: noop,
    isContainer: noop,
    isContainerEmpty: noop,
    isContainerOpen: noop,
    toggleOpenState: noop,

    // If you want to perform custom key handling it should be in this function
    // if it returns false then virtualized-table's own key handler won't run
    onKeyDown: () => true,
    onKeyUp: noop,

    onDragOver: noop,
    onDrop: noop,

    // Enter, double-clicking
    onActivate: noop(),

    onItemContextMenu: noop(),
};

const defaultVtablePropsBackup: VTableProps = {
    id: `${config.addonRef}-prefs-table-${Zotero.Utilities.randomString(5)}`,
    getRowCount: () => rows.length || "empty",
    getRowData: ((index: number) => rows[index]),
    renderItem: undefined,
    linesPerRow: undefined,
    disableFontSizeScaling: undefined,
    alternatingRowColors: undefined,
    label: undefined,
    role: undefined,
    showHeader: true,
    columns: undefined,
    onColumnPickerMenu: undefined,
    onColumnSort: undefined,
    getColumnPrefs: undefined,
    storeColumnPrefs: noop,
    getDefaultColumnOrder: undefined,
    containerWidth: undefined,
    treeboxRef: noop,
    hide: undefined,
    multiSelect: true,
    onSelectionChange: noop,
    isSelectable: undefined,
    getParentIndex: undefined,
    isContainer: undefined,
    isContainerEmpty: undefined,
    isContainerOpen: undefined,
    toggleOpenState: noop,
    getRowString: ((index: number) => rows[index].key || ""),
    onKeyDown: undefined,
    onKeyUp: undefined,
    onDragOver: undefined,
    onDrop: undefined,
    onActivate: undefined,
    onFocus: undefined,
    onItemContextMenu: undefined,
};

const temp = {
    id: `${config.addonRef}-` + (options.id || `prefs-table-${Zotero.Utilities.randomString(5)}`),
    columns: columnsProp,
    showHeader: options.showHeader || true,
    multiSelect: options.multiSelect || true,
    staticColumns: options.staticColumns || false,
    getRowCount: () => rows.length || "empty",
    getRowData: options.getRowData || ((index: number) => rows[index]),
    getRowString: options.getRowString || ((index: number) => rows[index].key || ""),
    onActivate: options.onActivate || editCell,
    onKeyDown: options.onKeyDown || handleKeyDown,
    onItemContextMenu: options.onItemContextMenu || handleItemContextMenu,
}; 

*/