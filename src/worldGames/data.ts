/*
 * World Games data: the countries, the real host cities, every real NBA player's national team, and the real medal
 * winners from 1992 on (the first Games with NBA players). Names are matched to the NBA history data without accents
 * or case (src/tests/worldGames.test.ts checks every one is a real player in the data).
 *
 * A player's country is the national team he played for (Hakeem Olajuwon and Joel Embiid: USA). Players not listed
 * here are American.
 */

export interface WGCountry {
  /** Name, as generated players carry it in `nationality` ("USA", "Serbia"...). */
  name: string;
  code: string;
  colors: [string, string];
  /** How good its home-league players are (the Overall of the players who fill a roster short of league players). */
  home: number;
}

export const COUNTRIES: WGCountry[] = [
  { name: 'USA', code: 'USA', colors: ['#1d3c78', '#c8102e'], home: 60 },
  { name: 'Serbia', code: 'SRB', colors: ['#c6363c', '#0c4076'], home: 56 },
  { name: 'Spain', code: 'ESP', colors: ['#c60b1e', '#ffc400'], home: 56 },
  { name: 'France', code: 'FRA', colors: ['#0055a4', '#ef4135'], home: 55 },
  { name: 'Greece', code: 'GRE', colors: ['#0d5eaf', '#ffffff'], home: 54 },
  { name: 'Lithuania', code: 'LTU', colors: ['#006a44', '#fdb913'], home: 54 },
  { name: 'Slovenia', code: 'SLO', colors: ['#005da4', '#ed1c24'], home: 53 },
  { name: 'Australia', code: 'AUS', colors: ['#00843d', '#ffcd00'], home: 53 },
  { name: 'Germany', code: 'GER', colors: ['#222222', '#dd0000'], home: 53 },
  { name: 'Canada', code: 'CAN', colors: ['#d80621', '#ffffff'], home: 52 },
  { name: 'Argentina', code: 'ARG', colors: ['#74acdf', '#ffffff'], home: 53 },
  { name: 'Croatia', code: 'CRO', colors: ['#ff0000', '#171796'], home: 52 },
  { name: 'Italy', code: 'ITA', colors: ['#0066b3', '#ffffff'], home: 53 },
  { name: 'Turkey', code: 'TUR', colors: ['#e30a17', '#ffffff'], home: 52 },
  { name: 'Brazil', code: 'BRA', colors: ['#009c3b', '#ffdf00'], home: 51 },
  { name: 'Russia', code: 'RUS', colors: ['#d52b1e', '#0039a6'], home: 52 },
  { name: 'Latvia', code: 'LAT', colors: ['#9e3039', '#ffffff'], home: 50 },
  { name: 'Montenegro', code: 'MNE', colors: ['#c40308', '#d4af3a'], home: 50 },
  { name: 'Puerto Rico', code: 'PUR', colors: ['#ed0a3f', '#0050f0'], home: 49 },
  { name: 'Dominican Republic', code: 'DOM', colors: ['#002d62', '#ce1126'], home: 48 },
  { name: 'Nigeria', code: 'NGR', colors: ['#008751', '#ffffff'], home: 47 },
  { name: 'China', code: 'CHN', colors: ['#de2910', '#ffde00'], home: 48 },
  { name: 'Japan', code: 'JPN', colors: ['#bc002d', '#ffffff'], home: 46 },
  { name: 'Czech Republic', code: 'CZE', colors: ['#11457e', '#d7141a'], home: 49 },
  { name: 'Georgia', code: 'GEO', colors: ['#ff0000', '#ffffff'], home: 48 },
  { name: 'Venezuela', code: 'VEN', colors: ['#ffcc00', '#cf142b'], home: 47 },
  { name: 'Israel', code: 'ISR', colors: ['#0038b8', '#ffffff'], home: 48 },
  { name: 'Ukraine', code: 'UKR', colors: ['#0057b7', '#ffd700'], home: 47 },
  { name: 'Bosnia and Herzegovina', code: 'BIH', colors: ['#002395', '#fecb00'], home: 48 },
  { name: 'Finland', code: 'FIN', colors: ['#003580', '#ffffff'], home: 48 },
  { name: 'Poland', code: 'POL', colors: ['#dc143c', '#ffffff'], home: 47 },
  { name: 'Senegal', code: 'SEN', colors: ['#00853f', '#fdef42'], home: 45 },
  { name: 'Cameroon', code: 'CMR', colors: ['#007a5e', '#ce1126'], home: 44 },
  { name: 'DR Congo', code: 'COD', colors: ['#007fff', '#f7d618'], home: 43 },
  { name: 'Great Britain', code: 'GBR', colors: ['#012169', '#c8102e'], home: 46 },
  { name: 'Netherlands', code: 'NED', colors: ['#ff6200', '#21468b'], home: 45 },
  { name: 'Mexico', code: 'MEX', colors: ['#006847', '#ce1126'], home: 45 },
  { name: 'New Zealand', code: 'NZL', colors: ['#000000', '#ffffff'], home: 46 },
  { name: 'Bahamas', code: 'BAH', colors: ['#00abc9', '#fae042'], home: 43 },
  { name: 'Switzerland', code: 'SUI', colors: ['#d52b1e', '#ffffff'], home: 44 },
  { name: 'Sweden', code: 'SWE', colors: ['#006aa7', '#fecc00'], home: 44 },
  { name: 'Sudan', code: 'SUD', colors: ['#d21034', '#007229'], home: 40 },
  { name: 'Austria', code: 'AUT', colors: ['#ed2939', '#ffffff'], home: 43 },
  { name: 'Belgium', code: 'BEL', colors: ['#000000', '#fdda24'], home: 45 },
];
export const COUNTRY_BY_NAME = new Map(COUNTRIES.map(c => [c.name, c]));

