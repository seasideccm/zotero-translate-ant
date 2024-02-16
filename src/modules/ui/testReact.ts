//测试通过
export function testReact() {
    const win = ztoolkit.getGlobal("window");
    const _require = (win as any).require;
    const React = _require("react");
    const ReactDOM = _require("react-dom");
    const VirtualizedTable = _require("components/virtualized-table");
    const IntlProvider = _require("react-intl").IntlProvider;

    const button = React.createElement("button", { className: "testButton", onClick: fnTest }, "测试按钮");
    const containerParent = win.document.querySelector("#zotero-items-toolbar");

    //容器将替换为 React 组件
    const container = win.document.createElement("button");
    function fnTest() {
        win.document.querySelector(".testButton")?.remove();
    }
    containerParent?.appendChild(container);
    ReactDOM.render(button, container);
}
