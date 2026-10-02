import { RNG } from './engine/rng';
import { uniquePlayerId } from './playerIds';

/** Where a generated player is from. Weight controls how often the league produces players from there. */
export interface Nationality {
  country: string;
  weight: number;
  firstNames: string[];
  lastNames: string[];
}

const USA_FIRST = [
  'Marcus','Jalen','Terrence','Kobe','Deshawn','Miles','Andre','Malik','Trey','Isaiah',
  'Cole','Xavier','Darius','Elijah','Tobias','Roman','Quentin','Bryce','Nate','Zion',
  'Caleb','Dominic','Ezra','Gavin','Julian','Kendrick','Lamar','Maxwell','Preston','Reggie',
  'Silas','Tucker','Vaughn','Wesley','Zeke','Antoine','Brennan','Cyrus','Donte','Grady',
  'Jasper','Tyrese','Jamal','Devin','Keegan','Corey','Brandon','Tyler','Jordan','Cameron',
  'Aaron','Derrick','Dwight','Shawn','Chris','Damian','Anthony','Brady','Colin','Dallas',
  'Emmett','Franklin','Garrett','Hudson','Ira','Jaden','Kelvin','Landon','Marquis','Nolan',
  'Orlando','Parker','Quincy','Rashad','Sterling','Theo','Ulysses','Vince','Weston','Zachary',
  'Amari','Bryson','Carter','Dante','Everett','Finn','Gideon','Harlan','Isiah','Josiah',
  'Kai','Leon','Micah','Nash','Owen','Pierce','Rowan','Sawyer','Tate','Wyatt',
  'Adrian','Bobby','Cedric','Damon','Elton','Frankie','Glenn','Harold','Ivan','Jerome',
  'Keon','Lonnie','Marlon','Norris','Odell','Phillip','Raymond','Sonny','Terrell','Vernon',
  'Warren','Alonzo','Byron','Curtis','Dexter','Emory','Freddie','Grover','Herschel','Irving',
  'Jerry','Kareem','Leroy','Melvin','Nathaniel','Oren','Percy','Ronnie','Stanley','Trent',
  'Ulric','Vito','Wendell','Amos','Boris','Clifton','Delmar','Ellis','Foster','Guy',
  'Hollis','Isaac','Jacques','Kirby','Lorenzo','Manny','Neil','Oswald','Pablo','Quinton',
  'Rodney','Solomon','Titus','Ulysses','Van','Ward','Yusuf','Zane','Abram','Blaine',
  'Cornell','Dashawn','Ellery','Fitzgerald','Grady','Hayden','Ismael','Jaylen','Keyon','Lavelle',
  'Montell','Nasir','Osborne','Payton','Rasheen','Shane','Torrey','Ulyssean','Vashon','Wyland',
  'Alfonzo','Bertram','Chauncey','Deion','Emanuel','Farrell','Grier','Hosea','Idris','Jabari',
  'Khalil','Lawrence','Maurice','Norwood','Octavius','Percival','Rashon','Shaquille','Terence','Ulrich',
  'Vance','Waylon','Xander','Yaw','Zeb','Abner','Bo','Chance','Deacon','Elias',
];
const USA_LAST = [
  'Whitfield','Boyd','Sharpe','Holloway','Prescott','Marsh','Cantrell','Ellison','Grier','Hastings',
  'Jarrett','Kessler','Lockhart','Mercer','Pruitt','Ridley','Thackeray','Underwood','Vance','Winthrop',
  'Yancey','Zeigler','Ashworth','Beaumont','Emerson','Fairweather','Huntington','Jennings','Monroe','Nash',
  'Pemberton','Quinlan','Rourke','Sterling','Thorne','Abbott','Barnett','Caldwell','Dawson','Everhart',
  'Fletcher','Gallagher','Hampton','Ingram','Jacobs','Kendall','Langston','Maddox','Norwood','Oakley',
  'Parrish','Radford','Sheppard','Tillman','Vaughn','Westbrook','Wheeler','Yates','Alston','Blackwell',
  'Carrington','Dunlap','Easton','Fairchild','Garrison','Hollis','Ivery','Jamison','Kirkland','Lennox',
  'Marbury','Newsome','Oglesby','Prince','Ramsey','Stoddard','Tatum','Vickers','Whitaker','Youngblood',
  'Ackerman','Braswell','Chandler','Deveraux','Ellery','Foster','Granger','Halsey','Ivers','Jessup',
  'Kingsley','Lambert','Mosley','Nettles','Overton','Pendleton','Quarles','Rutledge','Sandoval','Trawick',
  'Upshaw','Villareal','Wakefield','Yarborough','Zellner','Ashby','Blythe','Copeland','Dabney','Ewell',
  'Farris','Goodwin','Hargrove','Isbell','Jernigan','Kilgore','Latham','Merriweather','Nolen','Osgood',
  'Petway','Quilliam','Redmon','Stallworth','Threadgill','Utsey','Varnado','Waddell','Yarbrough','Ziegler',
  'Applewhite','Bostic','Chatman','Dorsey','Eubanks','Farrow','Gadson','Hutchins','Isom','Judkins',
  'Kirksey','Lassiter','Mabry','Nesbitt','Oxendine','Petteway','Quander','Redd','Shurney','Tolliver',
  'Uzzell','Vereen','Whitlow','Yowell','Zollicoffer','Abston','Bilbrew','Crenshaw','Denard','Etheridge',
  'Faulk','Goggins','Hairston','Ivory','Jeter','Kittrell','Loften','Massaquoi','Nunnally','Odum',
  'Pettiford','Quarterman','Renfroe','Somerville','Truesdale','Upperman','Vails','Wingfield','Yeldell','Zanders',
];

