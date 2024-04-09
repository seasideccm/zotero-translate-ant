
import { addonStorageDir } from "../../utils/constant";
import { getString } from "../../utils/locale";

import { fileSizeFormat, getFileInfo, getPathDir, readImage, readJsonFromDisk, saveImage, saveJsonToDisk, showInfo } from "../../utils/tools";
import { prepareReader } from "./prepareReader";

export const boldFontStyle = ["AdvTT7d6ad6bc", "AdvP4ADA8D", "AdvP4AA440", "AdvP978E", "AdvP405AA6", "AdvPi3", "AdvTTecf15426.B", "AdvP418142"];
export const italicFontStyle = ["AdvP9794", 'AdvTT52d06db3.I',];
export const boldItalicFontStyle = [];
export const normalFontStyle = ["AdvP9725",];


export const pdfCharasReplace = {
    "¼": "=",
    '\\u0000': '－',
    '\\u0002': '×',
    '\\u0003': '－',
    '\\u0004': '*',
    '\\u000f': '●',
    "\\u0015": "≥",
};

export const fontStyleCollection = {
    boldFontStyle: boldFontStyle,
    italicFontStyle: italicFontStyle,
    boldItalicFontStyle: boldItalicFontStyle,
};


const alphabetDigital = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export const pdfFontInfo: {
    [key: string]: string;
} = {};
//字形左侧垂直整齐，最高最低点均位于左侧，比较左侧最高最低点
const upDownBeginleftPoint = 'HEFKLNhkBDPRXZxz'.split('');
//字形左侧垂直整齐，斜体顶部左侧超出底部左侧，按列由左向右找
const downBeginLeftPoint = 'Smnprsuyblg'.split('');
//字形右侧垂直整齐，斜体顶部右侧超出底部右侧，按列由右向左找
const upBeginRightPoint = 'JCQGacdefjqt'.split('');
//对称字形，用上下边的中点判断
const upDownCenterPoint = 'AMVWYTIUvwOoi'.split('');
export const fontStyleJudgeType = {
    0: upDownBeginleftPoint,
    1: downBeginLeftPoint,
    2: upBeginRightPoint,
    3: upDownCenterPoint,
};

export const regFontName = /^[A-Za-z]{6}\+/m;
export const fontStyleFileName = "fontStyleCollection";

