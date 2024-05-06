import { frequency } from "./pdfFullText";
import { applyTransform, expandBoundingBox, getPosition, quickIntersectRect, adjacentRect, isExceedBoundary } from '../../utils/tools';
import { OPS } from "../../utils/constant";
import { invertKeyValues } from "../../utils/tools";

const OPS_VK = invertKeyValues(OPS);
export async function getOpsInfo(page: any) {
    let pageLabel = page.pageLabel;
    if (!pageLabel) {
        pageLabel = (page.id as number).toString();
    }

    const imgDataArr: any[] = [];
    const imgDataArrFormXObject: any[] = [];
    const pathDataArr: any[] = [];
    const fontInfo: any = {};
    const fontInfoObj: any = {};
    //todo 通过选项选择是否提取高清大图
    const isExtractOringImg = false;
    const ops = await page.pdfPage.getOperatorList();
    const fnArray: number[] = ops.fnArray;
    const argsArray: any = ops.argsArray;
    const view = page.pdfPage.view || page.viewport.viewBox;
    let state: {
        clipRect: number[];
        currentArgs: number[][];
        clip: boolean;
        currentAction: string;
        savedTimes: number;
        restoreTimes: number;
        //oringinTransform: number[][];
        //多次绘制路径，连续应用 Transform，未save未restore，则需多次保存
        currentTransform: number[][],

    } = {
        currentArgs: [],
        currentAction: 'initiate',
        clip: false,
        savedTimes: 0,
        restoreTimes: 0,
        clipRect: [],
        //oringinTransform: [[...page.viewport.transform]],
        currentTransform: [],

    };
    const stateCache: any[] = [];
    if (fnArray.filter((e: any) => e == 85).length > 100) {
        ztoolkit.log("本页图片太多，可能为矢量图，或者大量小图形，跳过提取");
    }



    /*     const printLog = () => {
            ztoolkit.log("调用成功");
        };
        const action: any = {
            91: printLog,
            printLog: () => {
                ztoolkit.log("调用成功");
            },
        }; */

    /**
     * 状态切换，保存与恢复，主要作用是保证多个 transform 的正确应用
     * @param i 
     */
    function stateSwitch(i: number) {
        if (fnArray[i] == OPS.save) {
            state.savedTimes += 1;
            //通过状态保存恢复机制，可以确保路径图片的 transform 总是相对应的，即使有多个 transform
            stateCache.push(JSON.parse(JSON.stringify(state)));
        }
        if (fnArray[i] == OPS.restore) {
            state = JSON.parse(JSON.stringify(stateCache.pop()));
            state.restoreTimes += 1;
        }

    }

    /**
     * 根据起始结束标志跳过该范围步骤，支持嵌套。递归实现。
     * @param i 
     * @param marker 成对标志，可为多个
     * @returns 
     */
    function jumpAction(i: number,
        marker: {
            beginMarker: string;
            endMarker: string;
        }[],
    ) {

        const endMarker = marker.map((e: any) => {
            if (e.beginMarker == OPS_VK[fnArray[i]]) {
                return e.endMarker;
            }
        }).filter(e => e)[0];
        const otherBeginMarkers = marker.map((e: any) => {
            if (e.beginMarker != OPS_VK[fnArray[i]]) {
                return e.beginMarker;
            }
        }).filter(e => e);

        let j = i + 1;

        for (; j < fnArray.length; j++) {
            stateSwitch(j);
            if (fnArray[j] == OPS[endMarker as keyof typeof OPS]) {
                return j;//按该索引（已执行）继续循环，将按步长递增后继续循环，千万不要加一
            } else if (otherBeginMarkers.includes(OPS_VK[fnArray[j]])) {
                j = jumpAction(j, marker);
            }
            //对于跳过的动作，仍然保存和恢复状态，以免导致不匹配 
        }
        return j;
    }
    for (let i = 0; i < fnArray.length; i++) {
        stateSwitch(i);
        //图片
        if (fnArray[i] == 85) {
            const imgObj: any = {
                pageId: page.id,
                pageLabel: pageLabel || page.id,
                fnId: fnArray[i],
                fnArrayIndex: i,
            };
            if (isExtractOringImg) {
                const name = argsArray[i][0];
                const hasImgData = await page.pdfPage.objs.has(name);
                if (hasImgData) {
                    const imgData = await page.pdfPage.objs.get(name);
                    //const imgData = this.getObject(objId);  class CanvasGraphics 
                    imgObj.imgName = name;
                    imgObj.imgData = imgData;
                }
            }
            //剪切状态下的图片，以剪切路径生成注释，剪切路径的 transform 在判断剪切路径时设置好了
            //非剪切状态的img应当有 transform，无论是否存在值，当下的transform都给对应当前图片
            imgObj.transform = JSON.parse(JSON.stringify(state.currentTransform));
            //当前的状态能够区分剪切路径是否结束
            if (state.clip && pathDataArr.length && pathDataArr.slice(-1)[0].isClip == true) {
                {
                    if (pathDataArr.slice(-1)[0].subObjImg) {
                        pathDataArr.slice(-1)[0].subObjImg.push(imgObj);
                    } else {
                        pathDataArr.slice(-1)[0]["subObjImg"] = [imgObj];
                    }
                }
            } else {
                imgDataArr.push(imgObj);

            }
        }
        //字体
        if (fnArray[i] == 37) {
            const loadedName = argsArray[i][0];
            const common = await page.pdfPage.commonObjs.has(loadedName);
            if (common) {
                const font: any = await page.pdfPage.commonObjs.get(loadedName);
                fontInfo[font.loadedName] = font.name;
                //测试，font.loadedName是否对应多个 font.name
                const tempObj: any = {};
                tempObj[font.name] = 1;
                tempObj.pageId = page.id;
                tempObj.pageLabel = pageLabel;
                tempObj.fnId = fnArray[i];
                tempObj.fnArrayIndex = i;

                fontInfoObj[font.loadedName] ?
                    (fontInfoObj[font.loadedName][font.name] ?
                        fontInfoObj[font.loadedName][font.name] = fontInfoObj[font.loadedName][font.name] + 1
                        : fontInfoObj[font.loadedName][font.name] = 1)
                    : fontInfoObj[font.loadedName] = tempObj;
            }
        }
        //表格
        //const OPS_K = OPS_VK[fnArray[i] as keyof typeof OPS_VK];
        // state[OPS_K] = true;

        /* if (fnArray[i] == OPS.save) {
            state.savedTimes += 1;
            //通过状态保存恢复机制，可以确保路径图片的 transform 总是相对应的，即使有多个 transform
            stateCache.push(JSON.parse(JSON.stringify(state)));
        }
        if (fnArray[i] == OPS.restore) {
            state = stateCache.pop() || state;
            state.savedTimes -= 1;
        } */
        if (fnArray[i] == OPS.transform) {
            state.currentTransform.push([...argsArray[i]]);
        }

        if (fnArray[i] == OPS.endPath) {
            //endPath() { this.consumePath();}
            //即根据 consumePath的路径新建一个 clip，之后的内容只能显示在 clip 范围内
            state.clip = true;
            state.currentAction = "endPath_clip";
            if (pathDataArr.length) {
                /* if (state.currentAction.includes("clip") && pathDataArr.slice(-1)[0].isClip == true) {
                    //剪切套剪接，状态缓存可以保存和还原，判断二次剪切，保存为子对象
                    //还原后为 clip
                    state.currentAction = "clipSecond";
                } else {
                    
                    pathDataArr.slice(-1)[0].isClip = true;
                } */
                //如果事先没有路径，也就不会有剪切
                pathDataArr.slice(-1)[0].isClip = true;
                pathDataArr.slice(-1)[0].transform = JSON.parse(JSON.stringify(state.currentTransform));
            }

        }
        if (fnArray[i] == OPS.beginText) {

            state.currentAction = "text";
            const marker = [{
                beginMarker: "beginText",
                endMarker: "endText"
            }];
            //跳过。包括字体
            i = jumpAction(i, marker);
        }

        if (fnArray[i] == OPS.beginAnnotation) {
            state.currentAction = "annotation";
            //在页面绘制完成后进行，也是 clip
            //向前跳过该操作
            const marker = [{
                beginMarker: "beginAnnotation",
                endMarker: "endAnnotation"
            }];
            i = jumpAction(i, marker);
        }

        if (fnArray[i] == OPS.paintFormXObjectBegin) {
            state.clip = true;
            //除了图片，跳过其他步骤
            const transformFormXObject = argsArray[i][0];
            const bbox = argsArray[i][1];
            let rect_pdf: number[];
            if (Array.isArray(transformFormXObject) && transformFormXObject.length === 6) {
                state.currentTransform.push(...transformFormXObject);
                rect_pdf = getPosition(bbox, transformFormXObject);
            } else {
                rect_pdf = bbox;
            }
            const tempImgArr: any[] = [];
            for (let j = i + 1; j < fnArray.length; j++) {
                stateSwitch(j);
                if (fnArray[j] == OPS.paintImageXObject) {
                    const imgObj: any = {
                        pageId: page.id,
                        pageLabel: pageLabel || page.id,
                        fnId: fnArray[j],
                        fnArrayIndex: j,
                    };
                    if (isExtractOringImg) {
                        const name = argsArray[j][0];
                        const hasImgData = await page.pdfPage.objs.has(name);
                        if (hasImgData) {
                            const imgData = await page.pdfPage.objs.get(name);
                            //const imgData = this.getObject(objId);  class CanvasGraphics 
                            imgObj.imgName = name;
                            imgObj.imgData = imgData;
                        }
                    }
                    let imgRect: number[] = [0, 0, 1, 1];
                    if (!isExceedBoundary(rect_pdf, view, 5)) {
                        imgObj.transform = JSON.parse(JSON.stringify(state.currentTransform));
                        imgObj.clipRect = rect_pdf;//剪切路径的边界（x1，y1，x2，y2）
                        if (state.currentTransform.length) {
                            state.currentTransform.filter((e: any) => { imgRect = getPosition(imgRect, e); });
                            imgObj.imgRectApplyedTm = imgRect;
                            imgObj.rect_pdf = imgRect;
                            if (isExceedBoundary(imgRect, rect_pdf, 0)) {
                                //图片超过剪切边界，仅采用 rect 生成注释，不再判断是否还有其他图形 
                                tempImgArr.length = 0;
                                imgObj.isExceedClip = true;
                                imgObj.rect_pdf = rect_pdf;
                                tempImgArr.push(imgObj);
                                i = j;
                                break;
                            }
                            tempImgArr.push(imgObj);
                        }
                    } else {
                        if (state.currentTransform.length) {
                            state.currentTransform.filter((e: any) => { imgRect = getPosition(imgRect, e); });
                            if (!isExceedBoundary(imgRect, view, 5)) {
                                imgObj.transform = JSON.parse(JSON.stringify(state.currentTransform));
                                imgObj.imgRectApplyedTm = imgRect;
                                imgObj.rect_pdf = imgRect;
                                //imgObj.clipRect = rect; 剪切路径的边界（x1，y1，x2，y2）已经超过页面边界，舍弃
                                tempImgArr.push(imgObj);
                            }
                            //else 图片超过页面边界，舍弃
                        } //else，之前未提供 transform 则可能不是图片
                    }
                }
                if (fnArray[j] == OPS.paintFormXObjectEnd) {
                    i = j;//按该索引（已执行）继续循环，将按步长递增后继续循环
                    break;
                }
                if (fnArray[j] == OPS.transform) {
                    state.currentTransform.push([...argsArray[j]]);
                }
            }
            if (tempImgArr.length) {
                imgDataArrFormXObject.push(tempImgArr);
            }
        }



        if (fnArray[i] == OPS.constructPath) {
            const args: any = argsArray[i];
            const fn: number[] = args[0];
            const fnArgs: number[] = args[1];
            const minMax: number[] = args[2];
            //路径类型 曲线、矩形、直线
            const isCurve = fn.filter((e: any) => [15, 16, 17].includes(e)).length ? true : false;
            const isRectangle = fn.includes(19) && !fn.includes(14) && !isCurve ? true : false;
            const isLine = !fn.includes(19) && fn.includes(14) && !isCurve ? true : false;

            //fnArgs数组元素依次为 x，y，width，height
            //第二点坐标 const xw = x + width;  const yh = y + height;
            // const minMaxForBezier = isScalingMatrix ? minMax.slice(0) : null;
            const pathObj: any = {
                constructPathArgs: {
                    ops: fn,
                    args: fnArgs,
                    minMax: minMax,
                },
                pageId: page.id,
                pageLabel: pageLabel,
                fnId: fnArray[i],
                fnArrayIndex: i,
            };
            pathObj.transform = JSON.parse(JSON.stringify(state.currentTransform));
            /* if (state.currentTransform.length) {
                pathObj.transform = JSON.parse(JSON.stringify(state.currentTransform));
            } else {
                pathObj.transform = JSON.parse(JSON.stringify(state.oringinTransform));
            } */
            if (isCurve) {
                pathObj.type = "curve";
                continue;
            }
            if (isLine) {
                pathObj.type = "line";
            }
            if (isRectangle) {
                pathObj.type = "rectangle";

            }
            if (state.clip && pathDataArr.length && pathDataArr.slice(-1)[0].isClip) {
                if (pathDataArr.slice(-1)[0].subObj) {
                    pathDataArr.slice(-1)[0].subObj.push(pathObj);
                } else {
                    pathDataArr.slice(-1)[0]["subObj"] = [pathObj];
                }
            }
            else {
                pathDataArr.push(pathObj);
                state.currentAction = "constructPath";
            }


        }
        if ([20, 21, 22, 23, 24, 25, 26, 27].includes(fnArray[i])) {
            if (pathDataArr.length) {
                pathDataArr.slice(-1)[0].isPaint = true;
            }
        }
        /* 向后遇到非路径绘制的其他结束标志后，认为本次表格绘制结束，但可能是剪切
        28,29,30是剪切
        31, 44, 32, 绘制文字，路径绘制过程中可以绘制文字
        , 63, 65 行内图片
        69, 71 标记内容，可能和是否显示有关
        74, 75 绘制表单内容
        76,77 成组
        78, 79, 80, 81 注释 */

    }

    //makeTable
    const tableArrTemp: any[] = [];


    pathDataArr.forEach((tablePathData: any) => {
        const type = tablePathData.type;
        //先跳过曲线
        if (type == "curve") return;
        if (tablePathData.isClip && !tablePathData.subObj && !tablePathData.subObjImg) {
            return;
        }
        const p1sx: number[] = [];
        const p1sy: number[] = [];
        const p2sx: number[] = [];
        const p2sy: number[] = [];
        const tablePathObj: any = {
            pathData: [tablePathData],
            pageId: page.id,
            pageLabel: pageLabel,
            fnIds: [],
            argsArr: [],
            fnArrayIndexs: [],

        };

        tablePathObj.fnIds.push(tablePathData.fnId);
        tablePathObj.fnArrayIndexs.push(tablePathData.fnArrayIndex);
        tablePathObj.argsArr.push(tablePathData.constructPathArgs);
        //每个路径可能都有自己的transform
        //如果多个路径共用一个transform，todo
        const transform: number[][] = JSON.parse(JSON.stringify(tablePathData.transform));
        const args = tablePathData.constructPathArgs.args;
        //表格线可以是矩形，参数是起点和宽高,可能不止4个参数
        if (tablePathData.type == "rectangle") {
            for (let i = 0; i < args.length;) {
                const x1 = args[i++];
                const y1 = args[i++];
                const x2 = x1 + args[i++];
                const y2 = y1 + args[i++];
                //逐个应用矩阵变换，如何实现矩阵相乘？
                let rect: number[] = [x1, y1, x2, y2];
                if (transform.length) {
                    transform.filter((e: any) => { rect = getPosition(rect, e); });
                }
                p1sx.push(rect[0]);
                p1sy.push(rect[1]);
                p2sx.push(rect[2]);
                p2sy.push(rect[3]);
            }
        }
        //直线坐标是两个点
        if (tablePathData.type == "line") {
            for (let i = 0; i < args.length;) {
                const x1 = args[i++];
                const y1 = args[i++];
                let p: number[] = [x1, y1];
                transform.filter((e: any) => { p = applyTransform(p, e); });
                p1sx.push(p[0]);
                p1sy.push(p[1]);
            }
        }

        //同类型路径，各点矩阵变换后的集合，取最大图形
        const rect: number[] = [];
        if (type == "rectangle") {
            rect.push(Math.min(...p1sx));
            rect.push(Math.min(...p1sy));
            rect.push(Math.max(...p2sx));
            rect.push(Math.max(...p2sy));
        }
        if (type == "line") {
            rect.push(Math.min(...p1sx));
            rect.push(Math.min(...p1sy));
            rect.push(Math.max(...p1sx));
            rect.push(Math.max(...p1sy));
        }
        //接近边界者认为非正文

        if (isExceedBoundary(rect, view, 3)) {
            return;
        }

        tablePathObj.rect_pdf = rect;
        tableArrTemp.push(tablePathObj);
    });

    //递归合并 rect

    const tableArrNoTorlerant = combineRect(tableArrTemp, view);
    const tableArr = combineRect(tableArrNoTorlerant, view, 5);

    const imgClips: any[] = [];
    imgDataArrFormXObject.filter((imgArrTemp: any[]) => {

        if (imgArrTemp.length == 1 && imgArrTemp[0].isExceedClip) {
            imgDataArr.push(imgArrTemp[0]);
        } else {
            const imgInClipArr = combineRect(imgArrTemp, view);
            imgClips.push(...imgInClipArr);
        }

    });


    return {
        imgDataArr: imgDataArr,
        imgClips: imgClips,
        fontInfo: fontInfo,
        fontInfoObj: fontInfoObj,
        tableArr: tableArr
    };
}



