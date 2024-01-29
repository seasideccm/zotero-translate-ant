import { TagElementProps } from "zotero-plugin-toolkit/dist/tools/ui";
import {
  ApiName,
  BaiduOcrAccurateBasic,
  BaiduOcrPictureTr,
  baiduOcr,
  extractData,
} from "./baiduOCR";

export async function ocrImage(imgSrc: string, secretKey?: string) {
  secretKey = secretKey || "20230302001582861#uXy0Gx8MaL8Wc46DIlvJ";
  //const secretKey = `3hZgZRDlgkZrumbdv7l3Rd0C#uMn7h7yhsMXC24KGG49uaerjxsz2QxhG`;
  let apiName: ApiName;
  if (secretKey.length > 50) {
    apiName = "baiduOcrAccurate";
  } else {
    apiName = "baiduPictureTranslate";
  }

  const option: BaiduOcrPictureTr | BaiduOcrAccurateBasic = {
    image: imgSrc,
  };
  let response;
  try {
    response = await baiduOcr(secretKey, option);
  } catch (e) {
    ztoolkit.log(e);
  }

  const res = extractData(response, apiName);
  ztoolkit.log(res);
  if (!res) return;

  //await insertMyDB("myDBFirstTable", response);

  const textArr = res?.split("\n");

  const recorderToDB = {
    sourceText: "TEXT NOT NULL",
    targetText: "TEXT NOT NULL",
    score: "INTEGER",
  };
  let spanArr = "";
  textArr.forEach((p: string) => {
    const str = "<p>" + p + "</p>";
    spanArr += str;
  });
  const style = `font-size: "16px"; float: "right";justifyContent: "center";max-width: "50%";z-index: 3`;
  const props: TagElementProps = {
    tag: "div",
    namespace: "html",
    id: "popupOcr",
    attributes: {
      style: style,
    },
    properties: {
      innerHTML: spanArr,
    },
  };
  const ocrDialog = new ztoolkit.Dialog(1, 1).addCell(0, 0, props).open("", {
    resizable: true,
    noDialogMode: true,
    centerscreen: true,
    width: window.screen.width * 0.5,
    height: window.screen.height * 0.5,
  });
}
