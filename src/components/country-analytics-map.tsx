type CountryRow = { country_code: string; name: string; views: number; clicks: number };

const countryCentres: Record<string, readonly [number, number]> = {
  US: [39,-98], CA: [57,-106], MX: [23,-102], GT: [15,-90], CR: [10,-84], PA: [9,-80],
  CU: [22,-79], DO: [19,-70], JM: [18,-77], BR: [-10,-52], AR: [-38,-64], CL: [-30,-71],
  CO: [4,-73], PE: [-10,-76], VE: [8,-66], GB: [54,-2], IE: [53,-8], IS: [65,-19],
  FR: [46,2], DE: [51,10], NL: [52,5], BE: [50.5,4.5], LU: [49.8,6.1], ES: [40,-4],
  PT: [39.5,-8], IT: [42.5,12.5], CH: [47,8], AT: [47.5,14.5], DK: [56,10],
  NO: [62,10], SE: [61,16], FI: [64,26], PL: [52,19], CZ: [49.8,15.5],
  SK: [48.7,19.7], HU: [47,19], RO: [46,25], BG: [42.7,25.5], GR: [39,22],
  UA: [49,32], RU: [60,90], TR: [39,35], GE: [42,44], IL: [31.5,35],
  SA: [24,45], AE: [24,54], QA: [25.3,51.2], EG: [26,30], MA: [32,-6],
  NG: [9,8], GH: [7.9,-1], KE: [0,38], ZA: [-29,24], ET: [9,40],
  IN: [22,79], PK: [30,69], BD: [24,90], LK: [7,81], NP: [28,84],
  CN: [35,103], JP: [37,138], KR: [36,128], TW: [23.7,121], HK: [22.3,114.2],
  MO: [22.2,113.5], MN: [46,104], TH: [15,101], VN: [16,108], KH: [12.5,105],
  MY: [4,109], SG: [1.35,103.8], ID: [-2,118], PH: [12,122], AU: [-25,134],
  NZ: [-41,174], FJ: [-17.8,178]
};

function position(latitude: number, longitude: number) {
  return {
    x: ((longitude + 180) / 360) * 900,
    y: ((84 - latitude) / 144) * 380 + 10,
  };
}

export function CountryAnalyticsMap({ countries }: { countries: CountryRow[] }) {
  const peak = countries.reduce((maximum, row) => Math.max(maximum, row.views), 0);
  const plotted = countries.flatMap((row) => {
    const centre = countryCentres[row.country_code];
    if (!centre) return [];
    const point = position(centre[0], centre[1]);
    return [{ ...row, ...point, radius: 4 + Math.sqrt(row.views / Math.max(peak, 1)) * 9 }];
  });

  return <div className="analytics-country-map-wrap">
    <svg className="analytics-country-map" viewBox="0 0 900 390" role="img"
      aria-label={`World map showing ${plotted.length} countries with consented analytics data`}>
      <path className="analytics-map-land" d="M58 72 89 53 130 43 165 57 197 54 230 68 249 88 282 96 292 120 278 139 263 142 248 162 230 165 216 188 197 196 186 219 164 217 150 196 130 190 119 173 98 171 89 153 72 143 63 123 48 104Z"/>
      <path className="analytics-map-land" d="M247 190 267 194 281 210 295 223 305 240 311 261 304 281 291 298 287 321 274 343 260 361 246 346 244 327 231 310 230 289 219 270 225 249 218 229 228 211Z"/>
      <path className="analytics-map-land" d="M326 44 346 28 378 23 405 33 413 50 395 66 371 71 350 60Z"/>
      <path className="analytics-map-land" d="M408 82 437 62 467 58 493 66 510 84 526 91 537 109 527 126 510 132 494 147 480 142 465 156 446 145 428 134 411 117 396 102Z"/>
      <path className="analytics-map-land" d="M435 150 459 142 484 150 502 173 500 197 512 220 506 245 494 268 483 295 467 319 451 309 443 285 432 266 427 240 415 220 418 198 407 177 418 160Z"/>
      <path className="analytics-map-land" d="M510 55 540 38 578 36 610 44 643 39 682 47 709 61 746 59 775 75 813 77 841 96 858 118 849 139 829 151 805 145 790 166 771 160 756 177 739 171 725 192 707 180 690 164 672 158 660 143 641 153 625 141 611 123 591 119 575 102 553 101 537 85 519 79Z"/>
      <path className="analytics-map-land" d="M737 218 756 210 779 218 795 236 821 244 836 261 832 284 815 296 795 287 779 275 758 271 744 250Z"/>
      <path className="analytics-map-land" d="M851 322 864 315 876 322 870 338 858 340Z"/>
      <path className="analytics-map-graticule" d="M0 105H900M0 200H900M0 295H900M225 0V390M450 0V390M675 0V390"/>
      {plotted.map((row) => <g key={row.country_code}>
        <circle className="analytics-country-halo" cx={row.x} cy={row.y} r={row.radius + 5}/>
        <circle className="analytics-country-dot" cx={row.x} cy={row.y} r={row.radius}>
          <title>{row.name}: {row.views.toLocaleString("en-GB")} views</title>
        </circle>
      </g>)}
    </svg>
    <p className="analytics-map-caption">Marker size reflects consented views. The map uses approximate country centres, not visitor coordinates. Countries without a mapped centre remain in the table below.</p>
  </div>;
}
