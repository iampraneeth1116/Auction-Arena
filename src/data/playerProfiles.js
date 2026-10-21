// How each player fits into a T20 side, keyed by player id (see players.js). Each entry lists
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
  'jasprit-bumrah': 'R tail RF pp,death', // Jasprit Bumrah
  'suryakumar-yadav': 'R middle - - agg', // Suryakumar Yadav
  'arshdeep-singh': 'L tail LF pp,death', // Arshdeep Singh
  'axar-patel': 'L middle SLA pp,mid bal', // Axar Patel
  'bhuvneshwar-kumar': 'R tail RF pp,death', // Bhuvneshwar Kumar
  'hardik-pandya': 'R finish RF pp,mid,death agg', // Hardik Pandya
  'heinrich-klaasen': 'R middle - - agg', // Heinrich Klaasen
  'ishan-kishan': 'L open - - agg', // Ishan Kishan
  'jofra-archer': 'R tail RF pp,death', // Jofra Archer
  'jos-buttler': 'R open - - agg', // Jos Buttler
  'josh-hazlewood': 'L tail RF pp,death', // Josh Hazlewood
  'kagiso-rabada': 'L tail RF pp,death', // Kagiso Rabada
  'kl-rahul': 'R open - - anc', // KL Rahul
  'kuldeep-yadav': 'L tail LWS mid', // Kuldeep Yadav
  'marco-jansen': 'R finish LF pp,mid agg', // Marco Jansen
  'mitchell-marsh': 'R open RF mid agg', // Mitchell Marsh
  'mitchell-starc': 'L tail LF pp,death', // Mitchell Starc
  'mohammad-shami': 'R tail RF pp,death', // Mohammad Shami
  'mohammad-siraj': 'R tail RF pp,death', // Mohammad Siraj
  'ms-dhoni': 'R finish - - agg', // MS Dhoni
  'nicholas-pooran': 'L middle - - agg', // Nicholas Pooran
  'noor-ahmad': '? tail LWS mid', // Noor Ahmad
  'pat-cummins': 'R tail RF pp,death', // Pat Cummins
  'phil-salt': 'R open - - agg', // Phil Salt
  'rashid-khan': 'R tail LB mid', // Rashid Khan
  'ravindra-jadeja': 'L finish SLA mid bal', // Ravindra Jadeja
  'rinku-singh': 'L finish - - agg', // Rinku Singh
  'rishabh-pant': 'L middle - - agg', // Rishabh Pant
  'rohit-sharma': 'R open - - agg', // Rohit Sharma
  'ruturaj-gaikwad': 'R open - - anc', // Ruturaj Gaikwad
  'sanju-samson': 'R open - - agg', // Sanju Samson
  'shivam-dube': 'L middle RF mid agg', // Shivam Dube
  'shreyas-iyer': 'R top - - bal', // Shreyas Iyer
  'shubman-gill': 'R open - - anc', // Shubman Gill
  'sunil-narine': 'L open OB pp,mid agg', // Sunil Narine
  'tim-david': 'R finish - - agg', // Tim David
  'travis-head': 'L open - - agg', // Travis Head
  'trent-boult': 'R tail LF pp', // Trent Boult
  'varun-chakravarthy': 'R tail LB mid', // Varun Chakravarthy
  'virat-kohli': 'R open - - anc', // Virat Kohli
  'yashasvi-jaiswal': 'L open - - agg', // Yashasvi Jaiswal
  'yuzvendra-chahal': 'R tail LB mid', // Yuzvendra Chahal

  // Set 1
  'aiden-markram': 'R top OB - bal', // Aiden Markram
  'lockie-ferguson': 'R tail RF mid,death', // Lockie Ferguson
  'marcus-stoinis': 'R finish RF mid,death agg', // Marcus Stoinis
  'sam-curran': 'L middle LF pp,death bal', // Sam Curran
  'shimron-hetmyer': 'L finish - - agg', // Shimron Hetmyer
  'will-jacks': 'R top OB pp,mid agg', // Will Jacks
  'cameron-green': 'R top RF mid bal', // Cameron Green
  'david-miller': 'L finish - - agg', // David Miller
  'jake-fraser-mcgurk': 'R open - - agg', // Jake Fraser-McGurk
  'liam-livingstone': 'R middle LB mid agg', // Liam Livingstone
  'wanindu-hasaranga': 'R tail LB mid', // Wanindu Hasaranga
  'quinton-de-kock': 'L open - - agg', // Quinton de Kock
  'abhishek-sharma': 'L open SLA mid agg', // Abhishek Sharma
  'dhruv-jurel': 'R finish - - bal', // Dhruv Jurel
  'rajat-patidar': 'R top - - agg', // Rajat Patidar
  'riyan-parag': 'R middle LB mid bal', // Riyan Parag
  'sai-sudharsan': 'L open - - anc', // Sai Sudharsan
  'tilak-varma': 'L middle - - bal', // Tilak Varma
  'tristan-stubbs': 'R finish - - agg', // Tristan Stubbs
  'matheesha-pathirana': 'R tail RF death', // Matheesha Pathirana
  'ravi-bishnoi': 'R tail LB mid', // Ravi Bishnoi
  'dewald-brevis': 'R middle LB - agg', // Dewald Brevis
  'ashutosh-sharma': 'R finish ? ? agg', // Ashutosh Sharma
  'shashank-singh': 'R finish OB mid agg', // Shashank Singh
  'vaibhav-sooryavanshi': 'L open - - agg', // Vaibhav Sooryavanshi
  'jitesh-sharma': 'R finish - - agg', // Jitesh Sharma
  'nitish-kumar-reddy': 'R middle RF mid bal', // Nitish Kumar Reddy
  'naman-dhir': 'R finish OB - agg', // Naman Dhir

  // Set 2
  'venkatesh-iyer': 'L middle RF mid bal', // Venkatesh Iyer
  'finn-allen': 'R open - - agg', // Finn Allen
  'rahmanullah-gurbaz': 'R open - - agg', // Rahmanullah Gurbaz
  'avesh-khan': 'R tail RF pp,death', // Avesh Khan
  'azmatullah-omarzai': 'R finish RF pp,mid agg', // Azmatullah Omarzai
  'deepak-chahar': 'R tail RF pp', // Deepak Chahar
  'glenn-phillips': 'R middle OB - agg', // Glenn Phillips
  'harshal-patel': 'R tail RF death', // Harshal Patel
  'khaleel-ahmed': '? tail LF pp', // Khaleel Ahmed
  'krunal-pandya': 'L finish SLA mid bal', // Krunal Pandya
  'mayank-yadav': 'R tail RF mid', // Mayank Yadav
  'mitchell-santner': 'L finish SLA pp,mid bal', // Mitchell Santner
  'prasidh-krishna': 'R tail RF mid,death', // Prasidh Krishna
  'romario-shepherd': 'R finish RF death agg', // Romario Shepherd
  'rovman-powell': 'R finish - - agg', // Rovman Powell
  'sherfane-rutherford': 'L finish - - agg', // Sherfane Rutherford
  't-natarajan': '? tail LF death', // T. Natarajan
  'washington-sundar': 'L middle OB pp,mid bal', // Washington Sundar
  'anrich-nortje': 'R tail RF pp,death', // Anrich Nortje
  'akeal-hosein': 'L tail SLA pp', // Akeal Hosein
  'maheesh-theekshana': 'R tail OB pp,mid', // Maheesh Theekshana
  'rahul-chahar': 'R tail LB mid', // Rahul Chahar
  'jacob-bethell': 'L top SLA mid bal', // Jacob Bethell
  'mukesh-kumar': 'R tail RF pp,death', // Mukesh Kumar
  'nitish-rana': 'L middle OB - bal', // Nitish Rana
  'rahul-tewatia': 'L finish LB mid agg', // Rahul Tewatia
  'ryan-rickelton': 'L open - - agg', // Ryan Rickelton
  'digvesh-rathi': 'R tail LB mid', // Digvesh Rathi
  'nehal-wadhera': 'L middle - - bal', // Nehal Wadhera
  'priyansh-arya': 'L open - - agg', // Priyansh Arya
  'ajinkya-rahane': 'R top - - bal', // Ajinkya Rahane
  'devdutt-padikkal': 'L top - - bal', // Devdutt Padikkal
  'harshit-rana': 'R tail RF pp,death', // Harshit Rana
  'sandeep-sharma': 'R tail RF pp,death', // Sandeep Sharma
  'shahbaz-ahmed': 'L finish SLA mid bal', // Shahbaz Ahmed
  'yash-dayal': 'L tail LF pp,death', // Yash Dayal
  'ayush-mhatre': 'R open - - agg', // Ayush Mhatre
  'sameer-rizvi': 'R middle ? ? agg', // Sameer Rizvi

  // Set 3
  'prithvi-shaw': 'R open - - agg', // Prithvi Shaw
  'sarfaraz-khan': 'R middle - - bal', // Sarfaraz Khan
  'rachin-ravindra': 'L open SLA mid bal', // Rachin Ravindra
  'shardul-thakur': 'R tail RF pp,mid', // Shardul Thakur
  'akash-deep': 'R tail RF pp', // Akash Deep
  'nandre-burger': '? tail LF pp', // Nandre Burger
  'ayush-badoni': 'R middle OB - bal', // Ayush Badoni
  'prabhsimran-singh': 'R open - - agg', // Prabhsimran Singh
  'manish-pandey': 'R middle - - anc', // Manish Pandey
  'r-sai-kishore': 'L tail SLA mid', // R. Sai Kishore
  'shahrukh-khan': 'R finish OB - agg', // Shahrukh Khan
  'tushar-deshpande': '? tail RF pp,death', // Tushar Deshpande
  'umran-malik': 'R tail RF mid', // Umran Malik
  'abhishek-porel': 'L open - - agg', // Abhishek Porel
  'harpreet-brar': 'L tail SLA mid', // Harpreet Brar
  'mohsin-khan': '? tail LF pp,death', // Mohsin Khan
  'ramandeep-singh': 'R finish RF mid agg', // Ramandeep Singh
  'yash-thakur': 'R tail RF death', // Yash Thakur
  'jacob-duffy': 'R tail RF pp', // Jacob Duffy
  'angkrish-raghuvanshi': 'R top - - bal', // Angkrish Raghuvanshi
  'mayank-markande': 'R tail LB mid', // Mayank Markande
  'suyash-sharma': 'R tail LB mid', // Suyash Sharma
  'swapnil-singh': '? tail SLA pp,mid', // Swapnil Singh
  'urvil-patel': 'R open - - agg', // Urvil Patel

  // Set 4
  'devon-conway': 'L open - - anc', // Devon Conway
  'matt-henry': 'R tail RF pp', // Matt Henry
  'mujeeb-rahman': 'R tail OB pp,mid', // Mujeeb Rahman
  'allah-ghazanfar': 'R tail OB pp,mid', // Allah Ghazanfar
  'brydon-carse': 'R tail RF mid,death', // Brydon Carse
  'corbin-bosch': 'R finish RF mid,death agg', // Corbin Bosch
  'dushmantha-chameera': 'R tail RF pp,death', // Dushmantha Chameera
  'jamie-overton': 'R finish RF mid,death agg', // Jamie Overton
  'jaydev-unadkat': 'R tail LF pp,death', // Jaydev Unadkat
  'kamindu-mendis': 'L middle SLA mid bal', // Kamindu Mendis
  'matthew-breetzke': 'R top - - bal', // Matthew Breetzke
  'mitchell-owen': 'R open RF mid agg', // Mitchell Owen
  'nathan-ellis': 'R tail RF death', // Nathan Ellis
  'nuwan-thushara': 'R tail RF pp,death', // Nuwan Thushara
  'xavier-bartlett': 'R tail RF pp', // Xavier Bartlett
  'ishant-sharma': 'R tail RF pp', // Ishant Sharma
  'jayant-yadav': 'R tail OB mid', // Jayant Yadav
  'karun-nair': 'R top - - bal', // Karun Nair
  'abdul-samad': 'R finish LB mid agg', // Abdul Samad
  'abhinandan-singh': '? tail RF mid', // Abhinandan Singh
  'ajay-mandal': '? tail SLA mid', // Ajay Mandal
  'akash-singh': '? tail LF pp', // Akash Singh
  'aniket-verma': 'R middle - - agg', // Aniket Verma
  'anshul-kamboj': 'R tail RF pp', // Anshul Kamboj
  'anuj-rawat': 'L finish - - bal', // Anuj Rawat
  'anukul-roy': 'L tail SLA mid', // Anukul Roy
  'arjun-tendulkar': 'L tail LF pp', // Arjun Tendulkar
  'arshin-kulkarni': 'R top RF mid bal', // Arshin Kulkarni
  'ashwani-kumar': '? tail LF pp,death', // Ashwani Kumar
  'donovan-ferreira': 'R finish OB mid agg', // Donovan Ferreira
  'eshan-malinga': '? tail RF death', // Eshan Malinga
  'gurjapneet-singh': '? tail LF pp', // Gurjapneet Singh
  'gurnoor-brar': '? tail RF mid', // Gurnoor Brar
  'harnoor-pannu': 'L open - -', // Harnoor Pannu
  'harsh-dubey': '? tail SLA mid', // Harsh Dubey
  'himmat-singh': 'R middle - - bal', // Himmat Singh
  'kumar-kushagra': 'R middle - - bal', // Kumar Kushagra
  'kwena-maphaka': '? tail LF pp', // Kwena Maphaka
  'lhuan-dre-pretorious': 'L open - - agg', // Lhuan-Dre Pretorious
  'm-siddharth': '? tail SLA mid', // M. Siddharth
  'madhav-tiwari': 'R finish RF -', // Madhav Tiwari
  'manav-suthar': '? tail SLA mid', // Manav Suthar
  'mohd-arshad-khan': 'L finish LF mid agg', // Mohd. Arshad Khan
  'mukesh-choudhary': '? tail LF pp', // Mukesh Choudhary
  'musheer-khan': 'R top SLA mid', // Musheer Khan
  'nishant-sindhu': 'L middle SLA mid bal', // Nishant Sindhu
  'prince-yadav': '? tail RF pp', // Prince Yadav
  'pyla-avinash': 'R middle - -', // Pyla Avinash
  'raghu-sharma': '? tail LB mid', // Raghu Sharma
  'raj-angad-bawa': 'L middle RF mid bal', // Raj Angad Bawa
  'ramakrishna-ghosh': 'R finish RF -', // Ramakrishna Ghosh
  'rasikh-salam': '? tail RF pp,death', // Rasikh Salam
  'robin-minz': 'L finish - - agg', // Robin Minz
  'shreyas-gopal': 'R tail LB mid', // Shreyas Gopal
  'shubham-dubey': 'L finish - - agg', // Shubham Dubey
  'smaran-ravichandaran': 'L middle - -', // Smaran Ravichandaran
  'suryansh-shedge': 'R finish RF mid agg', // Suryansh Shedge
  'vaibhav-arora': 'R tail RF pp', // Vaibhav Arora
  'vipraj-nigam': '? tail LB mid', // Vipraj Nigam
  'vishnu-vinod': 'R middle - - agg', // Vishnu Vinod
  'vyshak-vijaykumar': 'R tail RF death', // Vyshak Vijaykumar
  'yudhvir-charak': '? tail RF mid', // Yudhvir Charak
  'zeeshan-ansari': '? tail LB mid', // Zeeshan Ansari

  // Capped all-rounders, keepers and quicks
  'deepak-hooda': 'R middle OB mid bal', // Deepak Hooda
  'gus-atkinson': 'R tail RF pp,death', // Gus Atkinson
  'wiaan-mulder': 'R top RF mid bal', // Wiaan Mulder
  'ben-duckett': 'L open - - agg', // Ben Duckett
  'jamie-smith': 'R middle - - agg', // Jamie Smith
  'jonny-bairstow': 'R open - - agg', // Jonny Bairstow
  'k-s-bharat': 'R top - - bal', // K.S. Bharat
  'fazalhaq-farooqi': '? tail LF pp', // Fazalhaq Farooqi
  'gerald-coetzee': 'R tail RF mid,death', // Gerald Coetzee
  'shivam-mavi': 'R tail RF pp', // Shivam Mavi
  'spencer-johnson': '? tail LF pp', // Spencer Johnson
  'mayank-agarawal': 'R open - - bal', // Mayank Agarawal
  'pathum-nissanka': 'R open - - bal', // Pathum Nissanka
  'rahul-tripathi': 'R top - - agg', // Rahul Tripathi
  'reeza-hendricks': 'R open - - bal', // Reeza Hendricks
  'sediqullah-atal': 'L open - - agg', // Sediqullah Atal
  'steve-smith': 'R top LB - anc', // Steve Smith
  'tim-robinson': 'R open - - agg', // Tim Robinson
  'ben-dwarshuis': '? tail LF pp,death', // Ben Dwarshuis
  'daniel-sams': '? tail LF pp,death', // Daniel Sams
  'daryl-mitchell': 'R middle RF mid bal', // Daryl Mitchell
  'dasun-shanaka': 'R finish RF mid agg', // Dasun Shanaka
  'jason-holder': 'R finish RF pp,death agg', // Jason Holder
  'matthew-short': 'R open OB pp,mid agg', // Matthew Short
  'michael-bracewell': 'L finish OB pp,mid agg', // Michael Bracewell
  'sean-abbott': 'R tail RF death', // Sean Abbott
  'zak-foulkes': '? tail RF mid', // Zak Foulkes
  'benjamin-mcdermott': 'R top - - agg', // Benjamin McDermott
  'jordan-cox': 'R middle - - agg', // Jordan Cox
  'josh-inglis': 'R top - - agg', // Josh Inglis
  'kusal-mendis': 'R top - - bal', // Kusal Mendis
  'kusal-perera': 'L open - - agg', // Kusal Perera
  'shai-hope': 'R top - - anc', // Shai Hope
  'tim-seifert': 'R open - - agg', // Tim Seifert
  'tom-banton': 'R open - - agg', // Tom Banton
  'adam-milne': 'R tail RF pp', // Adam Milne
  'chetan-sakariya': '? tail LF pp', // Chetan Sakariya
  'kuldeep-sen': '? tail RF mid', // Kuldeep Sen
  'kyle-jamieson': 'R tail RF pp', // Kyle Jamieson
  'lungisani-ngidi': 'R tail RF pp,death', // Lungisani Ngidi
  'mustafizur-rahman': 'L tail LF death', // Mustafizur Rahman
  'saqib-mahmood': 'R tail RF pp', // Saqib Mahmood
  'umesh-yadav': 'R tail RF pp', // Umesh Yadav
  'william-orourke': 'R tail RF pp', // William O'Rourke
  'mohammad-waqar-salamkheil': '? tail LWS mid', // Mohammad Waqar Salamkheil
  'qais-ahmad': 'R tail LB mid', // Qais Ahmad
  'rishad-hossain': 'R tail LB mid', // Rishad Hossain
  'viyaskanth-vijayakanth': 'R tail LB mid', // Viyaskanth Vijayakanth
  'beau-webster': 'R middle RF mid bal', // Beau Webster
  'cooper-connolly': 'L middle SLA mid bal', // Cooper Connolly
  'daniel-lawrence': 'R top OB mid bal', // Daniel Lawrence
  'george-linde': 'L finish SLA mid agg', // George Linde
  'gulbadin-naib': 'R finish RF mid agg', // Gulbadin Naib
  'rehan-ahmed': 'R tail LB mid', // Rehan Ahmed
  'tom-curran': 'R finish RF death agg', // Tom Curran
  'william-sutherland': 'R finish RF mid agg', // William Sutherland
  'alzarri-joseph': 'R tail RF pp,death', // Alzarri Joseph
  'jhye-richardson': 'R tail RF pp', // Jhye Richardson
  'luke-wood': '? tail LF pp,death', // Luke Wood
  'navdeep-saini': 'R tail RF pp', // Navdeep Saini
  'naveen-ul-haq': 'R tail RF death', // Naveen Ul Haq
  'richard-gleeson': 'R tail RF pp', // Richard Gleeson
  'riley-meredith': 'R tail RF mid', // Riley Meredith
  'shamar-joseph': '? tail RF pp', // Shamar Joseph
  'taskin-ahmed': 'R tail RF pp,death', // Taskin Ahmed
  'joe-clarke': 'R top - - agg', // Joe Clarke
  'tom-moores': 'L middle - - agg', // Tom Moores
  'charith-asalanka': 'L middle OB mid bal', // Charith Asalanka
  'dunith-wellalage': 'L finish SLA mid bal', // Dunith Wellalage
  'dwaine-pretorius': 'R finish RF death agg', // Dwaine Pretorius
  'george-garton': 'L tail LF pp', // George Garton
  'kyle-mayers': 'L open RF mid agg', // Kyle Mayers
  'liam-dawson': 'L finish SLA pp,mid bal', // Liam Dawson
  'nathan-smith': 'R finish RF mid bal', // Nathan Smith
  'roston-chase': 'R middle OB mid bal', // Roston Chase
  'jason-behrendorff': '? tail LF pp', // Jason Behrendorff
  'joshua-tongue': 'R tail RF mid', // Joshua Tongue
  'matthew-potts': 'R tail RF pp', // Matthew Potts
  'nahid-rana': 'R tail RF mid', // Nahid Rana
  'olly-stone': 'R tail RF pp', // Olly Stone
  'sandeep-warrier': 'R tail RF pp', // Sandeep Warrier
  'tanzim-hasan-sakib': 'R tail RF pp', // Tanzim Hasan Sakib
  'billy-stanlake': 'R tail RF pp', // Billy Stanlake
  'binura-fernando': '? tail LF pp', // Binura Fernando
  'joshua-little': '? tail LF pp,death', // Joshua Little
  'md-shoriful-islam': '? tail LF pp', // Md Shoriful Islam
  'obed-mccoy': '? tail LF death', // Obed McCoy
  'wesley-agar': 'R tail RF mid', // Wesley Agar

  // Uncapped
  'abhinav-manohar': 'R finish - - agg', // Abhinav Manohar
  'anmolpreet-singh': 'R top - - bal', // Anmolpreet Singh
  'atharva-taide': 'L open - - bal', // Atharva Taide
  'yash-dhull': 'R top - - anc', // Yash Dhull
  'auqib-dar': 'R tail RF pp', // Auqib Dar
  'kamlesh-nagarkoti': 'R tail RF mid', // Kamlesh Nagarkoti
  'mahipal-lomror': 'L middle SLA mid agg', // Mahipal Lomror
  'prashant-veer': 'L finish SLA mid', // Prashant Veer
  'rajvardhan-hangargekar': 'R tail RF pp', // Rajvardhan Hangargekar
  'sanvir-singh': 'R finish RF mid agg', // Sanvir Singh
  'tanush-kotian': 'R finish OB mid', // Tanush Kotian
  'vijay-shankar': 'R middle RF mid bal', // Vijay Shankar
  'akash-madhwal': '? tail RF death', // Akash Madhwal
  'kartik-tyagi': '? tail RF pp,death', // Kartik Tyagi
  'naman-tiwari': '? tail LF pp', // Naman Tiwari
  'raj-limbani': '? tail RF pp', // Raj Limbani
  'simarjeet-singh': '? tail RF pp', // Simarjeet Singh
  'sushant-mishra': '? tail LF pp', // Sushant Mishra
  'karn-sharma': '? tail LB mid', // Karn Sharma
  'kumar-kartikeya-singh': '? tail SLA mid', // Kumar Kartikeya Singh
  'prashant-solanki': '? tail LB mid', // Prashant Solanki
  'vignesh-puthur': '? tail LWS mid', // Vignesh Puthur
  'manan-vohra': 'R top - - bal', // Manan Vohra
  'rohan-kunnummal': 'R open - - agg', // Rohan Kunnummal
  'salman-nizar': 'L middle - - agg', // Salman Nizar
  'aman-khan': 'R finish RF mid agg', // Aman Khan
  'darshan-nalkande': '? tail RF death', // Darshan Nalkande
  'harsh-tyagi': '? tail SLA mid', // Harsh Tyagi
  'suyash-prabhudessai': 'R middle ? ? bal', // Suyash Prabhudessai
  'vicky-ostwal': '? tail SLA mid', // Vicky Ostwal
  'ricky-bhui': 'R middle - - bal', // Ricky Bhui
  'k-m-asif': '? tail RF pp', // K.M Asif
  'prithviraj-yarra': '? tail LF pp', // Prithviraj Yarra
  'vidwath-kaverappa': '? tail RF pp', // Vidwath Kaverappa
  'himanshu-sharma': '? tail LB mid', // Himanshu Sharma
  'k-c-cariappa': '? tail LB mid', // K.C. Cariappa
  'murugan-ashwin': '? tail LB mid', // Murugan Ashwin
  'pravin-dubey': '? tail LB mid', // Pravin Dubey
  'abid-mushtaq': '? tail SLA mid', // Abid Mushtaq
  'atit-sheth': 'R finish RF mid', // Atit Sheth
  'hritik-shokeen': '? tail OB mid', // Hritik Shokeen
  'jagadeesha-suchith': '? tail SLA mid', // Jagadeesha Suchith
  'jalaj-saxena': '? tail OB mid', // Jalaj Saxena
  'manoj-bhandage': 'L finish RF mid agg', // Manoj Bhandage
  'mayank-dagar': '? tail SLA mid', // Mayank Dagar
  'tanay-thyagarajann': '? tail SLA mid', // Tanay Thyagarajann
  'vishnu-solanki': 'R middle - - bal', // Vishnu Solanki
  'dharmendrasinh-jadeja': '? tail SLA mid', // Dharmendrasinh Jadeja
  'saumy-pandey': '? tail SLA mid', // Saumy Pandey
  'sanjay-yadav': '? tail SLA mid', // Sanjay Yadav
  'shams-mulani': 'L finish SLA mid', // Shams Mulani
  'vivrant-sharma': 'L middle LB mid', // Vivrant Sharma
  'ishan-porel': '? tail RF pp', // Ishan Porel
  'kulwant-khejroliya': '? tail LF pp', // Kulwant Khejroliya
  'rajan-kumar': '? tail LF pp', // Rajan Kumar
  'ravi-kumar': '? tail LF pp', // Ravi Kumar
  'rakibul-hasan': '? tail SLA mid', // Rakibul Hasan
  'lalit-yadav': 'R middle OB mid bal', // Lalit Yadav
};