/**
 * 递归合并 rect
 * @param obj 
 * @param viewBox 
 * @returns 
 */
export function combineRect(obj: any[], viewBox: number[], tolerance_mm?: number) {
    obj.forEach((e: any) => {
        const r1 = e.rect_pdf;
        if (!r1.length) {
            return;
        }
        for (let i = 0; i < obj.length; i++) {
            if (e == obj[i] || obj[i].rect_pdf.length == 0) {
                continue;
            }
            const r2 = obj[i].rect_pdf;
            if (!r2.length) {
                continue;
            }
            if (quickIntersectRect(r1, r2) || adjacentRect(r1, r2, tolerance_mm)) {
                e.rect_pdf = expandBoundingBox(r1, r2, viewBox) || r2;
                //删除矩形信息，作为递归
                obj[i].old_rect_pdf = [...obj[i].rect_pdf];
                obj[i].rect_pdf.length = 0;
                e["subObj"] ? e.subObj.push(obj[i]) : e.subObj = [obj[i]];
                /* if(e.subObj){
                    e.subObj.push(obj[i])
                }else{
                    e.subObj=[obj[i]]
                }
                e.fnIds.push(...obj[i].fnIds);
                e.fnArrayIndexs.push(...obj[i].fnArrayIndexs);
                e.argsArr.push(...obj[i].argsArr); */
            }
        }
    });

    const over = obj.filter((e: any) => e.rect_pdf.length == 0);
    const newObj = obj.filter((e: any) => e.rect_pdf.length);
    if (!over.length) {
        return newObj;
    } else {
        return combineRect(newObj, viewBox, tolerance_mm);
    }
}


