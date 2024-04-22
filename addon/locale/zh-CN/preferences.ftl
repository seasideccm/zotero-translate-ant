pref-title = 翻山蚁
pref-descript = zotero7 笔记翻译插件
pref-translateSetting = 翻译设置
pref-descript-untranslatedLanguage = 离线语种识别采用 franc 库，但偶有错误。可屏蔽翻译经常识别错误的语种。
pref-enable =
    .label = 开启
pref-bilingualContrast = 
    .label = 双语对照
pref-isSourceFirst = 
    .label = 原文在前
pref-isTargetFirst = 
    .label = 译文在前
pref-handleContentBeforeTitle = 如何处理标题前面的内容？
pref-bilingualSetting = 双语设置
pref-moveToArticleEnd =
    .label = 移到文章末尾
pref-moveToPageEnd = 
    .label = 移到页面末尾
pref-moveAfterTitle =
    .label = 移到标题之后
pref-deleteIt =
    .label = 删除
pref-nothingToDo =
    .label = 不做处置
pref-isPay =
    .label = 允许付费翻译
pref-isPreferredSameService =
    .label = 优先切换同一翻译引擎账号
pref-isPreferredHasSecretKey =
    .label = 优先切换有秘钥的翻译引擎
pref-isPriority =
    .label = 按优先顺序切换翻译引擎
pref-isSkipLocal =
    .label = 屏蔽 Zotero 界面语言的翻译
pref-untranslatedLanguage = 屏蔽翻译
pref-input = 输入
pref-imageViewer = 看图设置
pref-thumbnailSize = 缩略图大小
pref-windowSizeOnViewImage = 看图时窗口状态
pref-backgroundColorDialogImgViewer = 图库对话框背景颜色
pref-thumbnailSizeSmall = 
    .label = 小
pref-thumbnailSizeMedium = 
    .label = 中
pref-thumbnailSizeLarge = 
    .label = 大
pref-maxScreen =
    .label = 最大化
pref-fullScreen =
    .label = 全屏
pref-originScreen =
    .label = 窗口不变
pref-about = 关于
pref-version = { $name } 版本 { $version } { $time } 作者：{ $author } 单位：北戴河医院
pref-multi-account-manage = 翻译引擎多账户管理
pref-underUse = 当前使用的翻译引擎和秘钥：
pref-multi-service = 翻译引擎
pref-secretKey =
    .value = 秘钥
pref-addRecord = 添加记录
pref-addRecordBulk = 批量添加记录
pref-importSecretKeysFromFile = 点击 批量添加记录 从文件导入，或直接将文件拖拽到表格内。
pref-importSecretKeysFromClipboard= 复制粘贴：先复制账号信息（不含翻译引擎名字），然后点击选中下方账号信息表格，CTRL+V 粘贴即可。
pref-limitMode = 额度限制方式
pref-saveLimitParam = 保存限制参数
pref-QPS = 每秒请求次数
pref-charasLimit = 字符数量限制
pref-charasLimitFactor = 字符数量限制的系数
pref-charasPerTime = 每次请求字符数
pref-hasSecretKey = 
    .label = 是否带秘钥
pref-isMultiParas = 
    .label = 多段翻译
pref-secretKey-charConsum = 字符消耗量
pref-secretKeyUsable = 
    .label = 可用状态
pref-servicePriorityWithKey = 带秘钥翻译引擎优先顺序
pref-servicePriorityWithoutKey = 免秘钥翻译引擎优先顺序
pref-secretKey-help = 添加记录：点击 添加记录 按钮；
pref-secretKey-help1 = 编辑记录：双击单元格开始编辑，数据自动保存；
pref-secretKey-help2 = 删除记录：选中单行或多行按 DELETE 或 backspace 回退键删除。
pref-switchService = 选用该翻译引擎
pref-forbiddenService = 禁用该翻译引擎
pref-recoverService =  恢复所有禁用的引擎
pref-Priority-help = 排序：选中行，上下键调整顺序；批量禁用：选中单行或多行，按 delete 或 backspace 键禁用。
pref-sourceLang = 原文语言
pref-targetLang = 目标语言
pref-restoreDefultColor = 恢复默认颜色

pref-help = { $name } Build { $version } { $time }

pref-selectAll = 
    .label= 全选

pref-addonMenuLocation = 插件菜单位于标题栏的位置
pref-rightMenuLocation= 
    .label = 最小化按钮之前
pref-leftMenuLocation= 
    .label = 帮助菜单之后
pref-serviceSelectMode=翻译引擎选择方式
pref-addRecordBulkTooltip = 第一行为翻译引擎名字，然后每行一条记录，字段分隔符支持 "#,;，；" 或制表符的任意组合，可有空行, 至少含有 appID 和 secretKey 秘钥（或 token）两个字段的信息。
pref-enableEncrypt =
    .label = 启用加密
pref-cryProtect = 安全设置
pref-updateCryptoKey = 更新 RSA 公钥私钥
pref-updateCryptoKey1 = RSA 公钥和私钥保存在同一目录下使用，请妥善保管。
pref-updateCryptoKey2 = RSA 公钥私钥用来对 AES 秘钥加解密。
pref-updateCryptoKey3 = 更新 RSA 公钥私钥，将会先解密已经加密的内容，然后重新加密。

pref-addOldCryKey = 导入 RSA 公钥私钥
pref-addOldCryKey1 = RSA 公钥和私钥需要在同一目录下
pref-addOldCryKey2 = RSA 公钥和私钥导入的格式为 pem
pref-setEnableEncryptTip = 对翻译账号的秘钥加解密，以免泄露造成损失
pref-deleteSourceFile = 
    .label = 文件加密后删除源文件
pref-deleteSourceFileTip = 请谨慎选择，做好备份，否则仅能通过解密恢复
pref-editRSAfileName = 编辑 RSA 秘钥文件名
pref-editRSAfileNameTip = 点击按钮，然后修改对应的文件名，确认修改后将修改插件数据库中的记录，如若加密秘钥存储目录内有已经在使用的秘钥，则同时修改其文件名，对未使用的秘钥文件名不做改动。
pref-cryptoProtectRun = 加密保护运行中，RSA 公钥私钥已就绪。
pref-openCryptoDirectory = 打开 RSA 秘钥目录
pref-selectRSADirectory = 选择 RSA 秘钥目录
pref-LLM-settings = 大语言模型设置
pref-LLM-provider = 模型厂家
pref-providerCustom = 指定模型厂家
pref-baseURL = 接口地址
pref-modelsList = 模型列表
pref-connectivityCheck =  测试通信
pref-defaultModel = 默认模型