const NATIONALITIES: Nationality[] = [
  { country: 'USA', weight: 68, firstNames: USA_FIRST, lastNames: USA_LAST },
  { country: 'Canada', weight: 4, firstNames: ['Liam','Owen','Tristan','Bennett','Callum','Emerson','Rhys','Mason','Carson','Jaxon','Beau','Cohen','Declan','Riley'], lastNames: ['Beaulieu','Gagnon','Tremblay','Fortin','Lapointe','Mercier','Boucher','Charest','Girard','Levesque','Pelletier','Bergeron','Cormier','Ouellet'] },
  { country: 'Serbia', weight: 3, firstNames: ['Nikola','Vlade','Miloš','Stefan','Bogdan','Dušan','Aleksa','Nemanja','Marko','Filip','Vuk','Ognjen','Slobodan','Uroš'], lastNames: ['Petrović','Jokić','Marković','Radulović','Simonović','Đorđević','Kovačević','Nikolić','Stojanović','Pavlović','Milošević','Todorović','Jovanović'] },
  { country: 'France', weight: 3, firstNames: ['Thibault','Evan','Mathis','Killian','Rayan','Lucien','Amadou','Théo','Noah','Enzo','Ismael','Nathan','Yanis','Malo'], lastNames: ['Dubois','Lemoine','Fournier','Ndiaye','Beaumont','Rousseau','Traoré','Girard','Moreau','Lefevre','Diallo','Bakayoko','Sow'] },
  { country: 'Spain', weight: 2.5, firstNames: ['Sergio','Álvaro','Iker','Rubén','Javier','Mateo','Unai','Diego','Hugo','Marc','Pau','Adrián','Nico'], lastNames: ['Hernández','Rubio','Garrido','Ibáñez','Sanz','Vidal','Núñez','Moreno','Gil','Serrano','Blanco','Cano','Reyes'] },
  { country: 'Australia', weight: 2.5, firstNames: ['Jett','Kai','Lachlan','Brodie','Hamish','Darcy','Flynn','Angus','Cooper','Ryder','Tate','Beau','Archer'], lastNames: ['Whitmore','Kirby','Halloran','Bramble','Cartwright','Delaney','Mannix','Sutherland','Fairbank','Lockyer','Prentice','Bowden','Rainsford'] },
  { country: 'Nigeria', weight: 2.5, firstNames: ['Chidi','Emeka','Obi','Tunde','Ikenna','Nnamdi','Femi','Chukwu','Uche','Kelechi','Chinedu','Ayo','Segun'], lastNames: ['Okafor','Adeyemi','Nwosu','Balogun','Eze','Obiora','Achebe','Okoro','Adebayo','Chukwu','Nwachukwu','Olawale','Ibe'] },
  { country: 'Greece', weight: 2, firstNames: ['Giannis','Kostas','Thanasis','Dimitris','Vasilis','Yannis','Nikos','Panagiotis','Christos','Stavros','Alexandros'], lastNames: ['Papadopoulos','Antetokounmpo','Kalaitzakis','Sloukas','Printezis','Larentzakis','Papanikolaou','Bourousis','Mitoglou','Giannoulis'] },
  { country: 'Lithuania', weight: 2, firstNames: ['Domantas','Jonas','Arvydas','Mindaugas','Rokas','Tomas','Ignas','Deividas','Marius','Tadas'], lastNames: ['Sabonis','Valančiūnas','Jasikevičius','Kuzminskas','Motiejūnas','Grigonis','Kavaliauskas','Šeškus','Butkevičius','Jankūnas'] },
  { country: 'Germany', weight: 2, firstNames: ['Moritz','Lennart','Jonas','Maxi','Franz','Tobias','Niklas','Dennis','Robin','Paul'], lastNames: ['Wagner','Schröder','Kleber','Hartenstein','Obst','Thiemann','Voigtmann','Giffey','Theis','Lo'] },
  { country: 'Slovenia', weight: 1.5, firstNames: ['Luka','Goran','Zoran','Vlatko','Klemen','Jaka','Aleksej','Miha'], lastNames: ['Dončić','Dragić','Prepelič','Čančar','Blažič','Nikolić','Rupnik','Hrovat'] },
  { country: 'Brazil', weight: 1.5, firstNames: ['Raul','Bruno','Tiago','Leandro','Gui','Marcelo','Rafael','Vitor','Caio','Lucas'], lastNames: ['Neto','Caboclo','Splitter','Barbosa','Huertas','Machado','Varejão','Oliveira','Souza','Costa'] },
  { country: 'Argentina', weight: 1.5, firstNames: ['Facundo','Gabriel','Luca','Nicolás','Tomás','Franco','Ignacio','Santiago'], lastNames: ['Campazzo','Deck','Vildoza','Laprovíttola','Garino','Scola','Nocioni','Ginóbili'] },
  { country: 'Turkey', weight: 1.5, firstNames: ['Cedi','Furkan','Alperen','Ömer','Berk','Ersan','Semih','Kenan'], lastNames: ['Osman','Korkmaz','Şengün','Aşık','Uğurlu','İlyasova','Türkoğlu','Özdemiroğlu'] },
  { country: 'Croatia', weight: 1, firstNames: ['Dario','Ivica','Bojan','Mario','Ante','Krešimir','Filip','Tomislav'], lastNames: ['Šarić','Zubac','Bogdanović','Hezonja','Žižić','Rozgić','Planinić','Kljako'] },
  { country: 'Japan', weight: 1, firstNames: ['Rui','Yuta','Kai','Hiroshi','Ren','Yuki','Sho','Kenta'], lastNames: ['Hachimura','Watanabe','Tominaga','Baba','Nishimura','Kawamura','Sato','Takahashi'] },
];