/**
 * 
 * @param arr 
 * @param oddOrEven 1=odd 奇数 一般是坐标 y, 0=Even 偶数，一般是坐标 x
 * @returns 
 */
export function splitArrByOddEvenIndex(arr: any[], oddOrEven: 0 | 1) {
    return arr.filter((e: any, i: number) => i % 2 == oddOrEven);
}
export const getPageData = async (pageIndex: number) => {
    //pageIndex begin from 0
    const reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID) as any;
    const PDFViewerApplication = (reader._iframeWindow as any).wrappedJSObject.PDFViewerApplication;
    await PDFViewerApplication.pdfViewer.pagesPromise;
    const pdfView = reader._internalReader._primaryView;
    if (!pdfView._pdfPages[pageIndex]) {
        let ready = false;
        PDFViewerApplication.pdfViewer.currentPageNumber = pageIndex + 1;
        while (!ready) {
            if (pdfView._pages[pageIndex] && pdfView._pages[pageIndex].originalPage.renderTask?.promise) {
                await pdfView._pages[pageIndex].originalPage.renderTask.promise;
            } else {
                await Zotero.Promise.delay(100);
            }
            if (pdfView._pdfPages[pageIndex]) {
                ready = true;
            }
        }
    }
    const pageData = pdfView._pdfPages[pageIndex];
    pageData.pageIndex = pageIndex;
    return pageData;
};