/** The real host cities (the Games of 2020 were played in 2021, still called 2020). */
export const REAL_HOSTS: Record<number, { city: string; country: string }> = {
  1992: { city: 'Barcelona', country: 'Spain' }, 1996: { city: 'Atlanta', country: 'USA' }, 2000: { city: 'Sydney', country: 'Australia' },
  2004: { city: 'Athens', country: 'Greece' }, 2008: { city: 'Beijing', country: 'China' }, 2012: { city: 'London', country: 'Great Britain' },
  2016: { city: 'Rio de Janeiro', country: 'Brazil' }, 2020: { city: 'Tokyo', country: 'Japan' }, 2024: { city: 'Paris', country: 'France' },
  2028: { city: 'Los Angeles', country: 'USA' }, 2032: { city: 'Brisbane', country: 'Australia' },
};
/** Host cities for the league's own future Games (after 2032), in turn. */
export const FUTURE_HOSTS: { city: string; country: string }[] = [
  { city: 'Madrid', country: 'Spain' }, { city: 'Toronto', country: 'Canada' }, { city: 'Berlin', country: 'Germany' }, { city: 'Istanbul', country: 'Turkey' },
  { city: 'Buenos Aires', country: 'Argentina' }, { city: 'Belgrade', country: 'Serbia' }, { city: 'Rome', country: 'Italy' }, { city: 'Lyon', country: 'France' },
  { city: 'Chicago', country: 'USA' }, { city: 'Melbourne', country: 'Australia' }, { city: 'Athens', country: 'Greece' }, { city: 'Vilnius', country: 'Lithuania' },
];

