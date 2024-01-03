-- 1

-- 翻山蚁 sqlite 表

-- Valid language ("english," "chines," etc.)
CREATE TABLE
    language (
        langID INTEGER PRIMARY KEY,
        langName TEXT,
        langCode TEXT,
        display INT DEFAULT 1 -- 0 == hide, 1 == display, 2 == primary
    );

CREATE TABLE
    fields (
        fieldID INTEGER PRIMARY KEY,
        fieldName TEXT
    );

-- sourceText
CREATE TABLE
    sourceText (
        itemID INTEGER PRIMARY KEY,
        langCode TEXT NOT NULL,
        sourceText TEXT NOT NULL
    );

-- targetText
CREATE TABLE
    targetText (
        itemID INTEGER NOT NULL,
        langCode TEXT NOT NULL,
        targetText TEXT NOT NULL
    );

-- score
CREATE TABLE
    score (
        itemID INTEGER NOT NULL,
        score INTEGER NOT NULL DEFAULT 0 -- 翻译质量得分，数字升序 1-10
    );

-- translateMode
CREATE TABLE
    translateMode (
        itemID INTEGER NOT NULL,
        translateMode TEXT NOT NULL -- 翻译方式：手工，词典，翻译引擎，人工智能
    );

CREATE TABLE
    items (
        itemID INTEGER PRIMARY KEY,
        dateAdded TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        dateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        clientDateModified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        originID INTEGER,
        originKey TEXT
    );