export async function combineParagraphsWords(pageDateArr: any[]) {
    for (let i = 0, ii = pageDateArr.length; i < ii; i++) {
        const text = [];
        const structuredText = pageDateArr[i].structuredText;
        const { paragraphs } = structuredText;
        //按高度和分栏排序
        for (const paragraph of paragraphs) {
            for (const line of paragraph.lines) {
                // eslint-disable-next-line
                for (const [index, word] of line.words.entries()) {
                    for (const char of word.chars) {
                        //逐个字符放入之前的数组中
                        text.push(char.c);
                    }
                    if (word.spaceAfter) {
                        //仅针对已发现的错误添加的空格进行纠正
                        //否则等于重写底层规则

                        //如果行存在下一个单词
                        if (line.words[index + 1]) {
                            const reg = /^[A-Z]+$/m;
                            const textCurrent = [];
                            for (const char of word.chars) {
                                textCurrent.push(char.c);
                            }
                            const wordNext = line.words[index + 1];
                            const textNext = [];
                            for (const char of wordNext.chars) {
                                textNext.push(char.c);
                            }
                            if (textCurrent.join('') == "f" || textCurrent.join('').match(reg) && textNext.join('').match(reg)) {
                                if (!textCurrent.filter(char => isRTL(char)).length || !textNext.filter(char => isRTL(char)).length) {
                                    const averageCharWidth = (wordNext.rect[2] - word.rect[0]) / (word.chars.length + wordNext.chars.length) * 100 / 100;
                                    const charsGap1 = computeWordSpacingThreshold(word.chars);
                                    const charsGap2 = computeWordSpacingThreshold(wordNext.chars);
                                    const charsGap = (charsGap1 + charsGap2) / 2;
                                    const wordsGap = wordNext.rect[0] - word.rect[2];
                                    if (wordsGap + 0.1 < charsGap) {
                                        continue;
                                    }
                                }
                            }
                        }
                        text.push(' ');
                    }
                }
                if (line !== paragraph.lines.at(-1)) {
                    if (line.hyphenated) {
                        text.pop();
                    }
                    else {
                        text.push(' ');
                    }
                }
            }

            if (paragraph !== paragraphs.at(-1)) {
                text.push('\n');
            } else {
                //页面最后一个段落添加空行
                text.push('\n\n');
                //非后一页结尾添加换页符
                if (i !== ii - 1) {
                    text.push('\f');
                }
            }
            paragraph.text = text.join('');
            text.length = 0;
        }
    }
}


