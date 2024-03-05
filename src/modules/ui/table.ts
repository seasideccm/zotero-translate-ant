import { VirtualizedTableHelper } from "zotero-plugin-toolkit/dist/helpers/virtualizedTable";
import { showInfo } from "../../utils/tools";
import { openAddonPrefPane } from "../preferenceScript";

declare type TableFactoryOptions = { win: Window, containerId: string, props: VirtualizedTableProps; };

export class Table {
    [key: string]: any;
    constructor(options: any) {
        this.rowsData = options.rowsData;
        this.initialPromise = this.init(options);

    }
    init(options: any) {
        if (!options.win) throw new Error("window undefined");
        options.props.getRowCount = () => this.rowsData.length;
        options.props.getRowData = (index: number) => this.rowsData[index];
        const defaultProps = {
            getRowCount: () => this.rowsData.length,
            getRowData: (index: number) => this.rowsData[index],
        };
        if (!this.rowsData && (!options.props.getRowCount || !options.props.getRowData)) throw new Error("Data not available");
        Object.assign(defaultProps, options.props);
        tableFactory(options).then((tableHelper: VirtualizedTableHelper) => {
            Zotero.Utilities.Internal.assignProps(this, tableHelper.treeInstance);

        });
    }

    adjustWidth(rows: any[], visibleKeys?: string[]) {

        const onResizeData: any = {};
        const totalWidth = this._topDiv?.clientWidth;//表格宽度
        if (!totalWidth) return;
        const colums: any[][] = this.rowsToColums(rows, visibleKeys) || [[]];
        const longestCells = this.strMax(colums);
        const keys = visibleKeys || Object.keys(rows[0]);//可指定keys
        const keyWidth: { [key: string]: number; } = {};
        for (let i = 0; i < keys.length; i++) {
            const cellText = longestCells[i];
            const key = keys[i];
            const width = this.caculateCellWidth(key, cellText, i);
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
        this._columns.onResize(onResizeData);//@ts-ignore has
        this.rerender();
    }

    caculateCellWidth(key: string, cellText: string, index: number = 0) {
        this._topDiv?.scrollIntoView();//@ts-ignore has
        this.rerender();
        const container = this._topDiv?.children[1].children[0].children[0] as HTMLDivElement;
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

    strMax(colums: any[][]) {
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
    rowsToColums(rows: any[], visibleKeys?: string[]) {
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

}
async function tableFactory({ win, containerId, props }: TableFactoryOptions) {
    if (!containerId) {
        throw "Must pass containerId which assign table location";
    }
    const renderLock = ztoolkit.getGlobal("Zotero").Promise.defer();
    const tableHelper = new ztoolkit.VirtualizedTable(win);

    tableHelper.setContainerId(containerId);
    tableHelper.setProp(props);
    tableHelper.render(-1, () => {
        renderLock.resolve();
        if (!addon.mountPoint.tables) addon.mountPoint.tables = {};
        addon.mountPoint.tables[tableHelper.props.id] = tableHelper;
    });
    await renderLock.promise;
    return tableHelper;
}


export async function testTableClass() {
    const columns = [{ dataKey: "col1", label: "Column 1" }, { dataKey: "col2", label: "Column 2" }];
    const rows = [{ col1: "Row 1", col2: "john" }, { col1: "Row 2", col2: "mike" }];

    await openAddonPrefPane();
    await Zotero.Promise.delay(1000);
    const win = addon.data.prefs?.window;
    if (!win) {
        showInfo("No window found");
        return;
    }


    const vvtOptions =
    {
        win: win,
        containerId: "my-table-container",
        props: {
            id: "my-table",
            columns: columns,

        },
        rowsData: rows,
    };
    const vtable = new Table(vvtOptions);
    await vtable.initialPromise;
    showInfo("请开始测试您的表格 8888");
    showInfo("测试结束");

}


