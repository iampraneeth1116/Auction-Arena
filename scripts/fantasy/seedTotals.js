import { prisma } from '../../server/db.js';
import { findPlayer, normalizeName } from '../lib/fantasyScoring.js';

// Seeds players' fantasy totals from the hand-compiled table below: each listed player's
// totals are replaced, and players not in the table are left untouched. For filling a
// fresh database in one go; the daily update then carries on from there.
// Run with `npm run fantasy:upload` (needs DATABASE_URL).

// [player, total points, matches]
const TOTALS = [
  ['Abdul Samad', 69, 2],
  ['Abhinandan Singh', 22, 2],
  ['Abhishek Sharma', 65, 3],
  ['Aiden Markram', 81, 2],
  ['Ajinkya Rahane', 119, 3],
  ['Allah Ghazanfar', -2, 2],
  ['Angkrish Raghuvanshi', 158, 3],
  ['Aniket Verma', 63, 3],
  ['Anrich Nortje', -22, 1],
  ['Anshul Kamboj', 37, 3],
  ['Anukul Roy', -2, 2],
  ['Arshdeep Singh', -12, 3],
  ['Ashok Sharma', -12, 3],
  ['Avesh Khan', 9, 1],
  ['Axar Patel', 11, 3],
  ['Ayush Badoni', 7, 2],
  ['Ayush Mhatre', 88, 3],
  ['Bhuvneshwar Kumar', 10, 2],
  ['Blessing Muzarabani', 14, 2],
  ['Brijesh Sharma', 6, 1],
  ['Cameron Green', 48, 3],
  ['Cooper Connolly', 157, 2],
  ['Corbin Bosch', 15, 1],
  ['David Miller', 93, 3],
  ['David Payne', 2, 2],
  ['Deepak Chahar', -8, 2],
  ['Devdutt Padikkal', 207, 2],
  ['Dhruv Jurel', 176, 3],
  ['Digvesh Rathi', -2, 1],
  ['Donovan Ferreira', -5, 1],
  ['Eshan Malinga', 2, 3],
  ['Finn Allen', 106, 3],
  ['Glenn Phillips', 78, 3],
  ['Hardik Pandya', 40, 2],
  ['Harsh Dubey', 39, 3],
  ['Harshal Patel', -1, 2],
  ['Heinrich Klaasen', 208, 3],
  ['Ishan Kishan', 156, 3],
  ['Jacob Bethell', 8, 1],
  ['Jacob Duffy', 14, 2],
  ['Jamie Overton', 101, 2],
  ['Jasprit Bumrah', 0, 3],
  ['Jaydev Unadkat', 43, 3],
  ['Jitesh Sharma', 14, 2],
  ['Jofra Archer', 28, 3],
  ['Jos Buttler', 195, 3],
  ['Kagiso Rabada', 27, 3],
  ['Kartik Sharma', 29, 3],
  ['Kartik Tyagi', 2, 2],
  ['Khaleel Ahmed', -4, 3],
  ['KL Rahul', 120, 3],
  ['Krunal Pandya', -2, 2],
  ['Kuldeep Yadav', 23, 3],
  ['Kumar Kushagra', 29, 1],
  ['Liam Livingstone', 32, 1],
  ['Lungisani Ngidi', 23, 3],
  ['M Siddharth', 10, 1],
  ['Manish Pandey', 8, 1],
  ['Marco Jansen', 19, 2],
  ['Marcus Stoinis', 1, 2],
  ['Matt Henry', 5, 3],
  ['Matthew Short', -2, 1],
  ['Mayank Markande', 0, 2],
  ['Mitchell Marsh', 63, 2],
  ['Mitchell Santner', 26, 1],
  ['Mohammad Shami', 5, 2],
  ['Mohammad Siraj', -4, 3],
  ['Mohsin Khan', 10, 1],
  ['Mukesh Kumar', 32, 3],
  ['Mukul Choudhary', 12, 2],
  ['Naman Dhir', 82, 3],
  ['Nandre Burger', 9, 3],
  ['Nehal Wadhera', 27, 2],
  ['Nicholas Pooran', 4, 2],
  ['Nitish Kumar Reddy', 139, 3],
  ['Nitish Rana', 41, 3],
  ['Noor Ahmad', 7, 3],
  ['Pathum Nissanka', 112, 3],
  ['Phil Salt', 107, 2],
  ['Prabhsimran Singh', 133, 3],
  ['Prasidh Krishna', 22, 3],
  ['Prashant Veer', 64, 2],
  ['Prince Yadav', 21, 2],
  ['Priyansh Arya', 69, 2],
  ['Rahul Chahar', 2, 1],
  ['Rahul Tewatia', 42, 3],
  ['Rajat Patidar', 136, 2],
  ['Ramandeep Singh', 23, 2],
  ['Rashid Khan', 48, 3],
  ['Ravi Bishnoi', 49, 3],
  ['Ravindra Jadeja', 22, 2],
  ['Rinku Singh', 116, 2],
  ['Rishabh Pant', 125, 2],
  ['Riyan Parag', 66, 3],
  ['Rohit Sharma', 163, 3],
  ['Romario Shepherd', 2, 2],
  ['Ruturaj Gaikwad', 54, 3],
  ['Ryan Rickelton', 150, 3],
  ['Sai Sudharsan', 149, 3],
  ['Salil Arora', 5, 2],
  ['Sameer Rizvi', 210, 3],
  ['Sandeep Sharma', 16, 3],
  ['Sanju Samson', 32, 3],
  ['Sarfaraz Khan', 157, 3],
  ['Shahbaz Ahmed', 10, 1],
  ['Shahrukh Khan', 22, 2],
  ['Shardul Thakur', 11, 3],
  ['Shashank Singh', 26, 2],
  ['Sherfane Rutherford', 51, 3],
  ['Shimron Hetmyer', 51, 2],
  ['Shivam Dube', 98, 3],
  ['Shivang Kumar', 25, 2],
  ['Shreyas Iyer', 108, 2],
  ['Shubman Gill', 171, 2],
  ['Sunil Narine', 26, 2],
  ['Suryakumar Yadav', 107, 3],
  ['Suyash Sharma', 12, 2],
  ['T Natarajan', 20, 3],
  ['Tilak Varma', 76, 3],
  ['Tim David', 126, 2],
  ['Travis Head', 89, 3],
  ['Trent Boult', -14, 2],
  ['Tristan Stubbs', 82, 3],
  ['Tushar Deshpande', 6, 2],
  ['Vaibhav Arora', -6, 2],
  ['Vaibhav Sooryavanshi', 188, 3],
  ['Varun Chakravarthy', -6, 2],
  ['Vyshak Vijaykumar', 22, 2],
  ['Vipraj Nigam', 14, 3],
  ['Virat Kohli', 150, 2],
  ['Washington Sundar', 120, 3],
  ['Xavier Bartlett', 33, 3],
  ['Yashasvi Jaiswal', 251, 3],
  ['Yuzvendra Chahal', 10, 2],
];

async function upload() {
  const writes = [];
  for (const [name, totalPoints, matches] of TOTALS) {
    const player = findPlayer(normalizeName(name));
    if (!player) {
      console.warn(`[upload] No player called ${name} in players.js`);
      continue;
    }
    writes.push(prisma.playerStat.upsert({
      where: { playerId: player.id },
      create: { playerId: player.id, totalPoints, matches },
      update: { totalPoints, matches },
    }));
  }

  // All or nothing, so a failure never leaves half the table applied
  await prisma.$transaction(writes);
  console.log(`[upload] Set totals for ${writes.length} players.`);
}

upload()
  .catch((err) => {
    console.error('[upload] Failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