/** National teams of the NBA's international players (everyone else is American). */
const BY_COUNTRY: Record<string, string[]> = {
  Serbia: ['Vlade Divac', 'Peja Stojaković', 'Nikola Jokić', 'Bogdan Bogdanović', 'Nemanja Bjelica', 'Miloš Teodosić', 'Vasilije Micić', 'Nikola Jović', 'Marko Gudurić',
    'Filip Petrušev', 'Aleksandar Đorđević', 'Sasha Danilović', 'Žarko Paspalj', 'Željko Rebrača', 'Darko Miličić', 'Vladimir Radmanović', 'Marko Jarić', 'Nenad Krstić',
    'Miroslav Raduljica', 'Ognjen Kuzmić', 'Aleksej Pokuševski', 'Boban Marjanović', 'Dragan Tarlać', 'Igor Rakočević', 'Kosta Perović'],
  Montenegro: ['Nikola Vučević', 'Žarko Čabarkapa', 'Nikola Peković'],
  Croatia: ['Toni Kukoč', 'Dražen Petrović', 'Dino Rađa', 'Stojko Vranković', 'Žan Tabak', 'Gordan Giriček', 'Zoran Planinić', 'Bojan Bogdanović', 'Dario Šarić',
    'Mario Hezonja', 'Ivica Zubac', 'Ante Žižić', 'Damir Markota', 'Roko Ukić', 'Dragan Bender'],
  Slovenia: ['Luka Dončić', 'Goran Dragić', 'Zoran Dragić', 'Beno Udrih', 'Primož Brezec', 'Rašho Nesterović', 'Sasha Vujačić', 'Boštjan Nachbar', 'Vlatko Čančar', 'Marko Milič'],
  'Bosnia and Herzegovina': ['Jusuf Nurkić', 'Mirza Teletović', 'Džanan Musa'],
  Lithuania: ['Arvydas Sabonis', 'Šarūnas Marčiulionis', 'Žydrūnas Ilgauskas', 'Šarūnas Jasikevičius', 'Darius Songaila', 'Linas Kleiza', 'Jonas Valančiūnas', 'Domantas Sabonis',
    'Donatas Motiejūnas', 'Mindaugas Kuzminskas', 'Arnoldas Kulboka', 'Martynas Andriuškevičius'],
  Latvia: ['Kristaps Porziņģis', 'Dāvis Bertāns', 'Andris Biedriņš', 'Gundars Vētra'],
  Russia: ['Andrei Kirilenko', 'Timofey Mozgov', 'Alexey Shved', 'Sasha Kaun', 'Viktor Khryapa', 'Sergei Monia'],
  Ukraine: ['Alex Len', 'Svi Mykhailiuk', 'Kyrylo Fesenko', 'Stanislav Medvedenko', 'Vitaly Potapenko', 'Oleksiy Pecherov'],
  Georgia: ['Zaza Pachulia', 'Nikoloz Tskitishvili', 'Goga Bitadze', 'Sandro Mamukelashvili', 'Tornike Shengelia'],
  Greece: ['Giannis Antetokounmpo', 'Thanasis Antetokounmpo', 'Kostas Antetokounmpo', 'Kostas Papanikolaou', 'Kosta Koufos', 'Vassilis Spanoulis', 'Andreas Glyniadakis', 'Tyler Dorsey'],
  Turkey: ['Hedo Türkoğlu', 'Mehmet Okur', 'Ersan İlyasova', 'Enes Freedom', 'Cedi Osman', 'Furkan Korkmaz', 'Alperen Şengün', 'Ömer Aşık', 'Semih Erden', 'Furkan Aldemir'],
  Germany: ['Dirk Nowitzki', 'Detlef Schrempf', 'Uwe Blab', 'Chris Welp', 'Shawn Bradley', 'Chris Kaman', 'Dennis Schröder', 'Maxi Kleber', 'Daniel Theis',
    'Moritz Wagner', 'Franz Wagner', 'Isaiah Hartenstein', 'Paul Zipser', 'Tibor Pleiß', 'Isaac Bonga', 'Tristan da Silva'],
  France: ['Tony Parker', 'Boris Diaw', 'Nicolas Batum', 'Rudy Gobert', 'Evan Fournier', 'Joakim Noah', 'Ronny Turiaf', 'Mickaël Piétrus', 'Ian Mahinmi',
    'Johan Petro', 'Alexis Ajinça', 'Kevin Séraphin', 'Nando de Colo', 'Frank Ntilikina', 'Timothé Luwawu-Cabarrot', 'Guerschon Yabusele', 'Vincent Poirier',
    'Victor Wembanyama', 'Bilal Coulibaly', 'Zaccharie Risacher', 'Alex Sarr', 'Tidjane Salaün', 'Antoine Rigaudeau', 'Tariq Abdul-Wahad', 'Jérôme Moïso',
    'Mickaël Gelabale', 'Rodrigue Beaubois', 'Élie Okobo', 'Killian Hayes', 'Sekou Doumbouya', 'Théo Maledon', 'Olivier Sarr', 'Petr Cornelie', 'Axel Toupane'],
  Spain: ['Pau Gasol', 'Marc Gasol', 'Rudy Fernández', 'José Calderón', 'Juan Carlos Navarro', 'Ricky Rubio', 'Sergio Rodríguez', 'Jorge Garbajosa', 'Raül López',
    'Serge Ibaka', 'Víctor Claver', 'Nikola Mirotić', 'Willy Hernangómez', 'Juancho Hernangómez', 'Álex Abrines', 'Fernando Martín', 'Usman Garuba', 'Santi Aldama'],
  Italy: ['Andrea Bargnani', 'Danilo Gallinari', 'Marco Belinelli', 'Gigi Datome', 'Simone Fontecchio', 'Nicolò Melli', 'Vincenzo Esposito'],
  Netherlands: ['Rik Smits'],
  'Czech Republic': ['Tomáš Satoranský', 'Jan Veselý', 'Jiří Welsch', 'Vít Krejčí'],
  Poland: ['Marcin Gortat', 'Cezary Trybański', 'Maciej Lampe'],
  Finland: ['Lauri Markkanen', 'Hanno Möttölä'],
  Sweden: ['Jonas Jerebko'],
  Switzerland: ['Thabo Sefolosha', 'Clint Capela'],
  Austria: ['Jakob Poeltl'],
  'Great Britain': ['Luol Deng', 'Joel Freeland', 'OG Anunoby'],
  Israel: ['Omri Casspi', 'Gal Mekel', 'Deni Avdija'],
  Canada: ['Steve Nash', 'Rick Fox', 'Jamaal Magloire', 'Andrew Wiggins', 'Shai Gilgeous-Alexander', 'Jamal Murray', 'RJ Barrett', 'Dillon Brooks', 'Kelly Olynyk',
    'Tristan Thompson', 'Cory Joseph', 'Dwight Powell', 'Luguentz Dort', 'Nickeil Alexander-Walker', 'Andrew Nembhard', 'Trey Lyles', 'Khem Birch', 'Chris Boucher',
    'Bennedict Mathurin', 'Zach Edey', 'Anthony Bennett', 'Nik Stauskas', 'Joel Anthony', 'Todd MacCulloch', 'Bill Wennington', 'Mike Smrek', 'Leo Rautins', 'Oshae Brissett'],
  Australia: ['Luc Longley', 'Andrew Bogut', 'Patty Mills', 'Joe Ingles', 'Ben Simmons', 'Matthew Dellavedova', 'Aron Baynes', 'Dante Exum', 'Josh Giddey',
    'Matisse Thybulle', 'Josh Green', 'Jock Landale', 'Thon Maker', 'Andrew Gaze', 'Chris Anstey', 'Nathan Jawai', 'David Andersen', 'Dyson Daniels', 'Duop Reath'],
  'New Zealand': ['Kirk Penney', 'Sean Marks', 'Steven Adams'],
  Argentina: ['Manu Ginóbili', 'Luis Scola', 'Andrés Nocioni', 'Fabricio Oberto', 'Carlos Delfino', 'Walter Herrmann', 'Pepe Sánchez', 'Rubén Wolkowyski',
    'Pablo Prigioni', 'Facundo Campazzo', 'Gabriel Deck', 'Leandro Bolmaro'],
  Brazil: ['Nenê', 'Leandro Barbosa', 'Anderson Varejão', 'Tiago Splitter', 'Raul Neto', 'Bruno Caboclo', 'Cristiano Felício', 'Lucas Nogueira', 'Rafael Araújo'],
  'Puerto Rico': ['J.J. Barea', 'Carlos Arroyo', 'Butch Lee', 'Daniel Santiago', 'Peter John Ramos'],
  'Dominican Republic': ['Al Horford', 'Karl-Anthony Towns', 'Francisco García', 'Charlie Villanueva', 'Chris Duarte', 'Felipe López'],
  Mexico: ['Eduardo Nájera', 'Gustavo Ayón', 'Jorge Gutiérrez', 'Juan Toscano-Anderson'],
  Venezuela: ['Óscar Torres', 'Greivis Vásquez', 'Carl Herrera'],
  Bahamas: ['Mychal Thompson', 'Buddy Hield', 'Deandre Ayton', 'Kai Jones', 'Eric Gordon'],
  China: ['Yao Ming', 'Wang Zhizhi', 'Mengke Bateer', 'Yi Jianlian', 'Sun Yue', 'Zhou Qi'],
  Japan: ['Rui Hachimura', 'Yuta Watanabe', 'Yuta Tabuse', 'Yuki Kawamura'],
  Nigeria: ['Olumide Oyedeji', 'Ike Diogu', 'Al-Farouq Aminu', 'Josh Okogie', 'Chimezie Metu', 'Gabe Vincent', 'Jordan Nwora'],
  Senegal: ['DeSagana Diop', 'Gorgui Dieng', 'Mamadou N\'Diaye', 'Tacko Fall'],
  Cameroon: ['Pascal Siakam', 'Luc Mbah a Moute', 'Christian Koloko'],
  'DR Congo': ['Dikembe Mutombo', 'Bismack Biyombo', 'Christian Eyenga', 'Jonathan Kuminga'],
  Sudan: ['Manute Bol'],
};
/** A player listed for two countries takes this one. */
const OVERRIDES: Record<string, string> = {};

