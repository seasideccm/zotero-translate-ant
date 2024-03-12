
export function openInputDialog() {
    const name = "test";
    const io = { name };
    window.openDialog("chrome://.../inputDialog.xhtml",
        "_blank", "chrome,modal,centerscreen,resizable=no", io);
}




