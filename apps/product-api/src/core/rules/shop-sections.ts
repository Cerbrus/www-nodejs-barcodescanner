const CATEGORY_SECTIONS: Array<[RegExp, string]> = [
    [/diepvries|pizza|maaltijd|salade|soep/, 'gereed-diepvries'],
    [/aardappel|groente|fruit|vegetable|fruits?\b|potato/, 'fruit-groenten'],
    [/zuivel|eieren|kaas|yoghurt|melk|milk|dair|cheese|yogurt|egg/, 'zuivel'],
    [/vlees|kip|vis\b|vega|vleeswaren|meat|fish|poultry/, 'vlees-vis'],
    [/bakkerij|banket|brood|bread|bakery|pastr/, 'brood-gebak'],
    [/ontbijtgranen|beleg|pasta|rijst|wereldkeuken|cereal|rice|spread/, 'graanproducten'],
    [/snoep|koek|chips|chocola|noten|toast|popcorn|tussendoor|candy|confection|biscuit|snack/, 'snacks-snoep'],
    [
        /frisdrank|sappen|koffie|thee|water|bier|wijn|aperitie|drank|cola|juice|beverage|coffee|tea\b|beer|wine/,
        'dranken'
    ],
    [/saus|kruiden|olie|bakken|conserven|suiker|sauce|spice|oil|sugar|baking/, 'ingredienten-kruiden'],
    [/huishoud|schoonmaak|was|afwas|household|clean|laundry/, 'huishouden'],
    [/drogist|verzorging|gezondheid|baby|hygi|care|health/, 'verzorging-gezondheid'],
    [/huisdier|dier|pet\b|cat\b|dog\b/, 'dierenvoeding']
];

export function sectionForCategory(category?: string): string | undefined {
    const text = (category ?? '').toLowerCase();

    return text ? CATEGORY_SECTIONS.find(([pattern]) => pattern.test(text))?.[1] : undefined;
}
