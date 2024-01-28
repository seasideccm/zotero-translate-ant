import { iso6393 } from 'iso-639-3';

import('iso-639-3').then(module => { const iso6393 = module.iso6393; });

export function zoteroLangCode() {
    const lang = "eng";
    const zoteroLangCode = iso6393.filter((e: any) => e.iso6393 == lang).map((e: any) => e.iso6391);

    ztoolkit.log(iso6393.slice(1820, 1830));
    ztoolkit.log(...zoteroLangCode);
}