export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'dj').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const TABLE: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [country, names] of Object.entries(BY_COUNTRY)) for (const n of names) m.set(norm(n), country);
  for (const [n, c] of Object.entries(OVERRIDES)) m.set(norm(n), c);
  return m;
})();

/** Every listed name with its country (for tests and the World Games mode). */
export const LISTED_NATIONALITIES: [string, string][] = Object.entries(BY_COUNTRY).flatMap(([c, names]) => names.map(n => [n, OVERRIDES[n] ?? c] as [string, string]));

/** A real player's national team, by name: listed internationals, otherwise USA. */
export const realNationality = (name: string): string => TABLE.get(norm(name)) ?? 'USA';

// ---------------------------------------------------------------- real medals (1992 on)

export type Medal = 'gold' | 'silver' | 'bronze';
export interface RealGames { year: number; gold: string; silver: string; bronze: string; /** NBA players on each medal team. */ rosters: Partial<Record<string, string[]>> }

export const REAL_GAMES: RealGames[] = [
  { year: 1992, gold: 'USA', silver: 'Croatia', bronze: 'Lithuania', rosters: {
    USA: ['Christian Laettner', 'David Robinson', 'Patrick Ewing', 'Larry Bird', 'Scottie Pippen', 'Michael Jordan', 'Clyde Drexler', 'Karl Malone', 'John Stockton', 'Chris Mullin', 'Charles Barkley', 'Magic Johnson'],
    Croatia: ['Dražen Petrović', 'Toni Kukoč', 'Dino Rađa', 'Stojko Vranković'],
    Lithuania: ['Šarūnas Marčiulionis', 'Arvydas Sabonis'] } },
  { year: 1996, gold: 'USA', silver: 'Serbia', bronze: 'Lithuania', rosters: {
    USA: ['Charles Barkley', 'Anfernee Hardaway', 'Grant Hill', 'Karl Malone', 'Reggie Miller', 'Hakeem Olajuwon', "Shaquille O'Neal", 'Gary Payton', 'Scottie Pippen', 'Mitch Richmond', 'David Robinson', 'John Stockton'],
    Serbia: ['Vlade Divac', 'Sasha Danilović', 'Žarko Paspalj', 'Aleksandar Đorđević'],
    Lithuania: ['Arvydas Sabonis', 'Šarūnas Marčiulionis'] } },
  { year: 2000, gold: 'USA', silver: 'France', bronze: 'Lithuania', rosters: {
    USA: ['Shareef Abdur-Rahim', 'Ray Allen', 'Vin Baker', 'Vince Carter', 'Kevin Garnett', 'Tim Hardaway', 'Allan Houston', 'Jason Kidd', 'Antonio McDyess', 'Alonzo Mourning', 'Gary Payton', 'Steve Smith'],
    France: ['Antoine Rigaudeau', 'Tariq Abdul-Wahad'],
    Lithuania: ['Šarūnas Jasikevičius', 'Darius Songaila'] } },
  { year: 2004, gold: 'Argentina', silver: 'Italy', bronze: 'USA', rosters: {
    Argentina: ['Manu Ginóbili', 'Luis Scola', 'Andrés Nocioni', 'Fabricio Oberto', 'Carlos Delfino', 'Walter Herrmann', 'Pepe Sánchez', 'Rubén Wolkowyski'],
    USA: ['Carmelo Anthony', 'Carlos Boozer', 'Tim Duncan', 'Allen Iverson', 'LeBron James', 'Richard Jefferson', 'Stephon Marbury', 'Shawn Marion', 'Lamar Odom', 'Emeka Okafor', "Amar'e Stoudemire", 'Dwyane Wade'] } },
  { year: 2008, gold: 'USA', silver: 'Spain', bronze: 'Argentina', rosters: {
    USA: ['Carmelo Anthony', 'Carlos Boozer', 'Chris Bosh', 'Kobe Bryant', 'Dwight Howard', 'LeBron James', 'Jason Kidd', 'Chris Paul', 'Tayshaun Prince', 'Michael Redd', 'Dwyane Wade', 'Deron Williams'],
    Spain: ['Pau Gasol', 'Marc Gasol', 'Rudy Fernández', 'José Calderón', 'Juan Carlos Navarro', 'Ricky Rubio', 'Jorge Garbajosa', 'Raül López'],
    Argentina: ['Manu Ginóbili', 'Luis Scola', 'Andrés Nocioni', 'Carlos Delfino', 'Fabricio Oberto'] } },
  { year: 2012, gold: 'USA', silver: 'Spain', bronze: 'Russia', rosters: {
    USA: ['Carmelo Anthony', 'Kobe Bryant', 'Tyson Chandler', 'Anthony Davis', 'Kevin Durant', 'James Harden', 'Andre Iguodala', 'LeBron James', 'Kevin Love', 'Chris Paul', 'Russell Westbrook', 'Deron Williams'],
    Spain: ['Pau Gasol', 'Marc Gasol', 'Rudy Fernández', 'José Calderón', 'Juan Carlos Navarro', 'Serge Ibaka', 'Sergio Rodríguez', 'Víctor Claver'],
    Russia: ['Andrei Kirilenko', 'Timofey Mozgov', 'Alexey Shved', 'Sasha Kaun'] } },
  { year: 2016, gold: 'USA', silver: 'Serbia', bronze: 'Spain', rosters: {
    USA: ['Harrison Barnes', 'Jimmy Butler', 'DeMarcus Cousins', 'Kevin Durant', 'Paul George', 'Draymond Green', 'Kyrie Irving', 'DeAndre Jordan', 'Kyle Lowry', 'Carmelo Anthony', 'Klay Thompson', 'DeMar DeRozan'],
    Serbia: ['Nikola Jokić', 'Miloš Teodosić', 'Nemanja Bjelica', 'Bogdan Bogdanović', 'Miroslav Raduljica', 'Ognjen Kuzmić'],
    Spain: ['Pau Gasol', 'Rudy Fernández', 'Sergio Rodríguez', 'Ricky Rubio', 'Nikola Mirotić', 'Willy Hernangómez', 'Álex Abrines', 'Víctor Claver'] } },
  { year: 2020, gold: 'USA', silver: 'France', bronze: 'Australia', rosters: {
    USA: ['Bam Adebayo', 'Devin Booker', 'Kevin Durant', 'Jerami Grant', 'Draymond Green', 'Jrue Holiday', 'Keldon Johnson', 'Zach LaVine', 'Damian Lillard', 'JaVale McGee', 'Khris Middleton', 'Jayson Tatum'],
    France: ['Rudy Gobert', 'Evan Fournier', 'Nicolas Batum', 'Nando de Colo', 'Frank Ntilikina', 'Timothé Luwawu-Cabarrot', 'Guerschon Yabusele', 'Vincent Poirier', 'Petr Cornelie'],
    Australia: ['Patty Mills', 'Joe Ingles', 'Matisse Thybulle', 'Matthew Dellavedova', 'Aron Baynes', 'Josh Green', 'Jock Landale'] } },
  { year: 2024, gold: 'USA', silver: 'France', bronze: 'Serbia', rosters: {
    USA: ['Bam Adebayo', 'Devin Booker', 'Stephen Curry', 'Anthony Davis', 'Kevin Durant', 'Anthony Edwards', 'Joel Embiid', 'Tyrese Haliburton', 'Jrue Holiday', 'LeBron James', 'Jayson Tatum', 'Derrick White'],
    France: ['Victor Wembanyama', 'Rudy Gobert', 'Nicolas Batum', 'Evan Fournier', 'Guerschon Yabusele', 'Frank Ntilikina', 'Bilal Coulibaly', 'Nando de Colo'],
    Serbia: ['Nikola Jokić', 'Bogdan Bogdanović', 'Vasilije Micić', 'Nikola Jović', 'Filip Petrušev', 'Marko Gudurić'] } },
];

