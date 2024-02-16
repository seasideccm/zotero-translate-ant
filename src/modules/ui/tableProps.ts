import { ColumnOptions, VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { arrToObj, arrsToObjs, collectFilesRecursive, showInfo } from "../../utils/tools";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { ContextMenu } from "./contextMenu";
import { jsonTofileTest } from "../database/sync";


export function makeTableProps(options: any, tableHelper: VirtualizedTableHelper) {
    const columnsProp = arrsToObjs(options.columnPropKeys)(options.columnPropValues) as ColumnOptions[];
    let rows = options.getRowsData ? options.getRowsData() : options.rows;
    return Object.assign({}, {
        id: `${config.addonRef}-` + (options.id || `prefs-table-${Zotero.Utilities.randomString(5)}`),
        columns: columnsProp,
        showHeader: options.showHeader || true,
        multiSelect: options.multiSelect || true,
        staticColumns: options.staticColumns || false,
        getRowCount: () => rows.length || 0,
        getRowData: options.getRowData || ((index: number) => rows[index]),
        getRowString: options.getRowString || ((index: number) => rows[index].key || ""),
        onActivate: options.onActivate || editCell,
        onKeyDown: options.onKeyDown || handleKeyDown,
        onItemContextMenu: options.onItemContextMenu || handleItemContextMenu,
    });

    function handleItemContextMenu(...args: any[]) {
        showInfo("条目右键菜单", { window: addon.data.prefs?.window });
        //tableHelper.props.onContextMenu && tableHelper.props.onContextMenu(...args);
        //const onContextMenu = (...args) => ZoteroPane.onCollectionsContextMenuOpen(...args);

        const onCollectionsContextMenuOpen = async function (event: Event, x: number, y: number) {
            const contextMenu = buildContextMenu();
            x = x || event.screenX;
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

        const buildContextMenu = () => {
            const keys = ["label", "func", "args"];
            const menuPropsGroupsArr = [
                [
                    ["collectFilesRecursive", collectFilesRecursive, ["C:\\Users\\Administrator\\Documents\\test"]],
                    ["jsonTofile", jsonTofileTest, []],
                ],
            ];
            const idPostfix = "tableContextMenu";
            const contextMenu = new ContextMenu({ keys, menuPropsGroupsArr, idPostfix });
            return contextMenu;
        };
        const [event, x, y] = args;
        onCollectionsContextMenuOpen(event, x, y);
    }

    function handleKeyDown(e: KeyboardEvent) {
        // When pressing delete, delete selected line and refresh table.
        // Returning false to prevent default event.
        //return返回的值决定是否继续执行 virtualized-table.jsx 默认的按键功能
        //@ts-ignore has
        if (tableHelper.treeInstance.isEditing) {
            if (e.key == 'Enter' || e.key == 'Escape') {
                const target = e.target;
                if (e.key != 'Escape') {
                    //@ts-ignore has
                    commitEditing(tableHelper.treeInstance.oldCell, target);
                    saveTx();
                } else {
                    //@ts-ignore has
                    discardEditing(tableHelper.treeInstance.oldCell, target);
                }
                stopEditing();
            }
            return false;
        }
        if (e.key == "Delete" || e.key == "Backspace" || (Zotero.isMac && e.key == "Backspace")) {
            //获取要删除的行数据，获得秘钥，和services中的秘钥比较,然后删除秘钥
            const rowsDataDelete = rows.filter(
                (v: any, i: number) => tableHelper.treeInstance.selection.isSelected(i)
            );
            //确认删除，点击cancel则取消
            const confirm = addon.data.prefs!.window.confirm(getString("info-delete-secretKey") + '\n'
                + getString("info-delete-confirm"));
            if (!confirm) return true;

            //过滤掉选中行的数据，保留未选中的数据为数组，赋值给rows
            const selectedIndexs = Array.from(tableHelper.treeInstance.selection.selected);
            //selectedIndexs.filter((i: number) => rows.splice(i, 1));//删除多个元素由于下标变化而出错
            rows = rows.filter((v: any, i: number) => !selectedIndexs.includes(i)) || [];
            tableHelper.render();
            //上面先更新表格，刷新后再删除services中的秘钥
            /* const serviceID = getElementValue("serviceID");
            let secretKeyObj: SecretKey[] | undefined = [];
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
            return;
        }

        /* if (e.key == 'ContextMenu' || (e.key == 'F10' && e.shiftKey)) {
            //@ts-ignore has
            const selectedElem = document.querySelector(`#${tableHelper.treeInstance._jsWindowID} [aria-selected=true]`);
            if (!selectedElem) return;
            const boundingRect = selectedElem.getBoundingClientRect();
            tableHelper.treeInstance.props.onItemContextMenu(
                e,
                window.screenX + boundingRect.left + 50,
                window.screenY + boundingRect.bottom
            );
            return;
        } */
        return true;
    }

    function editCell(event: MouseEvent | KeyboardEvent, indexs: number[]) {
        if (!event.target) return;
        const div = event.target as HTMLElement;
        const cellIndex = getcellIndex(event);
        if (cellIndex == void 0) return true;
        const cell = div.childNodes[cellIndex];
        const cellNext = div.childNodes[cellIndex + 1];
        if (!cell) return;

        const label = document.createElement('input');
        label.placeholder = "测试" + cell.textContent;
        label.value = cell.textContent ? cell.textContent : "";
        label.className = 'cell-text';
        label.dir = 'auto';

        //@ts-ignore has
        const width = cellNext ? cellNext.screenX - cell.screenX : cell.clientWidth;
        label.style.width = width + "px";
        label.setAttribute("size", '5');
        label.addEventListener('input', e => {
            e.stopImmediatePropagation();
        });
        label.addEventListener('mousedown', (e) => e.stopImmediatePropagation());
        label.addEventListener('mouseup', (e) => e.stopImmediatePropagation());
        label.addEventListener('dblclick', (e) => e.stopImmediatePropagation());
        label.addEventListener('blur', async (e) => {
            //@ts-ignore has
            commitEditing(tableHelper.treeInstance.oldCell, label, indexs, cellIndex);
            //saveTx();
            stopEditing();
            event.view?.removeEventListener("click", todo);
        });

        // Feels like a bit of a hack, but it gets the job done
        setTimeout(() => {
            label.focus();
            label.select();
        });
        //@ts-ignore has
        tableHelper.treeInstance.oldCell = cell;
        div.replaceChild(label, cell);
        //@ts-ignore has
        tableHelper.treeInstance.isEditing = true;
        //@ts-ignore has
        tableHelper.treeInstance._columns.onResize({ key: width });
        event.view?.addEventListener("click", todo);
        function todo(e: Event) {
            if (e.target != label) {
                label.blur();
                event.view?.removeEventListener("click", todo);
            }
        }

        //禁用默认操作
        return false;

    }
    function commitEditing(oldCell: ChildNode, label: HTMLInputElement, indexs: number[], cellIndex: number) {
        const index = indexs[0];
        //@ts-ignore has
        const key = oldCell.classList[1];
        rows[index][key] = label.value;
        oldCell.textContent = label.value;
        label.parentNode?.replaceChild(oldCell, label);
        saveTx();
    };
    function discardEditing(oldCell: ChildNode, label: HTMLInputElement) {
        label.parentNode?.replaceChild(oldCell, label);
    };



    function getcellIndex(event: MouseEvent | KeyboardEvent) {
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
    function saveTx() {
        showInfo("fake save to database");
    };
    function stopEditing() {
        //@ts-ignore has
        tableHelper.treeInstance.isEditing = null;
        // Returning focus to the tree container
        //Rerender items within the scrollbox. Call sparingly        
        tableHelper.treeInstance.invalidate();
        //tableHelper.treeInstance.;
    }
}



