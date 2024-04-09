export async function monitorImageItem() {
  let itemsTree;
  while (!(itemsTree = document.getElementById("zotero-items-tree"))) {
    await Zotero.Promise.delay(1000);
  }
  //防抖 达不到效果
  //const debounceCallBack3 = Zotero.Utilities.debounce(callBack, 300);
  //节流 , { leading: true, trailing: false }
  const overImageItemdeThrottle = Zotero.Utilities.throttle(
    overImageItem,
    1000,
  );
  itemsTree.addEventListener("mouseover", function (e) {
    overImageItemdeThrottle(e);
  });
}
function overImageItem(e: MouseEvent) {
  //@ts-ignore has id
  const id = e.target?.id;
  if (id && id.includes("-row-")) {
    const index = id.replace(/.+-row-/m, "");
    //const item = Zotero.getActiveZoteroPane().itemsView._getRowData(index);
    const zp = Zotero.getActiveZoteroPane();
    //@ts-ignore xxx
    const row = zp.itemsView.getRow(index);
    //@ts-ignore has id
    const itemByRow = Zotero.Items.get(row.id);
    if (itemByRow && itemByRow.attachmentContentType?.includes("image")) {
      let path = itemByRow.getFilePath() as string;
      path = PathUtils.normalize(path!);
      if (!IOUtils.exists(path)) return;
      const srcPath = "file:///" + path!;
      const position = {
        x: e.screenX,
        y: e.screenY,
      };
      const imagePop = popupIamge(srcPath, position);
      (e.target as HTMLElement).addEventListener("mouseout", async () => {
        await Zotero.Promise.delay(2000);
        let imageHoverd = false;
        imagePop.window.addEventListener("mouseover", function fn(e) {
          imageHoverd = true;
        });
        if (imageHoverd) {
          return;
        }
        imagePop.window.close();
      });
    }
  }
}

function popupIamge(srcPath: string, position: any) {
  const style = `float: "right";justifyContent: "center";max-width: "50%";z-index: 3`;
  const props = {
    tag: "div",
    namespace: "html",
    id: "popupImage",
    attributes: {
      style: style,
    },
    children: [
      {
        tag: "img",
        namespace: "html",
        attributes: {
          src: srcPath,
          alt: "image",
          style: `width:100%;`,
        },
      },
    ],
  };
  const imagePop = new ztoolkit.Dialog(1, 1)
    .addCell(0, 0, props)
    .open(`${srcPath.replace("file:///", "")}`, {
      resizable: true,
      fitContent: true,
      noDialogMode: true,
      left: position.x + 20,
      top: position.y + 20,
    });
  return imagePop;
}

//获取绝对位置
/* const mousePosition = (ev?: any) => {

    if (!ev) ev = window.event;
    if (ev.pageX || ev.pageY) {
        return { x: ev.pageX, y: ev.pageY };
    }
    return {
        x: ev.clientX + document.documentElement.scrollLeft - document.body.clientLeft,
        y: ev.clientY + document.documentElement.scrollTop - document.body.clientTop
    };
}; */