export interface WorldMedal {
  /** The Games year (2024). */
  year: number;
  country: string;
  medal: Medal;
  /** A real result from before the league began (not played in this league). */
  real?: boolean;
  /** Where they were held. */
  city?: string;
}

/** A real player's medals from the real Games before `beforeYear` (the league's first Games is played, not imported). */
export function realMedals(name: string, beforeYear = 9999): WorldMedal[] {
  const key = norm(name), out: WorldMedal[] = [];
  for (const g of REAL_GAMES) {
    if (g.year >= beforeYear) continue;
    for (const [country, names] of Object.entries(g.rosters)) {
      if (!names?.some(n => norm(n) === key)) continue;
      const medal: Medal = g.gold === country ? 'gold' : g.silver === country ? 'silver' : 'bronze';
      out.push({ year: g.year, country, medal, real: true, city: REAL_HOSTS[g.year]?.city });
    }
  }
  return out;
}

/** Where the Games of a year are held. */
export function hostOf(year: number): { city: string; country: string } {
  return REAL_HOSTS[year] ?? FUTURE_HOSTS[(((year - 2036) / 4) % FUTURE_HOSTS.length + FUTURE_HOSTS.length) % FUTURE_HOSTS.length];
}
export const isGamesYear = (year: number) => year % 4 === 0;
export const MEDAL_LABEL: Record<Medal, string> = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