const COLLEGES = [
  'Duke','Kentucky','North Carolina','Kansas','UCLA','Michigan State','Villanova','Gonzaga','Arizona','Indiana',
  'Syracuse','Louisville','Connecticut','Florida','Texas','Ohio State','Michigan','Wisconsin','Baylor','Purdue',
  'Auburn','Tennessee','Alabama','Arkansas','Illinois','Maryland','Oregon','USC','Virginia','Memphis',
  'Marquette','Creighton','Xavier','Butler','Providence','Seton Hall','Georgetown','St. John\'s','Notre Dame','Pittsburgh',
  'Miami','Florida State','Georgia Tech','NC State','Wake Forest','Clemson','Virginia Tech','Boston College','Rutgers','Nebraska',
  'Iowa','Minnesota','Penn State','Northwestern','Colorado','Utah','Arizona State','Washington','Stanford','California',
  'Oklahoma','Oklahoma State','TCU','Texas Tech','West Virginia','Iowa State','Cincinnati','Houston','SMU','Temple',
  'VCU','Dayton','Saint Mary\'s','San Diego State','Nevada','Boise State','Wichita State','Davidson','Murray State','Belmont',
];

function weightedNationality(rng: RNG): Nationality {
  const total = NATIONALITIES.reduce((s, n) => s + n.weight, 0);
  let roll = rng.next() * total;
  for (const n of NATIONALITIES) {
    roll -= n.weight;
    if (roll <= 0) return n;
  }
  return NATIONALITIES[0];
}

