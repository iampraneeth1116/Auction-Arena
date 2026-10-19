// How each player fits into a T20 side, keyed by player id. Each entry lists
// these fields, separated by spaces:
//
//   batting hand    R | L
//   batting order   open (opener) | top (top order) | middle (middle order) | finish (finisher) | tail
//   bowling         RF right-arm pace · LF left-arm pace · OB off-spin · LB leg-spin ·
//                   SLA left-arm finger spin · LWS left-arm wrist spin · - doesn't bowl
//   bowling phases  pp powerplay · mid middle overs · death, comma separated · - none
//   batting style   agg aggressive · bal balanced · anc anchor (optional; batters only)
//
// ? marks a field we don't know, and players missing here are unknown altogether.
// The team judge gives unknowns the benefit of the doubt rather than counting them as gaps.
export const PLAYER_PROFILES = {
  // Marquee
  p_621: 'R tail RF pp,death', // Jasprit Bumrah
  p_622: 'R middle - - agg', // Suryakumar Yadav
  p_101: 'L tail LF pp,death', // Arshdeep Singh
  p_102: 'L middle SLA pp,mid bal', // Axar Patel
  p_103: 'R tail RF pp,death', // Bhuvneshwar Kumar
  p_104: 'R finish RF pp,mid,death agg', // Hardik Pandya
  p_105: 'R middle - - agg', // Heinrich Klaasen
  p_106: 'L open - - agg', // Ishan Kishan
  p_107: 'R tail RF pp,death', // Jofra Archer
  p_108: 'R open - - agg', // Jos Buttler
  p_109: 'L tail RF pp,death', // Josh Hazlewood
  p_110: 'L tail RF pp,death', // Kagiso Rabada
  p_111: 'R open - - anc', // KL Rahul
  p_112: 'L tail LWS mid', // Kuldeep Yadav
  p_114: 'R finish LF pp,mid agg', // Marco Jansen
  p_116: 'R open RF mid agg', // Mitchell Marsh
  p_117: 'L tail LF pp,death', // Mitchell Starc
  p_118: 'R tail RF pp,death', // Mohammad Shami
  p_119: 'R tail RF pp,death', // Mohammad Siraj
  p_120: 'R finish - - agg', // MS Dhoni
  p_121: 'L middle - - agg', // Nicholas Pooran
  p_122: '? tail LWS mid', // Noor Ahmad
  p_123: 'R tail RF pp,death', // Pat Cummins
  p_124: 'R open - - agg', // Phil Salt
  p_125: 'R tail LB mid', // Rashid Khan
  p_126: 'L finish SLA mid bal', // Ravindra Jadeja
  p_127: 'L finish - - agg', // Rinku Singh
  p_128: 'L middle - - agg', // Rishabh Pant
  p_129: 'R open - - agg', // Rohit Sharma
  p_130: 'R open - - anc', // Ruturaj Gaikwad
  p_132: 'R open - - agg', // Sanju Samson
  p_134: 'L middle RF mid agg', // Shivam Dube
  p_135: 'R top - - bal', // Shreyas Iyer
  p_136: 'R open - - anc', // Shubman Gill
  p_137: 'L open OB pp,mid agg', // Sunil Narine
  p_138: 'R finish - - agg', // Tim David
  p_139: 'L open - - agg', // Travis Head
  p_140: 'R tail LF pp', // Trent Boult
  p_141: 'R tail LB mid', // Varun Chakravarthy
  p_142: 'R open - - anc', // Virat Kohli
  p_144: 'L open - - agg', // Yashasvi Jaiswal
  p_145: 'R tail LB mid', // Yuzvendra Chahal

  // Set 1
  p_100: 'R top OB - bal', // Aiden Markram
  p_113: 'R tail RF mid,death', // Lockie Ferguson
  p_115: 'R finish RF mid,death agg', // Marcus Stoinis
  p_131: 'L middle LF pp,death bal', // Sam Curran
  p_133: 'L finish - - agg', // Shimron Hetmyer
  p_143: 'R top OB pp,mid agg', // Will Jacks
  p_271: 'R top RF mid bal', // Cameron Green
  p_272: 'L finish - - agg', // David Miller
  p_274: 'R open - - agg', // Jake Fraser-McGurk
  p_279: 'R middle LB mid agg', // Liam Livingstone
  p_282: 'R tail LB mid', // Wanindu Hasaranga
  p_289: 'L open - - agg', // Quinton de Kock
  p_146: 'L open SLA mid agg', // Abhishek Sharma
  p_150: 'R finish - - bal', // Dhruv Jurel
  p_158: 'R top - - agg', // Rajat Patidar
  p_159: 'R middle LB mid bal', // Riyan Parag
  p_162: 'L open - - anc', // Sai Sudharsan
  p_166: 'L middle - - bal', // Tilak Varma
  p_167: 'R finish - - agg', // Tristan Stubbs
  p_296: 'R tail RF death', // Matheesha Pathirana
  p_304: 'R tail LB mid', // Ravi Bishnoi
  p_172: 'R middle LB - agg', // Dewald Brevis
  p_216: 'R finish ? ? agg', // Ashutosh Sharma
  p_254: 'R finish OB mid agg', // Shashank Singh
  p_264: 'L open - - agg', // Vaibhav Sooryavanshi
  p_193: 'R finish - - agg', // Jitesh Sharma
  p_196: 'R middle RF mid bal', // Nitish Kumar Reddy
  p_240: 'R finish OB - agg', // Naman Dhir

  // Set 2
  p_281: 'L middle RF mid bal', // Venkatesh Iyer
  p_285: 'R open - - agg', // Finn Allen
  p_290: 'R open - - agg', // Rahmanullah Gurbaz
  p_147: 'R tail RF pp,death', // Avesh Khan
  p_148: 'R finish RF pp,mid agg', // Azmatullah Omarzai
  p_149: 'R tail RF pp', // Deepak Chahar
  p_151: 'R middle OB - agg', // Glenn Phillips
  p_152: 'R tail RF death', // Harshal Patel
  p_153: '? tail LF pp', // Khaleel Ahmed
  p_154: 'L finish SLA mid bal', // Krunal Pandya
  p_155: 'R tail RF mid', // Mayank Yadav
  p_156: 'L finish SLA pp,mid bal', // Mitchell Santner
  p_157: 'R tail RF mid,death', // Prasidh Krishna
  p_160: 'R finish RF death agg', // Romario Shepherd
  p_161: 'R finish - - agg', // Rovman Powell
  p_164: 'L finish - - agg', // Sherfane Rutherford
  p_165: '? tail LF death', // T. Natarajan
  p_168: 'L middle OB pp,mid bal', // Washington Sundar
  p_292: 'R tail RF pp,death', // Anrich Nortje
  p_300: 'L tail SLA pp', // Akeal Hosein
  p_301: 'R tail OB pp,mid', // Maheesh Theekshana
  p_303: 'R tail LB mid', // Rahul Chahar
  p_174: 'L top SLA mid bal', // Jacob Bethell
  p_180: 'R tail RF pp,death', // Mukesh Kumar
  p_183: 'L middle OB - bal', // Nitish Rana
  p_185: 'L finish LB mid agg', // Rahul Tewatia
  p_186: 'L open - - agg', // Ryan Rickelton
  p_220: 'R tail LB mid', // Digvesh Rathi
  p_241: 'L middle - - bal', // Nehal Wadhera
  p_245: 'L open - - agg', // Priyansh Arya
  p_188: 'R top - - bal', // Ajinkya Rahane
  p_189: 'L top - - bal', // Devdutt Padikkal
  p_190: 'R tail RF pp,death', // Harshit Rana
  p_198: 'R tail RF pp,death', // Sandeep Sharma
  p_199: 'L finish SLA mid bal', // Shahbaz Ahmed
  p_203: 'L tail LF pp,death', // Yash Dayal
  p_219: 'R open - - agg', // Ayush Mhatre
  p_253: 'R middle ? ? agg', // Sameer Rizvi

  // Set 3
  p_275: 'R open - - agg', // Prithvi Shaw
  p_276: 'R middle - - bal', // Sarfaraz Khan
  p_280: 'L open SLA mid bal', // Rachin Ravindra
  p_163: 'R tail RF pp,mid', // Shardul Thakur
  p_291: 'R tail RF pp', // Akash Deep
  p_181: '? tail LF pp', // Nandre Burger
  p_218: 'R middle OB - bal', // Ayush Badoni
  p_243: 'R open - - agg', // Prabhsimran Singh
  p_195: 'R middle - - anc', // Manish Pandey
  p_197: 'L tail SLA mid', // R. Sai Kishore
  p_200: 'R finish OB - agg', // Shahrukh Khan
  p_201: '? tail RF pp,death', // Tushar Deshpande
  p_202: 'R tail RF mid', // Umran Malik
  p_206: 'L open - - agg', // Abhishek Porel
  p_226: 'L tail SLA mid', // Harpreet Brar
  p_237: '? tail LF pp,death', // Mohsin Khan
  p_250: 'R finish RF mid agg', // Ramandeep Singh
  p_268: 'R tail RF death', // Yash Thakur
  p_295: 'R tail RF pp', // Jacob Duffy
  p_209: 'R top - - bal', // Angkrish Raghuvanshi
  p_235: 'R tail LB mid', // Mayank Markande
  p_259: 'R tail LB mid', // Suyash Sharma
  p_260: '? tail SLA pp,mid', // Swapnil Singh
  p_262: 'R open - - agg', // Urvil Patel

  // Set 4
  p_273: 'L open - - anc', // Devon Conway
  p_297: 'R tail RF pp', // Matt Henry
  p_302: 'R tail OB pp,mid', // Mujeeb Rahman
  p_169: 'R tail OB pp,mid', // Allah Ghazanfar
  p_170: 'R tail RF mid,death', // Brydon Carse
  p_171: 'R finish RF mid,death agg', // Corbin Bosch
  p_173: 'R tail RF pp,death', // Dushmantha Chameera
  p_175: 'R finish RF mid,death agg', // Jamie Overton
  p_176: 'R tail LF pp,death', // Jaydev Unadkat
  p_177: 'L middle SLA mid bal', // Kamindu Mendis
  p_178: 'R top - - bal', // Matthew Breetzke
  p_179: 'R open RF mid agg', // Mitchell Owen
  p_182: 'R tail RF death', // Nathan Ellis
  p_184: 'R tail RF pp,death', // Nuwan Thushara
  p_187: 'R tail RF pp', // Xavier Bartlett
  p_191: 'R tail RF pp', // Ishant Sharma
  p_192: 'R tail OB mid', // Jayant Yadav
  p_194: 'R top - - bal', // Karun Nair
  p_204: 'R finish LB mid agg', // Abdul Samad
  p_205: '? tail RF mid', // Abhinandan Singh
  p_207: '? tail SLA mid', // Ajay Mandal
  p_208: '? tail LF pp', // Akash Singh
  p_210: 'R middle - - agg', // Aniket Verma
  p_211: 'R tail RF pp', // Anshul Kamboj
  p_212: 'L finish - - bal', // Anuj Rawat
  p_213: 'L tail SLA mid', // Anukul Roy
  p_214: 'L tail LF pp', // Arjun Tendulkar
  p_215: 'R top RF mid bal', // Arshin Kulkarni
  p_217: '? tail LF pp,death', // Ashwani Kumar
  p_221: 'R finish OB mid agg', // Donovan Ferreira
  p_222: '? tail RF death', // Eshan Malinga
  p_223: '? tail LF pp', // Gurjapneet Singh
  p_224: '? tail RF mid', // Gurnoor Brar
  p_225: 'L open - -', // Harnoor Pannu
  p_227: '? tail SLA mid', // Harsh Dubey
  p_228: 'R middle - - bal', // Himmat Singh
  p_229: 'R middle - - bal', // Kumar Kushagra
  p_230: '? tail LF pp', // Kwena Maphaka
  p_231: 'L open - - agg', // Lhuan-Dre Pretorious
  p_232: '? tail SLA mid', // M. Siddharth
  p_233: 'R finish RF -', // Madhav Tiwari
  p_234: '? tail SLA mid', // Manav Suthar
  p_236: 'L finish LF mid agg', // Mohd. Arshad Khan
  p_238: '? tail LF pp', // Mukesh Choudhary
  p_239: 'R top SLA mid', // Musheer Khan
  p_242: 'L middle SLA mid bal', // Nishant Sindhu
  p_244: '? tail RF pp', // Prince Yadav
  p_246: 'R middle - -', // Pyla Avinash
  p_247: '? tail LB mid', // Raghu Sharma
  p_248: 'L middle RF mid bal', // Raj Angad Bawa
  p_249: 'R finish RF -', // Ramakrishna Ghosh
  p_251: '? tail RF pp,death', // Rasikh Salam
  p_252: 'L finish - - agg', // Robin Minz
  p_255: 'R tail LB mid', // Shreyas Gopal
  p_256: 'L finish - - agg', // Shubham Dubey
  p_257: 'L middle - -', // Smaran Ravichandaran
  p_258: 'R finish RF mid agg', // Suryansh Shedge
  p_263: 'R tail RF pp', // Vaibhav Arora
  p_265: '? tail LB mid', // Vipraj Nigam
  p_266: 'R middle - - agg', // Vishnu Vinod
  p_267: 'R tail RF death', // Vyshak Vijaykumar
  p_269: '? tail RF mid', // Yudhvir Charak
  p_270: '? tail LB mid', // Zeeshan Ansari

  // Capped all-rounders, keepers and quicks
  p_277: 'R middle OB mid bal', // Deepak Hooda
  p_278: 'R tail RF pp,death', // Gus Atkinson
  p_283: 'R top RF mid bal', // Wiaan Mulder
  p_284: 'L open - - agg', // Ben Duckett
  p_286: 'R middle - - agg', // Jamie Smith
  p_287: 'R open - - agg', // Jonny Bairstow
  p_288: 'R top - - bal', // K.S. Bharat
  p_293: '? tail LF pp', // Fazalhaq Farooqi
  p_294: 'R tail RF mid,death', // Gerald Coetzee
  p_298: 'R tail RF pp', // Shivam Mavi
  p_299: '? tail LF pp', // Spencer Johnson
  p_342: 'R open - - bal', // Mayank Agarawal
  p_343: 'R open - - bal', // Pathum Nissanka
  p_344: 'R top - - agg', // Rahul Tripathi
  p_345: 'R open - - bal', // Reeza Hendricks
  p_346: 'L open - - agg', // Sediqullah Atal
  p_347: 'R top LB - anc', // Steve Smith
  p_348: 'R open - - agg', // Tim Robinson
  p_349: '? tail LF pp,death', // Ben Dwarshuis
  p_350: '? tail LF pp,death', // Daniel Sams
  p_351: 'R middle RF mid bal', // Daryl Mitchell
  p_352: 'R finish RF mid agg', // Dasun Shanaka
  p_353: 'R finish RF pp,death agg', // Jason Holder
  p_354: 'R open OB pp,mid agg', // Matthew Short
  p_355: 'L finish OB pp,mid agg', // Michael Bracewell
  p_356: 'R tail RF death', // Sean Abbott
  p_357: '? tail RF mid', // Zak Foulkes
  p_358: 'R top - - agg', // Benjamin McDermott
  p_359: 'R middle - - agg', // Jordan Cox
  p_360: 'R top - - agg', // Josh Inglis
  p_361: 'R top - - bal', // Kusal Mendis
  p_362: 'L open - - agg', // Kusal Perera
  p_363: 'R top - - anc', // Shai Hope
  p_364: 'R open - - agg', // Tim Seifert
  p_365: 'R open - - agg', // Tom Banton
  p_366: 'R tail RF pp', // Adam Milne
  p_367: '? tail LF pp', // Chetan Sakariya
  p_368: '? tail RF mid', // Kuldeep Sen
  p_369: 'R tail RF pp', // Kyle Jamieson
  p_370: 'R tail RF pp,death', // Lungisani Ngidi
  p_371: 'L tail LF death', // Mustafizur Rahman
  p_372: 'R tail RF pp', // Saqib Mahmood
  p_373: 'R tail RF pp', // Umesh Yadav
  p_374: 'R tail RF pp', // William O'Rourke
  p_375: '? tail LWS mid', // Mohammad Waqar Salamkheil
  p_376: 'R tail LB mid', // Qais Ahmad
  p_377: 'R tail LB mid', // Rishad Hossain
  p_378: 'R tail LB mid', // Viyaskanth Vijayakanth
  p_423: 'R middle RF mid bal', // Beau Webster
  p_425: 'L middle SLA mid bal', // Cooper Connolly
  p_426: 'R top OB mid bal', // Daniel Lawrence
  p_427: 'L finish SLA mid agg', // George Linde
  p_428: 'R finish RF mid agg', // Gulbadin Naib
  p_429: 'R tail LB mid', // Rehan Ahmed
  p_430: 'R finish RF death agg', // Tom Curran
  p_431: 'R finish RF mid agg', // William Sutherland
  p_432: 'R tail RF pp,death', // Alzarri Joseph
  p_433: 'R tail RF pp', // Jhye Richardson
  p_434: '? tail LF pp,death', // Luke Wood
  p_435: 'R tail RF pp', // Navdeep Saini
  p_436: 'R tail RF death', // Naveen Ul Haq
  p_437: 'R tail RF pp', // Richard Gleeson
  p_438: 'R tail RF mid', // Riley Meredith
  p_439: '? tail RF pp', // Shamar Joseph
  p_440: 'R tail RF pp,death', // Taskin Ahmed
  p_463: 'R top - - agg', // Joe Clarke
  p_465: 'L middle - - agg', // Tom Moores
  p_485: 'L middle OB mid bal', // Charith Asalanka
  p_486: 'L finish SLA mid bal', // Dunith Wellalage
  p_487: 'R finish RF death agg', // Dwaine Pretorius
  p_488: 'L tail LF pp', // George Garton
  p_489: 'L open RF mid agg', // Kyle Mayers
  p_490: 'L finish SLA pp,mid bal', // Liam Dawson
  p_492: 'R finish RF mid bal', // Nathan Smith
  p_493: 'R middle OB mid bal', // Roston Chase
  p_494: '? tail LF pp', // Jason Behrendorff
  p_495: 'R tail RF mid', // Joshua Tongue
  p_496: 'R tail RF pp', // Matthew Potts
  p_497: 'R tail RF mid', // Nahid Rana
  p_498: 'R tail RF pp', // Olly Stone
  p_499: 'R tail RF pp', // Sandeep Warrier
  p_500: 'R tail RF pp', // Tanzim Hasan Sakib
  p_537: 'R tail RF pp', // Billy Stanlake
  p_538: '? tail LF pp', // Binura Fernando
  p_539: '? tail LF pp,death', // Joshua Little
  p_540: '? tail LF pp', // Md Shoriful Islam
  p_541: '? tail LF death', // Obed McCoy
  p_542: 'R tail RF mid', // Wesley Agar

  // Uncapped
  p_306: 'R finish - - agg', // Abhinav Manohar
  p_308: 'R top - - bal', // Anmolpreet Singh
  p_309: 'L open - - bal', // Atharva Taide
  p_310: 'R top - - anc', // Yash Dhull
  p_311: 'R tail RF pp', // Auqib Dar
  p_313: 'R tail RF mid', // Kamlesh Nagarkoti
  p_314: 'L middle SLA mid agg', // Mahipal Lomror
  p_315: 'L finish SLA mid', // Prashant Veer
  p_316: 'R tail RF pp', // Rajvardhan Hangargekar
  p_317: 'R finish RF mid agg', // Sanvir Singh
  p_319: 'R finish OB mid', // Tanush Kotian
  p_320: 'R middle RF mid bal', // Vijay Shankar
  p_327: '? tail RF death', // Akash Madhwal
  p_329: '? tail RF pp,death', // Kartik Tyagi
  p_330: '? tail LF pp', // Naman Tiwari
  p_331: '? tail RF pp', // Raj Limbani
  p_332: '? tail RF pp', // Simarjeet Singh
  p_333: '? tail LF pp', // Sushant Mishra
  p_334: '? tail LB mid', // Karn Sharma
  p_335: '? tail SLA mid', // Kumar Kartikeya Singh
  p_336: '? tail LB mid', // Prashant Solanki
  p_338: '? tail LWS mid', // Vignesh Puthur
  p_383: 'R top - - bal', // Manan Vohra
  p_385: 'R open - - agg', // Rohan Kunnummal
  p_386: 'L middle - - agg', // Salman Nizar
  p_387: 'R finish RF mid agg', // Aman Khan
  p_388: '? tail RF death', // Darshan Nalkande
  p_389: '? tail SLA mid', // Harsh Tyagi
  p_394: 'R middle ? ? bal', // Suyash Prabhudessai
  p_395: '? tail SLA mid', // Vicky Ostwal
  p_401: 'R middle - - bal', // Ricky Bhui
  p_405: '? tail RF pp', // K.M Asif
  p_408: '? tail LF pp', // Prithviraj Yarra
  p_411: '? tail RF pp', // Vidwath Kaverappa
  p_415: '? tail LB mid', // Himanshu Sharma
  p_416: '? tail LB mid', // K.C. Cariappa
  p_419: '? tail LB mid', // Murugan Ashwin
  p_420: '? tail LB mid', // Pravin Dubey
  p_449: '? tail SLA mid', // Abid Mushtaq
  p_450: 'R finish RF mid', // Atit Sheth
  p_451: '? tail OB mid', // Hritik Shokeen
  p_452: '? tail SLA mid', // Jagadeesha Suchith
  p_453: '? tail OB mid', // Jalaj Saxena
  p_454: 'L finish RF mid agg', // Manoj Bhandage
  p_456: '? tail SLA mid', // Mayank Dagar
  p_458: '? tail SLA mid', // Tanay Thyagarajann
  p_466: 'R middle - - bal', // Vishnu Solanki
  p_478: '? tail SLA mid', // Dharmendrasinh Jadeja
  p_482: '? tail SLA mid', // Saumy Pandey
  p_515: '? tail SLA mid', // Sanjay Yadav
  p_516: 'L finish SLA mid', // Shams Mulani
  p_518: 'L middle LB mid', // Vivrant Sharma
  p_520: '? tail RF pp', // Ishan Porel
  p_521: '? tail LF pp', // Kulwant Khejroliya
  p_524: '? tail LF pp', // Rajan Kumar
  p_525: '? tail LF pp', // Ravi Kumar
  p_533: '? tail SLA mid', // Rakibul Hasan
  p_596: 'R middle OB mid bal', // Lalit Yadav
};
