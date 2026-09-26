/**
 * Entirely fictional sample data for demonstrating the import pipeline end to
 * end. These are made-up names/stats, not real players — the pipeline itself
 * is what matters here; swapping in a real, legally-obtained CSV export uses
 * the exact same parser/normalizer/validator with a different ColumnMapping.
 *
 * Includes a deliberate near-duplicate ("Marcus Whitfield" vs "MARCUS
 * WHITFIELD JR." in the same season) to exercise the name-matching /
 * duplicate-detection path, and a deliberately bad percentage + an
 * implausible height to exercise the validator.
 */
export const SAMPLE_IMPORT_CSV = `name,season,team,heightInches,position,ppg,apg,rpg,spg,bpg,tovPg,fgPct,tpPct,ftPct,tpaPg
Marcus Whitfield,2024-25,RIVER,74,PG,24.5,8.1,4.2,1.4,0.2,2.6,0.47,0.41,0.89,9.5
Dario Kovacic,2024-25,RIVER,81,C,15.2,2.1,10.8,0.6,2.1,1.5,0.58,0.05,0.65,0.3
Terrence Boyd,2024-25,GRANITE,77,SG,18.7,3.4,4.5,1.1,0.4,1.8,0.44,0.38,0.85,7.2
"MARCUS WHITFIELD JR.",2024-25,RIVER,74,PG,24.5,8.1,4.2,1.4,0.2,2.6,0.47,0.41,0.89,9.5
Amara Diallo,2024-25,GRANITE,68,PG,16.4,5.9,3.1,1.9,0.1,2.0,0.43,0.34,0.81,5.4
Bad Data Row,2024-25,EMBERS,142,SF,12.0,2.0,3.0,0.5,0.1,1.0,1.4,0.3,0.7,2.0
`.trim();