/** A generated player's origin: their nationality plus, for most players, the college they came from. */
export interface PlayerOrigin {
  name: string;
  nationality: string;
  college: string | null; // international players often come straight from a pro club instead
}

/**
 * Generates a unique fictional player identity — name drawn from a nationality-appropriate pool, plus
 * that nationality and (usually) a college. `usedNames` prevents duplicates within one league/draft class.
 */
export function generatePlayerOrigin(rng: RNG, usedNames: Set<string>): PlayerOrigin {
  const nat = weightedNationality(rng);
  let name = '';
  let attempts = 0;
  do {
    const first = nat.firstNames[rng.nextInt(nat.firstNames.length)];
    const last = nat.lastNames[rng.nextInt(nat.lastNames.length)];
    name = `${first} ${last}`;
    attempts++;
    // Small nationality pools run dry once a league is full of players; fall back to a suffix ("Jr.", "III", ...)
    // that is guaranteed unique rather than risk handing out a name that is already taken.
    if (attempts > 40) { name = uniquePlayerId(name, usedNames); break; }
  } while (usedNames.has(name));
  usedNames.add(name);

  // American players almost always come through college; international players often don't.
  const collegeChance = nat.country === 'USA' ? 0.95 : 0.35;
  const college = rng.next() < collegeChance ? COLLEGES[rng.nextInt(COLLEGES.length)] : null;

  return { name, nationality: nat.country, college };
}

/** Backwards-compatible helper for callers that only need a name (e.g. coach generation). */
export function generatePlayerName(rng: RNG, usedNames: Set<string>): string {
  return generatePlayerOrigin(rng, usedNames).name;
}

export { NATIONALITIES, COLLEGES };

/** A unique name for a generated player from `country` (its own name pool, or a mixed international one). */
export function nameForCountry(country: string, rng: RNG, usedNames: Set<string>): string {
  const nat = NATIONALITIES.find(n => n.country === country);
  const firsts = nat?.firstNames ?? NATIONALITIES.slice(1).flatMap(n => n.firstNames);
  const lasts = nat?.lastNames ?? NATIONALITIES.slice(1).flatMap(n => n.lastNames);
  for (let i = 0; i < 40; i++) {
    const name = `${firsts[rng.nextInt(firsts.length)]} ${lasts[rng.nextInt(lasts.length)]}`;
    if (!usedNames.has(name)) { usedNames.add(name); return name; }
  }
  const name = uniquePlayerId(`${firsts[0]} ${lasts[0]}`, usedNames);
  usedNames.add(name);
  return name;
}