export const boxByParagraphs = (pageDateArr: any[]) => {
    pageDateArr.filter((pageDate: any) => {
        const { paragraphs } = pageDate.structuredText;
        const temp = frequency(paragraphs.map((para: any) => Math.round(para.rect[0] * 10) / 10));
        const xfrequency = temp.objFrequency;
        const xorderByFrequency = temp.itemOrderByFrequency;

    });

    /*     const validBox: any[] = [];
        const invalidBox: any[] = [];
        paragraphs.filter((para:any)=>{
            const box = {para:[para],
                rect:para.rect}
    
            
        }) */

};

const baseTypes = ["BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "S", "B", "S", "WS", "B", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "B", "B", "B", "S", "WS", "ON", "ON", "ET", "ET", "ET", "ON", "ON", "ON", "ON", "ON", "ES", "CS", "ES", "CS", "CS", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "CS", "ON", "ON", "ON", "ON", "ON", "ON", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "ON", "ON", "ON", "ON", "ON", "ON", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "ON", "ON", "ON", "ON", "BN", "BN", "BN", "BN", "BN", "BN", "B", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "BN", "CS", "ON", "ET", "ET", "ET", "ET", "ON", "ON", "ON", "ON", "L", "ON", "ON", "BN", "ON", "ON", "ET", "ET", "EN", "EN", "ON", "L", "ON", "ON", "ON", "EN", "L", "ON", "ON", "ON", "ON", "ON", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "ON", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "L", "ON", "L", "L", "L", "L", "L", "L", "L", "L"];
const arabicTypes = ["AN", "AN", "AN", "AN", "AN", "AN", "ON", "ON", "AL", "ET", "ET", "AL", "CS", "AL", "ON", "ON", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "AL", "AL", "", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "AN", "AN", "AN", "AN", "AN", "AN", "AN", "AN", "AN", "AN", "ET", "AN", "AN", "AL", "AL", "AL", "NSM", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "AL", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "AN", "ON", "NSM", "NSM", "NSM", "NSM", "NSM", "NSM", "AL", "AL", "NSM", "NSM", "ON", "NSM", "NSM", "NSM", "NSM", "AL", "AL", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "EN", "AL", "AL", "AL", "AL", "AL", "AL"];

export function isRTL(char: string) {
    const charCode = char.charCodeAt(0);
    let charType = "L";
    if (charCode <= 0x00ff) {
        charType = baseTypes[charCode];
    }
    else if (0x0590 <= charCode && charCode <= 0x05f4) {
        charType = "R";
    }
    else if (0x0600 <= charCode && charCode <= 0x06ff) {
        charType = arabicTypes[charCode & 0xff];
        if (!charType) {
            console.log("Bidi: invalid Unicode character " + charCode.toString(16));
        }
    }
    else if (0x0700 <= charCode && charCode <= 0x08ac) {
        charType = "AL";
    }
    if (charType === "R" || charType === "AL" || charType === "AN") {
        return true;
    }
    return false;
}

function computeWordSpacingThreshold(chars: any[]) {
    const uniformSpacing = 0.07;
    const wordSpacing = 0.1;
    let char, char2;
    let avgFontSize;
    let minAdjGap: number, maxAdjGap: number, minSpGap: number, maxSpGap: number, minGap: number, maxGap: number, gap: number, gap2: number;
    let i;
    avgFontSize = 0;
    minGap = maxGap = 0;
    minAdjGap = minSpGap = 1;
    maxAdjGap = maxSpGap = 0;
    for (i = 0; i < chars.length; ++i) {
        char = chars[i];
        avgFontSize += char.fontSize;
        if (i < chars.length - 1) {
            char2 = chars[i + 1];
            gap = getSpaceBetweenChars(char, char2) as number;
            if (char.spaceAfter) {
                if (minSpGap > maxSpGap) {
                    minSpGap = maxSpGap = gap;
                }
                else if (gap < minSpGap) {
                    minSpGap = gap;
                }
                else if (gap > maxSpGap) {
                    maxSpGap = gap;
                }
            }
            else if (minAdjGap > maxAdjGap) {
                minAdjGap = maxAdjGap = gap;
            }
            else if (gap < minAdjGap) {
                minAdjGap = gap;
            }
            else if (gap > maxAdjGap) {
                maxAdjGap = gap;
            }
            if (i == 0 || gap < minGap) {
                minGap = gap;
            }
            if (gap > maxGap) {
                maxGap = gap;
            }
        }
    }
    avgFontSize /= chars.length;
    if (minGap < 0) {
        minGap = 0;
    }

    // if spacing is nearly uniform (minGap is close to maxGap), use the
    // SpGap/AdjGap values if available, otherwise assume it's a single
    // word (technically it could be either "ABC" or "A B C", but it's
    // essentially impossible to tell)
    if (maxGap - minGap < uniformSpacing * avgFontSize) {
        if (minAdjGap <= maxAdjGap
            && minSpGap <= maxSpGap
            && minSpGap - maxAdjGap > 0.01) {
            return 0.5 * (maxAdjGap + minSpGap);
        }
        else {
            return maxGap + 1;
        }

        // if there is some variation in spacing, but it's small, assume
        // there are some inter-word spaces
    }
    else if (maxGap - minGap < wordSpacing * avgFontSize) {
        return 0.5 * (minGap + maxGap);

        // if there is a large variation in spacing, use the SpGap/AdjGap
        // values if they look reasonable, otherwise, assume a reasonable
        // threshold for inter-word spacing (we can't use something like
        // 0.5*(minGap+maxGap) here because there can be outliers at the
        // high end)
    }
    else if (minAdjGap <= maxAdjGap
        && minSpGap <= maxSpGap
        && minSpGap - maxAdjGap > uniformSpacing * avgFontSize) {
        gap = wordSpacing * avgFontSize;
        gap2 = 0.5 * (minSpGap - minGap);
        return minGap + (gap < gap2 ? gap : gap2);
    }
    else {
        return minGap + wordSpacing * avgFontSize;
    }
}

function getSpaceBetweenChars(char: any, char2: any) {
    const { rotation } = char;
    return !rotation && char2.rect[0] - char.rect[2]
        || rotation === 90 && char2.rect[1] - char.rect[3]
        || rotation === 180 && char.rect[0] - char2.rect[2]
        || rotation === 270 && char.rect[1] - char2.rect[3];
}

function normalizeRect(clip_p1_p2: any[]): any[] {
    throw new Error("Function not implemented.");
}
