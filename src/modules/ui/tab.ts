import { arrsToObjs } from "../../utils/tools";
import { s, t } from "./tabData";
import { getRowString, tableFactory } from "./tableSecretKeys";

export async function tabTest() {
    const tab = Zotero_Tabs.add({
        type: 'library',
        title: "译文校对",
        data: {
            itemID: "translate",


        },
    });

    const container = tab.container;
    const div1 = ztoolkit.createXULElement(document, "div");
    div1.setAttribute("id", "table-combine");
    container.appendChild(div1);
    const sourceArr = s;
    const targetArr = t;
    await translationCombineTable(sourceArr, targetArr);
}


export async function translationCombineTable(sourceArr: string[], targetArr: string[]) {

    const id = "sourceCombine";
    const containerId = `table-combine`;
    function getRows() {
        const newArr = [];
        for (let i = 0; i < targetArr.length; i++) {
            newArr.push([i, sourceArr[i] || '', targetArr[i]]);
        }
        const rows: any[] = arrsToObjs(["index", "sourceText", "translation"])(newArr) || [];
        return rows;
    }
    const rows: any[] = getRows();


    //props
    const columnsProp = arrsToObjs([
        "dataKey",
        "label",
        "staticWidth",
        "fixedWidth",
        "flex",
        "width",
    ])(
        [
            ["index", "index", false, false, true, 20],
            ["sourceText", "sourceText", false, false, true, 400],
            ["translation", "translation", false, false, true, 400],
        ]
    );
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
        containerWidth: 1200,
    };

    const options: TableFactoryOptions = {
        win: window,
        containerId: containerId,
        props: props,
    };

    const tableHelper = await tableFactory(options);
    const tableTreeInstance = tableHelper.treeInstance as VTable; //@ts-ignore has

    function handleGetRowString(index: number) {
        return getRowString(rows, index, tableTreeInstance);
    }

    function combineRows(type: "up" | "down") {
        let index = tableTreeInstance.selection.focused;
        if (index == void 0) index = Array.from(tableTreeInstance.selection.selected)[0];
        if (index == void 0) return true;
        if (type == "up") {
            if (index == 0) return true;
            targetArr[index - 1] += targetArr[index];
        } else {
            if (index == targetArr.length - 1) return;
            targetArr[index + 1] += targetArr[index];
        }
        targetArr.splice(index, 1);
        rows.length = 0;
        rows.push(...getRows());
        tableTreeInstance.invalidate();

    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key == "ArrowUp") {
            combineRows("up");

        }
        if (event.key == "ArrowDown") {
            combineRows("down");

        }
        return true;
    }

}