export async function identifyRedPointAndItalic(fontObj: any, ctx: any, pdfItemID: number) {
    const fontName = fontObj.name.replace(regFontName, "");
    const fontSimpleInfo: {
        fontName: string;
        markerChar: string | null;
        chars: string[] | null;
        strs: string[] | null;
        charImg: {
            width: number;
            height: number;
            base64: string;
        } | null | undefined;
        charsImg: {
            width: number;
            height: number;
            base64: string;
        } | null | undefined;
        redPointNumbers: number | null;
        isItalic: boolean | null;
        loadName: string;
        pdfItemID: number;
    } = {
        fontName: fontName,
        markerChar: null,
        chars: fontObj.charsArr,
        strs: fontObj.strs,
        charImg: null,
        charsImg: null,
        redPointNumbers: null,
        isItalic: null,
        loadName: fontObj.loadedName,
        pdfItemID: pdfItemID,
    };

    if (!fontObj.styleJudgeType || fontObj.isType3Font) {
        return fontSimpleInfo;
    }
    const browserFontSize = 40;
    //字符最左侧可能小于起点，故绘制起点加 10 个像素
    const offsetX = 10;
    const offsetY = 10;
    ctx.canvas.width = browserFontSize + offsetX;
    ctx.canvas.height = browserFontSize + offsetY;
    const typeface = `"${fontObj.loadedName}", ${fontObj.fallbackName}`;
    const bold = "normal";
    const italic = "normal";
    const fontValue = `${italic} ${bold} ${browserFontSize}px ${typeface}`;
    ctx.font = fontValue;
    ctx.fillStyle = "red";
    //确定绘制字符，依照判别字符顺序找，返回符合的第一个字符，没有则返回 undefined   
    const markerChar = fontObj.judgeCharArr.find((char: string) => fontObj.charsArr.includes(char));
    fontSimpleInfo.markerChar = markerChar;
    ctx.fillText(markerChar, offsetX, browserFontSize);
    let charImgData: ImageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    //判断是否为斜体
    fontSimpleInfo.isItalic = judgeFontItalic(fontObj, charImgData);
    fontSimpleInfo.redPointNumbers = charImgData.data.filter((e: number, i: number) => i % 4 == 0).filter((e: number) => e > 0).length;
    const charPath = getPathDir(fontName, PathUtils.join(addonStorageDir, "fontImg.png")).path;
    //图片不存在则绘制，已存在则读取
    if (!await IOUtils.exists(charPath)) {
        //确定绘制的字符边界        
        const charBorder = findRedsBorder(charImgData);
        if (charBorder) {
            charImgData = ctx.getImageData(charBorder.x1, charBorder.y1, charBorder.widthBox, charBorder.heightBox);
            fontSimpleInfo.charImg = {
                width: charImgData.width,
                height: charImgData.height,
                base64: makeImgDataURL(charImgData, ctx)
            };
            await saveImage(fontSimpleInfo.charImg.base64, charPath);
        }
        const fontNotIncludeChars = alphabetDigital.filter((char: string) => !fontObj.charsArr.includes(char));
        const charsPerLine = 15;
        const rowsTotal = Math.ceil(fontObj.charsArr.length / charsPerLine) + Math.ceil(fontNotIncludeChars.length / charsPerLine) + 4;
        ctx.canvas.width = 500;
        ctx.canvas.height = rowsTotal * (browserFontSize + 2) + 10;
        ctx.font = fontValue;
        ctx.fillStyle = "red";
        //字体包含和可能未包含的字符分开绘制在一张图片上
        let rowIndexBeginDraw = drawChars(fontObj.charsArr, browserFontSize, charsPerLine, 1, true);
        rowIndexBeginDraw = drawSeperator(rowIndexBeginDraw, fontName, offsetX);
        drawChars(fontNotIncludeChars, browserFontSize, charsPerLine, rowIndexBeginDraw, false);
        let charsImgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        const border = findRedsBorder(charsImgData);
        if (border) {
            //保存字体图片
            charsImgData = ctx.getImageData(border.x1, border.y1, border.widthBox, border.heightBox);
            const charsPath = getPathDir(fontName + "_Chars", PathUtils.join(addonStorageDir, "fontImg.png")).path;
            fontSimpleInfo.charsImg = {
                width: charsImgData.width,
                height: charsImgData.height,
                base64: makeImgDataURL(charsImgData, ctx)
            };
            await saveImage(fontSimpleInfo.charsImg.base64, charsPath);
        }
    } else {
        //读取图像数据
        fontSimpleInfo.charImg = await readImage(charPath);
    }
    return fontSimpleInfo;
    function judgeFontItalic(fontObj: any, imageData: ImageData) {
        const redPixels = imageData.data.filter((e: number, i: number) => i % 4 == 0);
        const width = imageData.width;
        let isItalic = false;
        switch (fontObj.styleJudgeType) {
            case "0": if (judgeHorizontalLeft()) {
                isItalic = true;
            }
                return isItalic;
            case "1": if (judgeVerticalLeft()) {
                isItalic = true;
            }
                return isItalic;
            case "2": if (judgeVerticalRight()) {
                isItalic = true;
            }
                return isItalic;
            case "3": if (judgeCenter()) {
                isItalic = true;
            }
                return isItalic;
            default:
                return isItalic;
        }

        function judgeHorizontalLeft() {
            let firstRedPointX;
            let lastRowRedPointX;
            for (let y = 0; y < browserFontSize; y++) {
                const condition = findRedPointXHorizontal(y, redPixels, width);
                if (condition != -1) {
                    firstRedPointX = condition;
                    break;
                }
            }
            for (let y = browserFontSize - 1; y > 0; y--) {
                const condition = findRedPointXHorizontal(y, redPixels, width);
                if (condition != -1) {
                    lastRowRedPointX = condition;
                    break;
                }
            }
            firstRedPointX ? firstRedPointX : 0;
            lastRowRedPointX ? lastRowRedPointX : 0;
            if (firstRedPointX! - lastRowRedPointX! > 1) {
                return true;
            } else {
                return false;
            }
        }
        function judgeVerticalLeft() {
            //从最后一行开始，从左到右找红点，然后向上查找，直到第一个红点出现的行
            //记录查找的行数，计算红点比例
            const firstPointIndex = redPixels.findIndex((e) => e > 0);
            for (let left = browserFontSize * (browserFontSize - 1); left > 0; left -= browserFontSize) {
                for (let x = 0; x < browserFontSize; x++) {
                    if (redPixels[left + x]) {
                        let i = 0, points = 0;
                        for (let up = left - browserFontSize; up > firstPointIndex; up -= browserFontSize) {
                            i++;
                            if (redPixels[up + x]) {
                                points++;
                            }
                        }
                        if (points / i < 0.4) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                }
            }

        }
        function judgeVerticalRight() {
            //从首次出现红点的行开始，从右到左找红点，然后向下查找。
            //记录查找的行数，计算红点比例
            const firstPointIndex = redPixels.findIndex((e) => e > 0);

            for (let left = Math.trunc(firstPointIndex / browserFontSize) * browserFontSize; left < redPixels.length; left += browserFontSize) {
                for (let x = browserFontSize - 1; x >= 0; x--) {
                    if (redPixels[left + x]) {
                        let i = 0, points = 0;
                        for (let down = left + browserFontSize; down < redPixels.length; down += browserFontSize) {
                            i++;
                            if (redPixels[down + x]) {
                                points++;
                            }
                        }
                        if (points / i < 0.4) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                }
            }
        }
        function judgeCenter() {
            const firstPointIndex = redPixels.findIndex((e) => e > 0);
            const y = Math.trunc(firstPointIndex / browserFontSize);
            const upLeftPointX = firstPointIndex % browserFontSize;
            let upRightPointX: number = 0;
            const upPointLine = redPixels.slice(y * browserFontSize, (y + 1) * browserFontSize);
            for (let i = browserFontSize - 1; i >= 0; i--) {
                if (upPointLine[i]) {
                    upRightPointX = i;
                    break;
                }
            }
            const upCenterX: number = (upLeftPointX + upRightPointX) / 2;

            let downLeftPointX: number = 0, downRightPointX: number = 0, downCenterX: number = 0;
            for (let y = browserFontSize - 1; y > 0; y--) {
                const downPointLine = redPixels.slice(y * browserFontSize, (y + 1) * browserFontSize).filter((e: number) => e);
                if (downPointLine.length) {
                    for (let i = 0; i < browserFontSize; i++) {
                        if (downPointLine[i]) {
                            downLeftPointX = i;
                            break;
                        }
                    }
                    for (let i = browserFontSize - 1; i >= 0; i--) {
                        if (downPointLine[i]) {
                            downRightPointX = i;
                            break;
                        }
                    }
                    break;
                }
            }
            downCenterX = (downRightPointX + downLeftPointX) / 2;
            return upCenterX > downCenterX;
        }
    }

    function makeImgDataURL(imgData: ImageData, ctx: any) {
        ctx.canvas.width = imgData.width;
        ctx.canvas.height = imgData.height;
        ctx.putImageData(imgData, 0, 0);
        const imgDataURL: string = ctx.canvas.toDataURL('image/png');
        ctx.canvas.width = ctx.canvas.height = 0;
        return imgDataURL;
    }
    function findRedPointXHorizontal(y: number, redPointArr: Uint8ClampedArray, width: number) {
        const line = redPointArr.slice(y * width, (y + 1) * width);
        return line.findIndex((e) => e > 0);

    }

    function drawChars(chars: string[], browserFontSize: number, charsPerLine: number, rowIndexBeginDraw?: number, isSeperator?: boolean) {
        const offsetX = 10;
        let i = rowIndexBeginDraw || 1;
        for (let j = 0; j < Math.ceil(chars.length / charsPerLine); i++, j++) {
            const str = chars.slice(j * charsPerLine, (j + 1) * charsPerLine).join("");
            if (str) {
                ctx.fillText(str, offsetX, browserFontSize * i);
            }
        }
        return i;
    }
    function drawSeperator(rowIndex: number, fontName: string, offsetX: number) {
        let i = rowIndex;
        const seperator = `--------------------`;
        ctx.fillText(seperator, offsetX, browserFontSize * i);
        i += 1;
        ctx.fillText(fontName, offsetX, browserFontSize * i);
        i += 1;
        ctx.fillText(seperator, offsetX, browserFontSize * i);
        return i + 1;
    }

    function findRedsBorder(imageData: ImageData, rgbaComponent?: "red" | "green" | "blue" | "alpha" | "all") {
        //RGBα 四个数为一个像素，单色判断减少资源消耗.（默认红色）
        const { width, height } = imageData;
        //无指定像素返回原图坐标
        if (!imageData.data.filter((e) => e > 0).length) {
            return {
                x1: 0,
                y1: 0,
                x2: width - 1,
                y2: height - 1,
                widthBox: width,
                heightBox: height,
            };
        };

        let rgbaIndex = 0;
        const components = ["red", "green", "blue", "alpha"];
        rgbaComponent ? rgbaIndex = components.indexOf(rgbaComponent) : 0;
        const componentPoints = imageData.data.filter((e: number, i: number) => (i) % 4 == rgbaIndex);
        let x1, y1, x2, y2;


        if (rgbaIndex == -1) {
            //所有像素左边
            for (let i = 0; i < width * 4; i += 4) {
                let findX1;
                for (let y = 0; y < height && !findX1; y++) {
                    const a = imageData.data[y * width * 4 + i + 3];
                    if (a == 0) continue;
                    const r = imageData.data[y * width * 4 + i];
                    if (r > 0) {
                        x1 = i / 4;
                        findX1 = 1;
                        break;
                    }
                    const g = imageData.data[y * width * 4 + i + 1];
                    if (g > 0) {
                        x1 = i / 4;
                        findX1 = 1;
                        break;
                    }
                    const b = imageData.data[y * width * 4 + i + 2];
                    if (b > 0) {
                        x1 = i / 4;
                        findX1 = 1;
                        break;
                    }

                }
            }
            //右边
            for (let i = width * 4 - 1; i > -1; i -= 4) {
                let findX2;
                for (let y = 0; y < height && !findX2; y++) {
                    const a = imageData.data[y * width * 4 + i];
                    if (a == 0) continue;
                    const r = imageData.data[y * width * 4 + i - 3];
                    if (r > 0) {
                        x2 = i / 4;
                        findX2 = 1;
                        break;
                    }
                    const g = imageData.data[y * width * 4 + i - 2];
                    if (g > 0) {
                        x2 = i / 4;
                        findX2 = 1;
                        break;
                    }
                    const b = imageData.data[y * width * 4 + i - 1];
                    if (b > 0) {
                        x2 = i / 4;
                        findX2 = 1;
                        break;
                    }

                }
            }
            //顶边
            for (let y = 0; y < height; y++) {
                let findy1;
                for (let i = 0; i < width * 4 && !findy1; i += 4) {
                    const a = imageData.data[y * width * 4 + i + 3];
                    if (!a) continue;
                    const r = imageData.data[y * width * 4 + i];
                    if (r > 0) {
                        y1 = y;
                        findy1 = 1;
                        break;
                    }
                    const g = imageData.data[y * width * 4 + i + 1];
                    if (g > 0) {
                        y1 = y;
                        findy1 = 1;
                        break;
                    }
                    const b = imageData.data[y * width * 4 + i + 2];
                    if (b > 0) {
                        y1 = y;
                        findy1 = 1;
                        break;
                    }

                }
            }
            //底边
            for (let y = height - 1; y > -1; y--) {
                let findy2;
                for (let i = 0; i < width * 4 && !findy2; i += 4) {
                    const a = imageData.data[y * width * 4 + i + 3];
                    if (!a) continue;
                    const r = imageData.data[y * width * 4 + i];
                    if (r > 0) {
                        y2 = y;
                        findy2 = 1;
                        break;
                    }
                    const g = imageData.data[y * width * 4 + i + 1];
                    if (g > 0) {
                        y2 = y;
                        findy2 = 1;
                        break;
                    }
                    const b = imageData.data[y * width * 4 + i + 2];
                    if (b > 0) {
                        y2 = y;
                        findy2 = 1;
                        break;
                    }

                }
            }

        } else {
            //行由上向下↓，列由左向右→查找 y1
            for (let y = 0; y < height; y++) {
                if (findRedPointXHorizontal(y, componentPoints, width) != -1) {
                    y1 = y;
                    break;
                }
            }
            //列由左向右，行由上向下查找 x1
            for (let x = 0; x < width; x++) {
                let find;
                for (let y = 0; y < height; y++) {
                    if (componentPoints[y * width + x] > 0) {
                        find = 1;
                        break;
                    }
                }
                if (find) {
                    x1 = x;
                    break;
                }
            }
            //列从右向左←，行从上向下↓查找，x2
            for (let x = width - 1; x >= 0; x--) {
                let find;
                for (let y = 0; y < height; y++) {
                    if (componentPoints[y * width + x] > 0) {
                        find = 1;
                        break;
                    }
                }
                if (find) {
                    x2 = x;
                    break;
                }
            }
            //行由下向上↑，列由左向右→查找，y2
            for (let y = (height - 1); y >= 0; y--) {
                let find;
                for (let x = 0; x < width; x++) {
                    if (componentPoints[y * width + x] > 0) {
                        find = 1;
                        break;
                    }
                }
                if (find) {
                    y2 = y;
                    break;
                }
            }
        }
        return {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            widthBox: x2! - x1! + 1,
            heightBox: y2! - y1! + 1,
        };
    }
}
function makeSelector(pageIndex: number) {
    return `#viewer.pdfViewer .page:nth-child(${pageIndex}) .canvasWrapper`;
}
export async function getFontInfo(thisPdfFonts?: any) {
    const g_F_ByPage: any = {};
    const fontInfoObj: any = {};
    const pdfItemID = (await prepareReader("pagesLoaded"))("pdfItemID");
    const pages = (await prepareReader("pagesLoaded"))("pages");
    let idRenderFinished;
    for (let i = 0; i < 100; i++) {
        let find = false;
        for (const page of pages) {
            const renderingState = page.renderingState;
            if (renderingState == 3) {
                idRenderFinished = page.id;
                find = true;
                break;
            }
        }
        if (find) break;
        await Zotero.Promise.delay(10);
    }
    const document1 = (await prepareReader("pagesLoaded"))("documentPDFView");
    const ctx = getCtx(idRenderFinished, document1);
    const fontSimpleInfoArr = [];
    const itemsAll: PDFItem[] = [];

    for (const page of pages) {
        const g_F_FontObj: any = {};
        const pdfPage = page.pdfPage;
        const textContent = await pdfPage.getTextContent();
        const items = textContent.items;
        itemsAll.push(...items);
        for (const e of items) {
            const loadedName = e.fontName;
            if (!e.chars) continue;
            const charFontName = e.chars[0]?.fontName;
            if (!g_F_FontObj[charFontName]) {
                g_F_FontObj[charFontName] = loadedName;
            }
            if (fontInfoObj[loadedName]) {
                continue;
            }
            let common;
            let n = 0;
            while (!(common = pdfPage.commonObjs.has(loadedName)) && n++ < 50) {
                await page.pdfPage.getOperatorList();
            }
            if (common) {
                const font: any = JSON.parse(JSON.stringify(pdfPage.commonObjs.get(loadedName)));
                fontInfoObj[loadedName] = font;
            }
        }
        g_F_ByPage[page.id] = g_F_FontObj;
    };

    //将尽可能多的该字体对应的字符收集全
    for (const loadedName of Object.keys(fontInfoObj)) {
        //跳过已经有图像和红点数目的字体
        const font = fontInfoObj[loadedName];
        if (thisPdfFonts) {
            const thisPdfFontName = thisPdfFonts.fontName;
            const fontName = font.name.replace(regFontName, "");
            if (thisPdfFontName == fontName && thisPdfFonts.hasFontImg && thisPdfFonts.redPointNumbers) {
                continue;
            }
        }
        const charsObj: any = {};
        const strsOfloadedName = itemsAll.filter((item: PDFItem) =>
            item.fontName == loadedName && item.str && !(item.str == "" || item.str == " "
            )).map((item: PDFItem) => item.str);
        //strsOfloadedName = [...new Set(strsOfloadedName)];
        strsOfloadedName.filter((str: string) => {
            for (const char of str.replace(/ +/g, "")) {
                charsObj[char] ? charsObj[char] += 1 : charsObj[char] = 1;
            }
        });
        //const charsArr = Object.keys(charsObj).filter((char: string) => char != " ");
        const charsArr = Object.keys(charsObj);
        font.charsArr = charsArr;
        font.strs = strsOfloadedName.sort((a: string, b: string) => b.length - a.length).slice(0, 3);
        //确定识别方案
        for (const type of Object.keys(fontStyleJudgeType)) {
            const judgeCharArr = fontStyleJudgeType[(type as unknown) as keyof typeof fontStyleJudgeType];
            if (charsArr.some((char: string) => judgeCharArr.includes(char))) {
                font.styleJudgeType = type;
                font.judgeCharArr = judgeCharArr;
                break;
            }

        }
        const fontSimpleInfo = await identifyRedPointAndItalic(font, ctx, pdfItemID);
        if (fontSimpleInfo) {
            fontSimpleInfoArr.push(fontSimpleInfo);
        }
    };
    identityFontStyle(fontSimpleInfoArr);
    return {
        g_F_ByPage: g_F_ByPage,
        fontInfoObj: fontInfoObj,
        fontName: "fontName",
        fontSimpleInfoArr: fontSimpleInfoArr
    };
}

export function judgeType(arr: string[], str: string) {
    return arr.some((char: string) => str.includes(char));
}
/**
 * 保存对象到磁盘
 * 键为字体名
 * 
 * 含有字体名、红点数，pdfItemID
 * @param fontSimpleInfoArr 
 * @param fromDisk 
 * @returns 
 */
export const saveDiskFontSimpleInfo = async (fontSimpleInfoArr: any[], fromDisk?: any) => {
    if (!fromDisk) {
        fromDisk = await readJsonFromDisk(fontStyleFileName);
    }
    if (!fromDisk) {
        fromDisk = {};
    }
    //清理掉image
    const obj = JSON.parse(JSON.stringify(fontSimpleInfoArr));
    obj.filter((obj: any) => {
        obj.charImg ? delete obj.charImg : () => { };
        obj.charsImg ? delete obj.charsImg : () => { };
    });
    obj.filter((e: any) => e).filter((fontSimpleInfo: any) => {
        fromDisk[fontSimpleInfo.fontName] = fontSimpleInfo;
        /* if (!fromDisk[fontSimpleInfo.fontName]) {
        } */
    });
    await saveJsonToDisk(fromDisk, fontStyleFileName);

    const fileInfo = await getFileInfo(getPathDir(fontStyleFileName).path);
    let fileSize;
    if (!fileInfo) {
        fileSize = 0;
    } else {
        fileSize = fileInfo.size;
    }

    showInfo(
        getString("info-dataWriteToDiskSuccess") + getString("info-fileInfo-size") + fileSizeFormat(fileSize));
    //返回合并后的数据
    return fromDisk;
};

/* export const makeFontInfoNote = async (fontSimpleInfo: any, boldRedPointArr?: number[]) => {
    if (!addon.data.noteMaker) {
        const option = {
            title: "Font Style Collection",
            collectionName: "fontCollection",
        };
        addon.data.noteMaker = new NoteMaker(option);
    }
    const fontInfoNoteMaker = addon.data.noteMaker;
    fontInfoNoteMaker.selectTargetCollection("fontCollection");
    fontInfoNoteMaker.addContent("粗体红点数:\n" + boldRedPointArr);
    const excludeFields = ["loadName", "isItalic", "chars", "charsImg", "isBoldItalic", "isBold"];
    const usedFields = Object.keys(Object.values(fontSimpleInfo)[0] as any)
        .filter((field: string) => !excludeFields.includes(field));
    const dataArr = Object.values(fontSimpleInfo).map((obj: any) =>
        usedFields.map((field: string) => obj[field]));
    const header = usedFields;
    const tableIndex = "tableFontInfo";
    fontInfoNoteMaker.addTable(dataArr, header, tableIndex);
    const noteID = await fontInfoNoteMaker.makeNote();
    return noteID;
}; */

export function getCtx(idRenderFinished: number, documentViewer: Document) {

    const selector = makeSelector(idRenderFinished);
    let canvas = documentViewer.querySelector("#fontCheck") as HTMLCanvasElement;
    if (canvas) {
        return canvas.getContext("2d", { alpha: false });
    }
    const canvasWrapper = documentViewer.querySelector(selector);
    const size = 40;
    canvas = documentViewer.createElement("canvas");
    canvas.id = "fontCheck";
    if (canvasWrapper) {
        canvasWrapper!.appendChild(canvas);
    }
    canvas.width = canvas.height = size;
    return canvas.getContext("2d", { alpha: false });
}
export async function clearCanvas() {
    const document = (await prepareReader("pagesLoaded"))("documentPDFView");
    const canvas = document.querySelector("#fontCheck");
    if (canvas) {
        canvas.width = canvas.height = 0;
    }

}

export const identityFontStyle = (fontSimpleInfoArr: any[]) => {
    //暂不考虑半粗体
    const redPointThisPdfArr: number[] = [];
    fontSimpleInfoArr.filter((fontSimpleInfo: any) => {
        if (fontSimpleInfo.redPointNumbers) {
            redPointThisPdfArr.push(fontSimpleInfo.redPointNumbers);
        }
    });
    redPointThisPdfArr.sort((a, b) => b - a);
    const boldRedPointArr: number[] = [];
    for (const fontSimpleInfo of fontSimpleInfoArr) {
        /* if (/(Bold$)|(\.B(\+\d+)?$)|(Heavey$)|(Black$)|(-Semibold$)|(-Bold-)/mi.test(fontSimpleInfo.fontName)) {
            fontSimpleInfo.style = "bold";
            fontSimpleInfo.isBold = "true";
            if (fontSimpleInfo.redPointNumbers) {
                boldRedPointArr.push(fontSimpleInfo.redPointNumbers);
            }
        } else if (/(BoldItal$)|(.BI$)|(-SemiboldIt$)|(BoldItalic$)/mi.test(fontSimpleInfo.fontName)) {
            fontSimpleInfo.style = "boldItalic";
            fontSimpleInfo.isBoldItalic = "true";
            if (fontSimpleInfo.redPointNumbers) {
                boldRedPointArr.push(fontSimpleInfo.redPointNumbers);
            }
        } else if (/(Italic$)|(RegularIt$)|(\.I$)|(Oblique$)|(-LightIt$)|(-It$)/mi.test(fontSimpleInfo.fontName)) {
            fontSimpleInfo.style = "italic";
            fontSimpleInfo.isItalic = "true";
        } else if (/\bRegular\b/i.test(fontSimpleInfo.fontName)) {
            fontSimpleInfo.style = "Regular";

        } */
        const isSuccess = judgeFontStyleByName(fontSimpleInfo, boldRedPointArr);
        if (!isSuccess) {
            //canvas渲染字体判断字体格式
            //由于渲染的字母不同，粗体红点数各异
            /* fontSimpleInfo.redPoint >= boldRedPointArr.slice(-1)[0] ? fontSimpleInfo.style = "bold" : judgePdfFontStyle(fontSimpleInfo); */
            judgePdfFontStyle(fontSimpleInfo);
            if (fontSimpleInfo.isItalic) {
                fontSimpleInfo.style == "bold" || fontSimpleInfo.style == "boldItalic" ? fontSimpleInfo.style = "boldItalic" : fontSimpleInfo.style = "italic";
            }
            //主观判断结果暂不记录
            /* if (fontSimpleInfo.redPointNumbers && fontSimpleInfo.style.includes("bold")) {
                boldRedPointArr.push(fontSimpleInfo.redPointNumbers);
            } */
        }
    }
    boldRedPointArr.sort();
    return boldRedPointArr;

    function judgePdfFontStyle(fontSimpleInfo: any) {
        const boldCutoffUnit = 7;
        const boldCutoff = boldCutoffUnit * fontSimpleInfo.browserFontSize;
        //const index = redPointNumbersThisPdfArr.indexOf(fontSimpleInfo.redPointNumbers);
        if (fontSimpleInfo.redPointNumbers > boldCutoff) {
            fontSimpleInfo.style = "bold";
        } else {
            fontSimpleInfo.style = "";
        }
    }
};

export function judgeFontStyleByName(fontSimpleInfo: any, boldRedPointArr: number[]) {
    if (/(Bold$)|(\.B(\+\d+)?$)|(Heavey$)|(Black$)|(-Semibold$)|(-Bold-)/mi.test(fontSimpleInfo.fontName)) {
        fontSimpleInfo.isBold = "true";
        if (fontSimpleInfo.redPointNumbers) {
            boldRedPointArr.push(fontSimpleInfo.redPointNumbers);
        }
        return fontSimpleInfo.style = "bold";
    } else if (/(BoldItal$)|(.BI$)|(-SemiboldIt$)|(BoldItalic$)/mi.test(fontSimpleInfo.fontName)) {
        fontSimpleInfo.isBoldItalic = "true";
        if (fontSimpleInfo.redPointNumbers) {
            boldRedPointArr.push(fontSimpleInfo.redPointNumbers);
        }
        return fontSimpleInfo.style = "boldItalic";
    } else if (/(Italic$)|(RegularIt$)|(\.I$)|(Oblique$)|(-LightIt$)|(-It$)/mi.test(fontSimpleInfo.fontName)) {
        fontSimpleInfo.isItalic = "true";
        return fontSimpleInfo.style = "italic";
    } else if (/\bRegular\b/i.test(fontSimpleInfo.fontName)) {
        return fontSimpleInfo.style = "Regular";
    } else return;
}

export async function capturePdfWorkerMessage() {
    const reader = await ztoolkit.Reader.getReader() as _ZoteroTypes.ReaderInstance;
    await reader._waitForReader;
    let port;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    while (!(port = reader._iframeWindow?.wrappedJSObject?.PDFViewerApplication?.pdfLoadingTask?._worker?._port)) {
        await Zotero.Promise.delay(0.5);
    }
    port.addEventListener("message", (event: MessageEvent) => {
        //ztoolkit.log(event.target, event.data.data);
        if (event.data.data && event.data.data[1] == "Font") {
            const loadedName = event.data.data[2].loadedName;
            const name = event.data.data[2].name.replace(/^[A-Z]{6}\+/m, "");
            pdfFontInfo[loadedName] = name;
            ztoolkit.log("pdfLoadingTask._worker._port:", "loadedName", loadedName, ", name:", name);
        }

        //获取pageDate
        //if (event.data.data && event.data.data.structuredText) {
        //    ztoolkit.log("页面结构化数据获取成功: ", event.data.data.pageLabel);
        //}

    });
}

export async function redPointCollectToDisk(boldRedPointArr: number[]) {
    const boldRedPointArrFromDisk: number[] = await readJsonFromDisk("boldRedPointArr");
    let initialLength = 0;
    if (boldRedPointArrFromDisk && boldRedPointArrFromDisk.length) {
        initialLength = boldRedPointArrFromDisk.length;
        if (boldRedPointArr.length) {
            boldRedPointArr.push(...boldRedPointArrFromDisk);
        }
    }
    if (boldRedPointArr.length > initialLength) {
        await saveJsonToDisk(boldRedPointArr, "boldRedPointArr");
    }
}

