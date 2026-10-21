// How each player's standing for the next IPL differs from what their career numbers say,
// keyed by player id (see players.js). Career numbers can't see recent form, a breakout
// season, decline or retirement, so these adjust the Arena Rating by hand.
//
// change: points added to (or taken off) the player's Arena Rating
// note:   why, in one line with the evidence; shown on the player card and given to the AI analyst
//
// Keep it to clear, checked cases, and review it before each new season. This list was
// reviewed in October 2026 for IPL 2027, from IPL 2025-26 numbers (ESPNcricinfo, Cricsheet),
// T20 internationals from January 2025 and announced retirements, injuries and bans.
export const PLAYER_OUTLOOK = {
  // ─── Rated up ───
  "kartik-tyagi": { change: 18, note: "IPL 2026: 18 wkts in 14 matches, econ 9.76, KKR's leading wicket-taker after going unsold in 2025" }, // Kartik Tyagi
  "sakib-hussain": { change: 17, note: "IPL 2026 debut season: 15 wkts in 11 matches, econ 9.45, 4/24 on debut" }, // Sakib Hussain
  "kartik-sharma": { change: 16, note: "Settled CSK's No. 4 in 2026: 295 runs at SR 137 with two fifties" }, // Kartik Sharma
  "vaibhav-sooryavanshi": { change: 16, note: "IPL 2026 Orange Cap and MVP: 776 runs at SR 237 with a record 72 sixes; 2025: 35-ball hundred" }, // Vaibhav Sooryavanshi
  "brijesh-sharma": { change: 15, note: "IPL 2026 debut season for RR: 14 wkts in 13 matches, econ 9.89" }, // Brijesh Sharma
  "jamie-overton": { change: 15, note: "IPL 2026: 14 wkts in 10 matches, econ 8.89, plus 136 runs at SR 158; T20 World Cup: 9 wkts at econ 7.5" }, // Jamie Overton
  "praful-hinge": { change: 14, note: "IPL 2026: 14 wkts in only 7 matches (4/34 on debut), though econ 11.73" }, // Praful Hinge
  "finn-allen": { change: 13, note: "IPL 2026: 349 runs at SR 214 (2nd highest) with a maiden IPL hundred; T20Is 2025-26: 522 runs at SR 205, 33-ball World Cup semi-final hundred" }, // Finn Allen
  "rasikh-salam": { change: 13, note: "IPL 2026: 19 wkts in 12 matches for champions RCB, econ 9.45, avg 21.3" }, // Rasikh Salam
  "sai-sudharsan": { change: 13, note: "IPL 2026: 722 runs at SR 158 (3rd most); 2025 Orange Cap with 759 runs" }, // Sai Sudharsan
  "anshul-kamboj": { change: 12, note: "IPL 2026: 21 wkts in 14 matches (joint 4th), avg 25.2" }, // Anshul Kamboj
  "donovan-ferreira": { change: 12, note: "IPL 2026: 317 runs in 15 matches at SR 179, avg 35" }, // Donovan Ferreira
  "eshan-malinga": { change: 12, note: "IPL 2026: 20 wkts in 15 matches, econ 9.33; 2025: 13 wkts in 7" }, // Eshan Malinga
  "nathan-ellis": { change: 12, note: "T20Is 2025-26: 26 wkts in 19 at econ 7.7, World Cup player of the match (4/12)" }, // Nathan Ellis
  "prabhsimran-singh": { change: 12, note: "PBKS top scorer in 2026: 510 runs at SR 169; 2025: 549 runs" }, // Prabhsimran Singh
  "abhishek-sharma": { change: 11, note: "IPL 2026: 563 runs at SR 205 with 135*; 2025: 439 runs at SR 193; T20Is: ICC No. 1 T20I batter: 859 runs at SR 194 (2025), 956 at SR 202 (2026)" }, // Abhishek Sharma
  "prince-yadav": { change: 11, note: "IPL 2026: 16 wkts in 14 matches, econ 8.82, about 1 below the league" }, // Prince Yadav
  "allah-ghazanfar": { change: 10, note: "IPL 2026: 15 wkts in 11 matches, MI's leading wicket-taker" }, // Allah Ghazanfar
  "angkrish-raghuvanshi": { change: 10, note: "KKR's top scorer in 2026: 422 runs at SR 147 before an injury ended his season" }, // Angkrish Raghuvanshi
  "mukul-choudhary": { change: 10, note: "IPL 2026: 170 runs at SR 142 including a match-winning 54* off 27 balls" }, // Mukul Choudhary
  "pathum-nissanka": { change: 10, note: "T20Is 2025: 625 runs at SR 149; 2026 World Cup hundred v Australia" }, // Pathum Nissanka
  "rajat-patidar": { change: 10, note: "IPL 2026: 501 runs at SR 193; captained RCB to back-to-back titles" }, // Rajat Patidar
  "shai-hope": { change: 10, note: "T20Is 2026: 601 runs at avg 50, SR 152, two hundreds v India in October; West Indies captain" }, // Shai Hope
  "cooper-connolly": { change: 8, note: "IPL 2026 debut season: 491 runs at SR 163, avg 44.6, with 107*" }, // Cooper Connolly
  "corbin-bosch": { change: 8, note: "T20 World Cup: 11 wkts at econ 7.6" }, // Corbin Bosch
  "jacob-bethell": { change: 8, note: "England's top World Cup scorer (280 runs, SR 152) with a semi-final hundred" }, // Jacob Bethell
  "krunal-pandya": { change: 8, note: "IPL 2026: 14 wkts at econ 8.41 plus 226 runs at SR 146; key in two RCB title runs" }, // Krunal Pandya
  "priyansh-arya": { change: 8, note: "IPL 2026: 364 runs at SR 212; 2025: 475 runs with a hundred" }, // Priyansh Arya
  "ryan-rickelton": { change: 8, note: "IPL 2026: 448 runs at SR 187 with a franchise-record 123*" }, // Ryan Rickelton
  "salil-arora": { change: 8, note: "SRH regular in 2026: 14 matches, 156 runs at SR 159" }, // Salil Arora
  "aiden-markram": { change: 7, note: "T20 World Cup: 286 runs at SR 165, captain of the Team of the Tournament" }, // Aiden Markram
  "devdutt-padikkal": { change: 7, note: "IPL 2026: 464 runs at SR 169 for champions RCB" }, // Devdutt Padikkal
  "dushmantha-chameera": { change: 7, note: "T20Is 2025-26: 45 wkts in 28, including 5/24 v England" }, // Dushmantha Chameera
  "matt-henry": { change: 7, note: "T20Is 2025-26: 27 wkts, NZ's leading World Cup pacer" }, // Matt Henry
  "jacob-duffy": { change: 6, note: "T20Is 2025-26: 44 wkts in 31 at avg 20" }, // Jacob Duffy
  "lungisani-ngidi": { change: 6, note: "T20 World Cup: 12 wkts at econ 7.2, Team of the Tournament" }, // Lungisani Ngidi
  "sherfane-rutherford": { change: 6, note: "T20Is 2026: 535 runs at avg 67, SR 178" }, // Sherfane Rutherford
  "shivang-kumar": { change: 6, note: "Uncapped SRH all-rounder: 9 wickets in 2026" }, // Shivang Kumar
  "tilak-varma": { change: 6, note: "T20Is 2026: 658 runs at SR 153; now India's T20I vice-captain" }, // Tilak Varma
  "jason-holder": { change: 5, note: "IPL 2026: 17 wkts in 11 matches at econ 7.56, avg 17; now 34" }, // Jason Holder
  "kagiso-rabada": { change: 5, note: "IPL 2026 Purple Cap: 29 wkts in 17 matches, avg 21.6" }, // Kagiso Rabada
  "heinrich-klaasen": { change: 4, note: "IPL 2026: 624 runs at SR 160, avg 48 (5th most); 2025: 487 runs with a hundred" }, // Heinrich Klaasen
  "shubman-gill": { change: 2, note: "IPL 2026: 732 runs at SR 163 (2nd most), captained GT to the final; T20Is: dropped from India's World Cup T20I squad; no T20Is in 2026" }, // Shubman Gill

  // ─── Rated down ───
  "ajinkya-rahane": { change: -40, note: "Retired from all formats in July 2026" }, // Ajinkya Rahane
  "ben-duckett": { change: -30, note: "Withdrew from IPL 2026 days before the season; reported two-season ban covers 2027" }, // Ben Duckett
  "ms-dhoni": { change: -30, note: "Missed all of IPL 2026 with a calf injury; aged 45 and undecided on 2027" }, // MS Dhoni
  "vijay-shankar": { change: -25, note: "Retired from domestic cricket and the IPL in May 2026" }, // Vijay Shankar
  "liam-livingstone": { change: -15, note: "IPL 2026: 2 matches, 15 runs, didn't bowl, dropped by SRH; 2025: 112 runs at SR 133; T20Is: dropped by England in 2025 and lost his central contract" }, // Liam Livingstone
  "steve-smith": { change: -15, note: "Unsold at the 2026 auction, no IPL since 2021" }, // Steve Smith
  "umesh-yadav": { change: -15, note: "Unsold in 2025, no IPL in 2025 or 2026; aged 38" }, // Umesh Yadav
  "yash-dayal": { change: -15, note: "Missed IPL 2026 (left the squad for personal reasons); availability for 2027 unclear" }, // Yash Dayal
  "jake-fraser-mcgurk": { change: -14, note: "Unsold at the 2026 auction; 2025: 55 runs in 6 innings; T20Is: one T20I since January 2025" }, // Jake Fraser-McGurk
  "rinku-singh": { change: -13, note: "Two seasons under 300 runs: 2026 295 at SR 149; 2025 206 at SR 154; T20Is 2026: 152 runs at SR 139, dropped after July" }, // Rinku Singh
  "shimron-hetmyer": { change: -13, note: "IPL 2026: 78 runs in 7 innings at SR 113, dropped by RR for form" }, // Shimron Hetmyer
  "shivam-dube": { change: -13, note: "IPL 2026: 270 runs at SR 159 and 5 overs bowled; 2025: 357 runs at SR 132; T20Is 2026: 539 runs at SR 164 but bowling econ 11.5, quiet since the World Cup" }, // Shivam Dube
  "nicholas-pooran": { change: -12, note: "Down year in 2026: 234 runs at SR 128, after 524 at SR 196 in 2025" }, // Nicholas Pooran
  "marcus-stoinis": { change: -11, note: "Bats well (2026: 216 runs at SR 180) but bowling no longer a weapon: econ 12.5; T20Is 2025-26: 171 runs at SR 132" }, // Marcus Stoinis
  "ishant-sharma": { change: -10, note: "Aged 38; 2025: 4 wkts at econ 11.2, no 2026 appearance found" }, // Ishant Sharma
  "jitesh-sharma": { change: -10, note: "IPL 2026: 116 runs in 12 innings at SR 122; 2025: 261 runs at SR 176" }, // Jitesh Sharma
  "lockie-ferguson": { change: -10, note: "IPL 2026: 1 wkt in 3 matches at econ 12.8; only 4 matches in 2025" }, // Lockie Ferguson
  "marco-jansen": { change: -10, note: "IPL 2026: 9 wkts in 13 matches at avg 54, econ 10.2, 51 runs" }, // Marco Jansen
  "mustafizur-rahman": { change: -10, note: "Released before IPL 2026 and didn't play; eligibility for 2027 unclear" }, // Mustafizur Rahman
  "rishabh-pant": { change: -10, note: "IPL 2026: 312 runs at SR 138 and gave up the LSG captaincy; 2025: 269 runs at SR 133" }, // Rishabh Pant
  "ruturaj-gaikwad": { change: -10, note: "IPL 2026: 337 runs at SR 123, the slowest of anyone with 300+; 2025: 5 matches" }, // Ruturaj Gaikwad
  "sam-curran": { change: -10, note: "Missed all of IPL 2026 (groin injury); 2025: 114 runs, 1 wkt at econ 11" }, // Sam Curran
  "trent-boult": { change: -10, note: "IPL 2026: 2 wkts in 5 matches at econ 11.6, dropped for form; turns 38 before IPL 2027" }, // Trent Boult
  "mohammad-shami": { change: -9, note: "Two weak seasons: 2026 12 wkts at avg 38; 2025 6 wkts at econ 11.2" }, // Mohammad Shami
  "naman-dhir": { change: -9, note: "IPL 2026: 318 runs at SR 147; 2025: 252 runs; squad-level output" }, // Naman Dhir
  "suryakumar-yadav": { change: -9, note: "IPL 2026: 270 runs at SR 148, avg 20.8, down from 717 runs in 2025; T20Is: sacked as India T20I captain and dropped in June 2026" }, // Suryakumar Yadav
  "travis-head": { change: -9, note: "Two seasons below his 2024 peak: 2026 410 runs at SR 170, avg 27; T20Is 2025-26: 242 runs at avg 17, SR 142" }, // Travis Head
  "avesh-khan": { change: -8, note: "Expensive two seasons running: 2026 6 wkts at econ 11.1; 2025 econ 10.3" }, // Avesh Khan
  "david-miller": { change: -8, note: "IPL 2026: 211 runs at SR 154; 2025: 153 runs at SR 128" }, // David Miller
  "kyle-jamieson": { change: -8, note: "T20Is 2025-26: 20 wkts at avg 33, econ 9.8" }, // Kyle Jamieson
  "matheesha-pathirana": { change: -8, note: "IPL 2026: 1 match, then out with calf and hamstring injuries" }, // Matheesha Pathirana
  "mukesh-kumar": { change: -8, note: "IPL 2026: 6 wkts in 10 matches at econ 11.3, avg 58.8; 2025 econ 10.3" }, // Mukesh Kumar
  "rahmanullah-gurbaz": { change: -8, note: "Released and unsold at the 2026 auction; 2025: 74 runs in 5 innings" }, // Rahmanullah Gurbaz
  "ravindra-jadeja": { change: -8, note: "IPL 2026: 266 runs at SR 135, 10 wkts at econ 8.4; solid, not elite, now 37" }, // Ravindra Jadeja
  "alzarri-joseph": { change: -7, note: "back stress fracture: no T20Is in 2026, missed the World Cup" }, // Alzarri Joseph
  "axar-patel": { change: -7, note: "IPL 2026: 173 runs at SR 131, 11 wkts at econ 8.2; 2025: 5 wkts at avg 58" }, // Axar Patel
  "hardik-pandya": { change: -7, note: "IPL 2026: 206 runs at SR 138, 4 wkts at econ 11.4; missed games with back spasms" }, // Hardik Pandya
  "jonny-bairstow": { change: -7, note: "Unsold at the 2026 auction; aged 37" }, // Jonny Bairstow
  "sean-abbott": { change: -7, note: "T20Is 2025-26: 8 wkts at econ 10.2, only a World Cup reserve" }, // Sean Abbott
  "tristan-stubbs": { change: -7, note: "IPL 2026: 275 runs at SR 127; 2025: 300 runs at SR 151" }, // Tristan Stubbs
  "arshdeep-singh": { change: -6, note: "IPL 2026: 14 wkts at econ 10.2, avg 38.6 (2025: 21 wkts at 8.9)" }, // Arshdeep Singh
  "charith-asalanka": { change: -6, note: "T20Is 2026: 156 runs at SR 115, lost the captaincy and his place" }, // Charith Asalanka
  "glenn-phillips": { change: -6, note: "IPL 2026: 67 runs in 5 innings at SR 124; no 2025 innings" }, // Glenn Phillips
  "jasprit-bumrah": { change: -6, note: "Quiet 2026 for wickets (4 in 13 matches) though econ still 8.4; 2025: 18 wkts at 6.7" }, // Jasprit Bumrah
  "michael-bracewell": { change: -6, note: "T20Is 2025: 176 runs at SR 140, 7 wkts; injured in 2026" }, // Michael Bracewell
  "mohammad-siraj": { change: -6, note: "Good, not elite: 2026 19 wkts at econ 9.1; 2025 16 wkts at econ 9.2" }, // Mohammad Siraj
  "pat-cummins": { change: -6, note: "IPL 2026: 8 matches after a lumbar stress injury, 8 wkts at econ 9.6" }, // Pat Cummins
  "rohit-sharma": { change: -6, note: "IPL 2026: 283 runs at SR 157 in 9 games around a hamstring injury; turns 40 in 2027" }, // Rohit Sharma
  "rovman-powell": { change: -6, note: "IPL 2026: 190 runs in 7 innings at SR 135" }, // Rovman Powell
  "wanindu-hasaranga": { change: -6, note: "Missed all of IPL 2026 (hamstring tear); 2025: 11 wkts at econ 9.0" }, // Wanindu Hasaranga
  "dewald-brevis": { change: -5, note: "IPL 2026: 151 runs in 8 innings at SR 128; 2025: 225 runs at SR 180" }, // Dewald Brevis
  "kl-rahul": { change: -4, note: "no T20Is since 2022" }, // KL Rahul
  "tim-seifert": { change: -4, note: "IPL 2026: 19 runs in 3 innings; no 2025 innings; T20Is 2025-26: 988 runs at SR 165, 326 at the World Cup" }, // Tim Seifert
  "noor-ahmad": { change: -3, note: "T20Is 2026: 2 wkts in 6 at econ 11.7 (small sample)" }, // Noor Ahmad
  "william-orourke": { change: -3, note: "no T20Is in 2026, not in NZ's current squad" }, // William Orourke
};
