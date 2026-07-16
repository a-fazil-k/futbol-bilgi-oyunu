// db/seed.js
// SQLite veritabanini olusturur ve genis bir futbol veri seti ile doldurur.
// Calistirma: node db/seed.js  (server.js baslarken otomatik cagirir)

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "football.db");

// ---------------------------------------------------------------------------
// KULUPLER  (name, country)  -- 90+ populer kulup
// ---------------------------------------------------------------------------
const CLUBS = [
  ["Real Madrid", "Spain"], ["Barcelona", "Spain"], ["Atletico Madrid", "Spain"],
  ["Sevilla", "Spain"], ["Valencia", "Spain"], ["Real Sociedad", "Spain"],
  ["Athletic Bilbao", "Spain"], ["Villarreal", "Spain"], ["Mallorca", "Spain"],
  ["Rayo Vallecano", "Spain"],
  ["Manchester United", "England"], ["Manchester City", "England"], ["Liverpool", "England"],
  ["Chelsea", "England"], ["Arsenal", "England"], ["Tottenham", "England"],
  ["Newcastle United", "England"], ["Everton", "England"], ["West Ham United", "England"],
  ["Leicester City", "England"], ["Aston Villa", "England"], ["Southampton", "England"],
  ["Brighton", "England"], ["Wolves", "England"], ["Fulham", "England"],
  ["Sunderland", "England"], ["Sheffield United", "England"], ["Hull City", "England"],
  ["Barnsley", "England"], ["Bournemouth", "England"], ["Leeds United", "England"],
  ["Cardiff City", "England"],
  ["Bayern Munich", "Germany"], ["Borussia Dortmund", "Germany"], ["RB Leipzig", "Germany"],
  ["Bayer Leverkusen", "Germany"], ["Schalke 04", "Germany"], ["Wolfsburg", "Germany"],
  ["Werder Bremen", "Germany"], ["Hamburger SV", "Germany"], ["Kaiserslautern", "Germany"],
  ["Nurnberg", "Germany"], ["Karlsruhe", "Germany"],
  ["Juventus", "Italy"], ["AC Milan", "Italy"], ["Inter Milan", "Italy"], ["Napoli", "Italy"],
  ["Roma", "Italy"], ["Lazio", "Italy"], ["Fiorentina", "Italy"], ["Atalanta", "Italy"],
  ["Parma", "Italy"], ["Bari", "Italy"], ["Genoa", "Italy"], ["Torino", "Italy"],
  ["Cagliari", "Italy"], ["Pescara", "Italy"], ["Brescia", "Italy"], ["Sampdoria", "Italy"],
  ["Udinese", "Italy"],
  ["Paris Saint-Germain", "France"], ["Marseille", "France"], ["Lyon", "France"],
  ["Monaco", "France"], ["Lille", "France"], ["Nice", "France"], ["Rennes", "France"],
  ["Lens", "France"], ["Bordeaux", "France"], ["Cannes", "France"], ["Caen", "France"],
  ["Guingamp", "France"], ["Le Mans", "France"], ["Le Havre", "France"],
  ["Montpellier", "France"], ["Metz", "France"],
  ["Galatasaray", "Turkey"], ["Fenerbahce", "Turkey"], ["Besiktas", "Turkey"],
  ["Trabzonspor", "Turkey"],
  ["Benfica", "Portugal"], ["Porto", "Portugal"], ["Sporting CP", "Portugal"],
  ["Boavista", "Portugal"],
  ["Ajax", "Netherlands"], ["PSV Eindhoven", "Netherlands"], ["Feyenoord", "Netherlands"],
  ["Groningen", "Netherlands"], ["Heerenveen", "Netherlands"], ["Vitesse", "Netherlands"],
  ["Twente", "Netherlands"],
  ["Flamengo", "Brazil"], ["Corinthians", "Brazil"], ["Palmeiras", "Brazil"],
  ["Santos", "Brazil"], ["Fluminense", "Brazil"], ["Internacional", "Brazil"],
  ["Sao Paulo", "Brazil"], ["Figueirense", "Brazil"], ["Bahia", "Brazil"],
  ["Gremio", "Brazil"], ["Cruzeiro", "Brazil"],
  ["Boca Juniors", "Argentina"], ["River Plate", "Argentina"], ["Independiente", "Argentina"],
  ["Racing Club", "Argentina"], ["Rosario Central", "Argentina"], ["Instituto", "Argentina"],
  ["Argentinos Juniors", "Argentina"], ["Banfield", "Argentina"], ["Talleres", "Argentina"],
  ["Independiente del Valle", "Ecuador"],
  ["Inter Miami", "USA"], ["LA Galaxy", "USA"], ["DC United", "USA"],
  ["New York Red Bulls", "USA"], ["New York City FC", "USA"], ["Los Angeles FC", "USA"],
  ["Chicago Fire", "USA"], ["San Diego FC", "USA"],
  ["Al Hilal", "Saudi Arabia"], ["Al Nassr", "Saudi Arabia"], ["Al Ittihad", "Saudi Arabia"],
  ["Al-Ahli", "Saudi Arabia"], ["Al-Ettifaq", "Saudi Arabia"],
  ["Al-Arabi", "Qatar"], ["Al Sadd", "Qatar"], ["Al-Rayyan", "Qatar"],
  ["Celtic", "Scotland"], ["Rangers", "Scotland"], ["Dundee United", "Scotland"],
  ["Basel", "Switzerland"], ["Salzburg", "Austria"], ["Genk", "Belgium"],
  ["Anderlecht", "Belgium"],
  ["Dinamo Zagreb", "Croatia"], ["Vojvodina", "Serbia"], ["Partizan", "Serbia"],
  ["Spartak Moscow", "Russia"], ["Rubin Kazan", "Russia"],
  ["Molde", "Norway"], ["Stromsgodset", "Norway"],
  ["Malmo", "Sweden"],
  ["Dinamo Tbilisi", "Georgia"],
  ["Pachuca", "Mexico"],
  ["Kawasaki Frontale", "Japan"], ["Vissel Kobe", "Japan"],
  ["Sydney FC", "Australia"], ["Toronto FC", "Canada"],
  ["Olympiacos", "Greece"],
  ["Shanghai Shenhua", "China"],
  ["Nacional", "Uruguay"], ["Penarol", "Uruguay"], ["Boston River", "Uruguay"],
  ["Danubio", "Uruguay"],
  ["Znicz Pruszkow", "Poland"], ["Lech Poznan", "Poland"],
  ["Al Mokawloon", "Egypt"],
  // --- EK KULUPLER (Super Lig derinligi + diger buyuk liglerin alt siralari) ---
  // Turkiye - Super Lig genisletme
  ["Samsunspor", "Turkey"], ["Adana Demirspor", "Turkey"], ["Konyaspor", "Turkey"],
  ["Alanyaspor", "Turkey"], ["Antalyaspor", "Turkey"], ["Sivasspor", "Turkey"],
  ["Kayserispor", "Turkey"], ["Gaziantep FK", "Turkey"], ["Caykur Rizespor", "Turkey"],
  ["Genclerbirligi", "Turkey"], ["Bursaspor", "Turkey"], ["Eskisehirspor", "Turkey"],
  ["Denizlispor", "Turkey"], ["Goztepe", "Turkey"], ["Basaksehir", "Turkey"],
  ["Kasimpasa", "Turkey"], ["Ankaragucu", "Turkey"], ["Hatayspor", "Turkey"],
  ["Pendikspor", "Turkey"], ["Kocaelispor", "Turkey"],

  // Ingiltere - Premier League / Championship genisletme
  ["Middlesbrough", "England"], ["Norwich City", "England"], ["Sheffield Wednesday", "England"],
  ["Bristol City", "England"], ["Preston North End", "England"], ["Queens Park Rangers", "England"],
  ["Stoke City", "England"], ["Blackburn Rovers", "England"], ["Watford", "England"],
  ["Swansea City", "England"], ["Charlton Athletic", "England"], ["Portsmouth", "England"],
  ["Derby County", "England"], ["Nottingham Forest", "England"],

  // Ispanya - LaLiga genisletme
  ["Real Betis", "Spain"], ["Celta Vigo", "Spain"], ["Espanyol", "Spain"], ["Getafe", "Spain"],
  ["Alaves", "Spain"], ["Osasuna", "Spain"], ["Real Zaragoza", "Spain"], ["Malaga", "Spain"],
  ["Deportivo La Coruna", "Spain"], ["Real Valladolid", "Spain"], ["Levante", "Spain"],
  ["Elche", "Spain"], ["Girona", "Spain"], ["Cadiz", "Spain"], ["Almeria", "Spain"],

  // Almanya - Bundesliga genisletme
  ["Freiburg", "Germany"], ["Union Berlin", "Germany"], ["Hertha Berlin", "Germany"],
  ["Mainz 05", "Germany"], ["Hoffenheim", "Germany"], ["Augsburg", "Germany"],
  ["Borussia Monchengladbach", "Germany"], ["Eintracht Frankfurt", "Germany"],
  ["VfB Stuttgart", "Germany"], ["Bochum", "Germany"],

  // Italya - Serie A genisletme
  ["Sassuolo", "Italy"], ["Verona", "Italy"], ["Salernitana", "Italy"], ["Spezia", "Italy"],
  ["Empoli", "Italy"], ["Lecce", "Italy"], ["Monza", "Italy"], ["Cremonese", "Italy"],
  ["Piacenza", "Italy"], ["Vicenza", "Italy"], ["Ravenna", "Italy"], ["Venezia", "Italy"],

  // Fransa - Ligue 1 genisletme
  ["Nantes", "France"], ["Toulouse", "France"], ["Reims", "France"], ["Angers", "France"],
  ["Saint-Etienne", "France"], ["Strasbourg", "France"], ["Brest", "France"], ["Auxerre", "France"],

  // Diger buyuk kulupler
  ["Shakhtar Donetsk", "Ukraine"], ["Dynamo Kyiv", "Ukraine"], ["CSKA Moscow", "Russia"],
  ["Zenit St Petersburg", "Russia"], ["Anzhi Makhachkala", "Russia"], ["CSKA Sofia", "Bulgaria"],
  ["Legia Warsaw", "Poland"], ["Slovan Bratislava", "Slovakia"], ["Sparta Prague", "Czech Republic"],
  ["Standard Liege", "Belgium"], ["Club Brugge", "Belgium"], ["Kaiserslautern", "Germany"],
  ["Sunderland", "England"], ["Fulham", "England"], ["Wigan Athletic", "England"],
  ["Reading", "England"], ["Crystal Palace", "England"], ["Wolverhampton Wanderers", "England"],
  ["Hull City", "England"], ["Barnsley", "England"], ["MK Dons", "England"],
  ["Coventry City", "England"], ["Birmingham City", "England"], ["Rangers", "Scotland"],
  ["Vasco da Gama", "Brazil"], ["Atletico Mineiro", "Brazil"], ["Vitoria", "Brazil"],
  ["Newell's Old Boys", "Argentina"], ["Estudiantes", "Argentina"], ["Velez Sarsfield", "Argentina"],
  ["San Lorenzo", "Argentina"], ["Racing Club", "Argentina"], ["Atlas", "Mexico"],
  ["New York Red Bulls", "USA"], ["Seattle Sounders", "USA"], ["LAFC", "USA"],
  ["San Jose Earthquakes", "USA"], ["Toronto FC", "Canada"], ["Vancouver Whitecaps", "Canada"],
];


// ---------------------------------------------------------------------------
// OYUNCULAR  (name, nationality, [clubs...])
// ---------------------------------------------------------------------------
const PLAYERS = [
  // Arjantin
  ["Lionel Messi", "Argentina", ["Barcelona", "Paris Saint-Germain", "Inter Miami"]],
  ["Sergio Aguero", "Argentina", ["Independiente", "Atletico Madrid", "Manchester City"]],
  ["Angel Di Maria", "Argentina", ["Rosario Central", "Real Madrid", "Manchester United", "Paris Saint-Germain", "Juventus", "Benfica"]],
  ["Paulo Dybala", "Argentina", ["Instituto", "Juventus", "Roma"]],
  ["Lautaro Martinez", "Argentina", ["Racing Club", "Inter Milan"]],
  ["Emiliano Martinez", "Argentina", ["Independiente", "Arsenal", "Aston Villa"]],
  ["Rodrigo De Paul", "Argentina", ["Racing Club", "Udinese", "Atletico Madrid"]],
  ["Enzo Fernandez", "Argentina", ["River Plate", "Benfica", "Chelsea"]],
  ["Julian Alvarez", "Argentina", ["River Plate", "Manchester City", "Atletico Madrid"]],
  ["Gonzalo Higuain", "Argentina", ["River Plate", "Real Madrid", "Napoli", "Juventus", "Chelsea", "Inter Miami"]],
  ["Javier Mascherano", "Argentina", ["River Plate", "Corinthians", "Liverpool", "Barcelona"]],
  ["Carlos Tevez", "Argentina", ["Boca Juniors", "West Ham United", "Manchester United", "Manchester City", "Juventus"]],
  ["Diego Maradona", "Argentina", ["Argentinos Juniors", "Boca Juniors", "Barcelona", "Napoli", "Sevilla"]],

  // Brezilya
  ["Neymar", "Brazil", ["Santos", "Barcelona", "Paris Saint-Germain", "Al Hilal"]],
  ["Vinicius Junior", "Brazil", ["Flamengo", "Real Madrid"]],
  ["Rodrygo", "Brazil", ["Santos", "Real Madrid"]],
  ["Casemiro", "Brazil", ["Sao Paulo", "Real Madrid", "Manchester United"]],
  ["Alisson Becker", "Brazil", ["Internacional", "Roma", "Liverpool"]],
  ["Ederson", "Brazil", ["Benfica", "Manchester City"]],
  ["Thiago Silva", "Brazil", ["Fluminense", "AC Milan", "Paris Saint-Germain", "Chelsea"]],
  ["Marquinhos", "Brazil", ["Corinthians", "Roma", "Paris Saint-Germain"]],
  ["Fabinho", "Brazil", ["Real Madrid", "Monaco", "Liverpool"]],
  ["Roberto Firmino", "Brazil", ["Figueirense", "Hoffenheim", "Liverpool"]],
  ["Philippe Coutinho", "Brazil", ["Inter Milan", "Liverpool", "Barcelona", "Bayern Munich", "Aston Villa"]],
  ["Ronaldinho", "Brazil", ["Gremio", "Paris Saint-Germain", "Barcelona", "AC Milan", "Flamengo"]],
  ["Ronaldo Nazario", "Brazil", ["Cruzeiro", "PSV Eindhoven", "Barcelona", "Inter Milan", "Real Madrid", "AC Milan", "Corinthians"]],
  ["Kaka", "Brazil", ["Sao Paulo", "AC Milan", "Real Madrid"]],
  ["Rivaldo", "Brazil", ["Barcelona", "AC Milan"]],
  ["Robinho", "Brazil", ["Santos", "Real Madrid", "Manchester City", "AC Milan"]],
  ["Dani Alves", "Brazil", ["Bahia", "Sevilla", "Barcelona", "Juventus", "Paris Saint-Germain", "Sao Paulo"]],

  // Fransa
  ["Kylian Mbappe", "France", ["Monaco", "Paris Saint-Germain", "Real Madrid"]],
  ["Antoine Griezmann", "France", ["Real Sociedad", "Atletico Madrid", "Barcelona"]],
  ["Karim Benzema", "France", ["Lyon", "Real Madrid", "Al Ittihad"]],
  ["N'Golo Kante", "France", ["Caen", "Leicester City", "Chelsea", "Al Ittihad"]],
  ["Paul Pogba", "France", ["Manchester United", "Juventus"]],
  ["Ousmane Dembele", "France", ["Rennes", "Borussia Dortmund", "Barcelona", "Paris Saint-Germain"]],
  ["Kingsley Coman", "France", ["Paris Saint-Germain", "Juventus", "Bayern Munich", "Al Nassr"]],
  ["Raphael Varane", "France", ["Lens", "Real Madrid", "Manchester United"]],
  ["Presnel Kimpembe", "France", ["Paris Saint-Germain"]],
  ["Theo Hernandez", "France", ["Atletico Madrid", "Real Madrid", "AC Milan"]],
  ["Aurelien Tchouameni", "France", ["Monaco", "Real Madrid"]],
  ["Eduardo Camavinga", "France", ["Rennes", "Real Madrid"]],
  ["Olivier Giroud", "France", ["Montpellier", "Arsenal", "Chelsea", "AC Milan", "Los Angeles FC"]],
  ["Hugo Lloris", "France", ["Nice", "Lyon", "Tottenham"]],
  ["Thierry Henry", "France", ["Monaco", "Juventus", "Arsenal", "Barcelona"]],
  ["Zinedine Zidane", "France", ["Cannes", "Bordeaux", "Juventus", "Real Madrid"]],
  ["Franck Ribery", "France", ["Marseille", "Bayern Munich"]],

  // Portekiz
  ["Cristiano Ronaldo", "Portugal", ["Sporting CP", "Manchester United", "Real Madrid", "Juventus", "Al Nassr"]],
  ["Bruno Fernandes", "Portugal", ["Boavista", "Sporting CP", "Manchester United"]],
  ["Bernardo Silva", "Portugal", ["Benfica", "Monaco", "Manchester City"]],
  ["Joao Felix", "Portugal", ["Benfica", "Atletico Madrid", "Chelsea", "AC Milan"]],
  ["Ruben Dias", "Portugal", ["Benfica", "Manchester City"]],
  ["Pepe", "Portugal", ["Porto", "Real Madrid", "Besiktas"]],
  ["Nuno Mendes", "Portugal", ["Sporting CP", "Paris Saint-Germain"]],
  ["Rafael Leao", "Portugal", ["Sporting CP", "Lille", "AC Milan"]],
  ["Diogo Jota", "Portugal", ["Porto", "Atletico Madrid", "Wolves", "Liverpool"]],
  ["Luis Figo", "Portugal", ["Sporting CP", "Barcelona", "Real Madrid", "Inter Milan"]],

  // Uruguay
  ["Luis Suarez", "Uruguay", ["Groningen", "Ajax", "Liverpool", "Barcelona", "Atletico Madrid", "Inter Miami"]],
  ["Edinson Cavani", "Uruguay", ["Palermo", "Napoli", "Paris Saint-Germain", "Manchester United", "Valencia"]],
  ["Federico Valverde", "Uruguay", ["Penarol", "Real Madrid"]],
  ["Diego Godin", "Uruguay", ["Nacional", "Villarreal", "Atletico Madrid", "Inter Milan", "Cagliari"]],
  ["Ronald Araujo", "Uruguay", ["Boston River", "Barcelona"]],
  ["Darwin Nunez", "Uruguay", ["Penarol", "Benfica", "Liverpool"]],

  // Belcika
  ["Kevin De Bruyne", "Belgium", ["Genk", "Chelsea", "Wolfsburg", "Manchester City"]],
  ["Eden Hazard", "Belgium", ["Lille", "Chelsea", "Real Madrid"]],
  ["Romelu Lukaku", "Belgium", ["Anderlecht", "Chelsea", "Everton", "Manchester United", "Inter Milan", "Roma", "Napoli"]],
  ["Thibaut Courtois", "Belgium", ["Genk", "Chelsea", "Atletico Madrid", "Real Madrid"]],
  ["Youri Tielemans", "Belgium", ["Anderlecht", "Monaco", "Leicester City", "Aston Villa"]],
  ["Jan Vertonghen", "Belgium", ["Ajax", "Tottenham", "Benfica"]],
  ["Toby Alderweireld", "Belgium", ["Ajax", "Atletico Madrid", "Southampton", "Tottenham"]],

  // Hirvatistan
  ["Luka Modric", "Croatia", ["Dinamo Zagreb", "Tottenham", "Real Madrid"]],
  ["Ivan Rakitic", "Croatia", ["Basel", "Sevilla", "Barcelona"]],
  ["Mateo Kovacic", "Croatia", ["Dinamo Zagreb", "Inter Milan", "Real Madrid", "Chelsea", "Manchester City"]],
  ["Marcelo Brozovic", "Croatia", ["Dinamo Zagreb", "Inter Milan", "Al Nassr"]],

  // Polonya
  ["Robert Lewandowski", "Poland", ["Znicz Pruszkow", "Lech Poznan", "Borussia Dortmund", "Bayern Munich", "Barcelona"]],

  // Misir
  ["Mohamed Salah", "Egypt", ["Al Mokawloon", "Basel", "Chelsea", "Fiorentina", "Roma", "Liverpool"]],

  // Senegal
  ["Sadio Mane", "Senegal", ["Metz", "Salzburg", "Southampton", "Liverpool", "Bayern Munich", "Al Nassr"]],

  // Fas
  ["Achraf Hakimi", "Morocco", ["Real Madrid", "Borussia Dortmund", "Inter Milan", "Paris Saint-Germain"]],
  ["Hakim Ziyech", "Morocco", ["Twente", "Ajax", "Chelsea", "Galatasaray"]],

  // Cezayir
  ["Riyad Mahrez", "Algeria", ["Leicester City", "Manchester City", "Al-Ahli"]],

  // Nijerya
  ["Victor Osimhen", "Nigeria", ["Wolfsburg", "Lille", "Napoli", "Galatasaray"]],

  // Gana
  ["Andre Ayew", "Ghana", ["Marseille", "West Ham United", "Al Sadd"]],
  ["Thomas Partey", "Ghana", ["Atletico Madrid", "Arsenal"]],

  // Fildisi Sahili
  ["Didier Drogba", "Ivory Coast", ["Marseille", "Chelsea", "Shanghai Shenhua", "Galatasaray"]],
  ["Yaya Toure", "Ivory Coast", ["Barcelona", "Monaco", "Manchester City"]],
  ["Kolo Toure", "Ivory Coast", ["Arsenal", "Manchester City", "Liverpool"]],

  // Kamerun
  ["Samuel Eto'o", "Cameroon", ["Real Madrid", "Mallorca", "Barcelona", "Inter Milan", "Chelsea", "Everton"]],

  // Sirbistan
  ["Dusan Vlahovic", "Serbia", ["Partizan", "Fiorentina", "Juventus"]],
  ["Sergej Milinkovic-Savic", "Serbia", ["Vojvodina", "Genk", "Lazio", "Al Hilal"]],
  ["Nemanja Vidic", "Serbia", ["Spartak Moscow", "Manchester United", "Inter Milan"]],

  // Norvec
  ["Erling Haaland", "Norway", ["Molde", "Salzburg", "Borussia Dortmund", "Manchester City"]],
  ["Martin Odegaard", "Norway", ["Stromsgodset", "Real Madrid", "Real Sociedad", "Arsenal"]],

  // Isvec
  ["Zlatan Ibrahimovic", "Sweden", ["Malmo", "Ajax", "Juventus", "Inter Milan", "Barcelona", "AC Milan", "Paris Saint-Germain", "Manchester United", "LA Galaxy"]],

  // Danimarka
  ["Christian Eriksen", "Denmark", ["Ajax", "Tottenham", "Inter Milan", "Manchester United"]],
  ["Kasper Schmeichel", "Denmark", ["Manchester City", "Leicester City", "Nice", "Anderlecht"]],

  // Galler
  ["Gareth Bale", "Wales", ["Southampton", "Tottenham", "Real Madrid", "Los Angeles FC"]],
  ["Aaron Ramsey", "Wales", ["Cardiff City", "Arsenal", "Juventus"]],

  // Iskocya
  ["Andy Robertson", "Scotland", ["Dundee United", "Hull City", "Liverpool"]],
  ["Scott McTominay", "Scotland", ["Manchester United", "Napoli"]],

  // Ingiltere
  ["Harry Kane", "England", ["Tottenham", "Bayern Munich"]],
  ["Jude Bellingham", "England", ["Birmingham City", "Borussia Dortmund", "Real Madrid"]],
  ["Phil Foden", "England", ["Manchester City"]],
  ["Jack Grealish", "England", ["Aston Villa", "Manchester City"]],
  ["Bukayo Saka", "England", ["Arsenal"]],
  ["Marcus Rashford", "England", ["Manchester United"]],
  ["Raheem Sterling", "England", ["Liverpool", "Manchester City", "Chelsea"]],
  ["Jordan Henderson", "England", ["Sunderland", "Liverpool", "Ajax"]],
  ["John Stones", "England", ["Barnsley", "Everton", "Manchester City"]],
  ["Kyle Walker", "England", ["Sheffield United", "Tottenham", "Manchester City", "AC Milan"]],
  ["Declan Rice", "England", ["West Ham United", "Arsenal"]],
  ["Trent Alexander-Arnold", "England", ["Liverpool", "Real Madrid"]],
  ["David Beckham", "England", ["Manchester United", "Real Madrid", "LA Galaxy", "AC Milan", "Paris Saint-Germain"]],
  ["Wayne Rooney", "England", ["Everton", "Manchester United", "DC United"]],
  ["Frank Lampard", "England", ["West Ham United", "Chelsea", "Manchester City", "New York City FC"]],
  ["Steven Gerrard", "England", ["Liverpool", "LA Galaxy"]],

  // Almanya
  ["Toni Kroos", "Germany", ["Bayern Munich", "Real Madrid"]],
  ["Manuel Neuer", "Germany", ["Schalke 04", "Bayern Munich"]],
  ["Thomas Muller", "Germany", ["Bayern Munich"]],
  ["Joshua Kimmich", "Germany", ["RB Leipzig", "Bayern Munich"]],
  ["Ilkay Gundogan", "Germany", ["Nurnberg", "Borussia Dortmund", "Manchester City", "Barcelona"]],
  ["Leroy Sane", "Germany", ["Schalke 04", "Manchester City", "Bayern Munich"]],
  ["Kai Havertz", "Germany", ["Bayer Leverkusen", "Chelsea", "Arsenal"]],
  ["Jamal Musiala", "Germany", ["Bayern Munich"]],
  ["Mats Hummels", "Germany", ["Bayern Munich", "Borussia Dortmund"]],
  ["Mesut Ozil", "Germany", ["Schalke 04", "Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce"]],
  ["Miroslav Klose", "Germany", ["Kaiserslautern", "Werder Bremen", "Bayern Munich", "Lazio"]],
  ["Bastian Schweinsteiger", "Germany", ["Bayern Munich", "Manchester United", "Chicago Fire"]],
  ["Philipp Lahm", "Germany", ["Bayern Munich"]],

  // Hollanda
  ["Virgil van Dijk", "Netherlands", ["Groningen", "Celtic", "Southampton", "Liverpool"]],
  ["Frenkie de Jong", "Netherlands", ["Ajax", "Barcelona"]],
  ["Memphis Depay", "Netherlands", ["PSV Eindhoven", "Manchester United", "Lyon", "Barcelona", "Atletico Madrid", "Corinthians"]],
  ["Matthijs de Ligt", "Netherlands", ["Ajax", "Juventus", "Bayern Munich", "Manchester United"]],
  ["Georginio Wijnaldum", "Netherlands", ["Feyenoord", "PSV Eindhoven", "Newcastle United", "Liverpool", "Paris Saint-Germain", "Roma"]],
  ["Arjen Robben", "Netherlands", ["Groningen", "PSV Eindhoven", "Chelsea", "Real Madrid", "Bayern Munich"]],
  ["Robin van Persie", "Netherlands", ["Feyenoord", "Arsenal", "Manchester United", "Fenerbahce"]],
  ["Wesley Sneijder", "Netherlands", ["Ajax", "Real Madrid", "Inter Milan", "Galatasaray", "Nice"]],
  ["Dennis Bergkamp", "Netherlands", ["Ajax", "Inter Milan", "Arsenal"]],
  ["Ruud van Nistelrooy", "Netherlands", ["Heerenveen", "PSV Eindhoven", "Manchester United", "Real Madrid", "Hamburger SV"]],

  // Ispanya
  ["Sergio Ramos", "Spain", ["Sevilla", "Real Madrid", "Paris Saint-Germain"]],
  ["Andres Iniesta", "Spain", ["Barcelona"]],
  ["Xavi Hernandez", "Spain", ["Barcelona"]],
  ["David Silva", "Spain", ["Valencia", "Manchester City", "Real Sociedad"]],
  ["Pedri", "Spain", ["Barcelona"]],
  ["Gavi", "Spain", ["Barcelona"]],
  ["Alvaro Morata", "Spain", ["Real Madrid", "Juventus", "Chelsea", "Atletico Madrid", "AC Milan", "Galatasaray"]],
  ["Dani Carvajal", "Spain", ["Real Madrid", "Bayer Leverkusen"]],
  ["Jordi Alba", "Spain", ["Barcelona", "Valencia", "Inter Miami"]],
  ["Thiago Alcantara", "Spain", ["Barcelona", "Bayern Munich", "Liverpool"]],
  ["Marco Asensio", "Spain", ["Real Madrid", "Paris Saint-Germain", "Fenerbahce"]],
  ["Iker Casillas", "Spain", ["Real Madrid", "Porto"]],
  ["Xabi Alonso", "Spain", ["Real Sociedad", "Liverpool", "Real Madrid", "Bayern Munich"]],
  ["Fernando Torres", "Spain", ["Atletico Madrid", "Liverpool", "Chelsea", "AC Milan"]],
  ["David Villa", "Spain", ["Valencia", "Barcelona", "Atletico Madrid", "New York City FC"]],
  ["Cesc Fabregas", "Spain", ["Arsenal", "Barcelona", "Chelsea", "Monaco"]],
  ["Gerard Pique", "Spain", ["Manchester United", "Barcelona"]],

  // Italya
  ["Gianluigi Donnarumma", "Italy", ["AC Milan", "Paris Saint-Germain", "Manchester City"]],
  ["Federico Chiesa", "Italy", ["Fiorentina", "Juventus", "Liverpool"]],
  ["Nicolo Barella", "Italy", ["Cagliari", "Inter Milan"]],
  ["Lorenzo Insigne", "Italy", ["Napoli", "Toronto FC"]],
  ["Ciro Immobile", "Italy", ["Juventus", "Torino", "Genoa", "Sevilla", "Borussia Dortmund", "Lazio"]],
  ["Marco Verratti", "Italy", ["Pescara", "Paris Saint-Germain"]],
  ["Leonardo Bonucci", "Italy", ["Inter Milan", "Bari", "Juventus", "AC Milan", "Fenerbahce"]],
  ["Giorgio Chiellini", "Italy", ["Fiorentina", "Juventus", "Los Angeles FC"]],
  ["Andrea Pirlo", "Italy", ["Brescia", "Inter Milan", "AC Milan", "Juventus", "New York City FC"]],
  ["Francesco Totti", "Italy", ["Roma"]],
  ["Alessandro Del Piero", "Italy", ["Juventus", "Sydney FC"]],
  ["Gianluigi Buffon", "Italy", ["Parma", "Juventus", "Paris Saint-Germain"]],
  ["Paolo Maldini", "Italy", ["AC Milan"]],

  // Diger
  ["Kostas Tsimikas", "Greece", ["Olympiacos", "Liverpool"]],
  ["Jan Oblak", "Slovenia", ["Benfica", "Atletico Madrid"]],
  ["Khvicha Kvaratskhelia", "Georgia", ["Dinamo Tbilisi", "Rubin Kazan", "Napoli", "Paris Saint-Germain"]],
  ["Arda Guler", "Turkey", ["Fenerbahce", "Real Madrid"]],
  ["Hakan Calhanoglu", "Turkey", ["Karlsruhe", "Hamburger SV", "Bayer Leverkusen", "AC Milan", "Inter Milan"]],
  ["Burak Yilmaz", "Turkey", ["Trabzonspor", "Besiktas", "Galatasaray", "Lille"]],
  ["Arda Turan", "Turkey", ["Galatasaray", "Atletico Madrid", "Barcelona"]],
  ["Emre Belozoglu", "Turkey", ["Galatasaray", "Inter Milan", "Newcastle United", "Atletico Madrid", "Fenerbahce"]],
  ["Takefusa Kubo", "Japan", ["Real Madrid", "Mallorca", "Villarreal", "Real Sociedad"]],
  ["Kaoru Mitoma", "Japan", ["Kawasaki Frontale", "Brighton"]],
  ["Son Heung-min", "South Korea", ["Hamburger SV", "Bayer Leverkusen", "Tottenham"]],
  ["Lee Kang-in", "South Korea", ["Valencia", "Mallorca", "Paris Saint-Germain"]],
  ["Christian Pulisic", "USA", ["Borussia Dortmund", "Chelsea", "AC Milan"]],
  ["Weston McKennie", "USA", ["Schalke 04", "Juventus"]],
  ["Tyler Adams", "USA", ["New York Red Bulls", "RB Leipzig", "Bournemouth"]],
  ["Hirving Lozano", "Mexico", ["Pachuca", "PSV Eindhoven", "Napoli", "San Diego FC"]],
  ["James Rodriguez", "Colombia", ["Banfield", "Porto", "Monaco", "Real Madrid", "Bayern Munich", "Everton", "Sao Paulo", "Rayo Vallecano"]],
  ["Radamel Falcao", "Colombia", ["River Plate", "Porto", "Atletico Madrid", "Monaco", "Chelsea", "Manchester United", "Galatasaray", "Rayo Vallecano"]],
  ["Juan Cuadrado", "Colombia", ["Udinese", "Fiorentina", "Juventus", "Inter Milan"]],
  ["Alexis Sanchez", "Chile", ["Udinese", "Barcelona", "Arsenal", "Manchester United", "Inter Milan", "Marseille"]],
  ["Arturo Vidal", "Chile", ["Bayer Leverkusen", "Juventus", "Bayern Munich", "Barcelona", "Inter Milan"]],
  ["Moises Caicedo", "Ecuador", ["Independiente del Valle", "Brighton", "Chelsea"]],
  ["Piero Hincapie", "Ecuador", ["Talleres", "Independiente del Valle", "Bayer Leverkusen"]],
  // --- EK OYUNCULAR (kadro derinligi) ---
  // Real Madrid kadro derinligi
  ["Marcelo", "Brazil", ["Fluminense", "Real Madrid"]],
  ["Raul Gonzalez", "Spain", ["Real Madrid"]],
  ["Isco", "Spain", ["Malaga", "Real Madrid", "Sevilla"]],
  ["Nacho Fernandez", "Spain", ["Real Madrid"]],
  ["Lucas Vazquez", "Spain", ["Real Madrid"]],
  ["Dani Ceballos", "Spain", ["Real Betis", "Real Madrid", "Arsenal"]],
  ["Brahim Diaz", "Spain", ["Manchester City", "Real Madrid", "AC Milan"]],
  ["Endrick", "Brazil", ["Palmeiras", "Real Madrid"]],
  ["Antonio Rudiger", "Germany", ["VfB Stuttgart", "Roma", "Chelsea", "Real Madrid"]],
  ["Ferland Mendy", "France", ["Le Havre", "Lyon", "Real Madrid"]],
  ["David Alaba", "Austria", ["Bayern Munich", "Real Madrid"]],

  // Barcelona kadro derinligi
  ["Sergio Busquets", "Spain", ["Barcelona", "Inter Miami"]],
  ["Ansu Fati", "Spain", ["Barcelona", "Brighton"]],
  ["Raphinha", "Brazil", ["Vitoria", "Sporting CP", "Rennes", "Leeds United", "Barcelona"]],
  ["Marc-Andre ter Stegen", "Germany", ["Borussia Monchengladbach", "Barcelona"]],
  ["Lamine Yamal", "Spain", ["Barcelona"]],

  // Manchester City kadro derinligi
  ["Rodri", "Spain", ["Villarreal", "Atletico Madrid", "Manchester City"]],
  ["Nathan Ake", "Netherlands", ["Feyenoord", "Chelsea", "Watford", "Bournemouth", "Manchester City"]],
  ["Vincent Kompany", "Belgium", ["Anderlecht", "Hamburger SV", "Manchester City"]],
  ["Joao Cancelo", "Portugal", ["Benfica", "Inter Milan", "Real Madrid", "Valencia", "Manchester City", "Bayern Munich", "Barcelona", "Al Hilal"]],

  // Manchester United kadro derinligi
  ["Harry Maguire", "England", ["Sheffield United", "Hull City", "Leicester City", "Manchester United"]],
  ["Luke Shaw", "England", ["Southampton", "Manchester United"]],
  ["Diogo Dalot", "Portugal", ["Porto", "AC Milan", "Manchester United"]],
  ["Antony", "Brazil", ["Sao Paulo", "Ajax", "Manchester United"]],
  ["Rasmus Hojlund", "Denmark", ["Atalanta", "Manchester United"]],
  ["Andre Onana", "Cameroon", ["Barcelona", "Ajax", "Inter Milan", "Manchester United"]],
  ["Eric Cantona", "France", ["Auxerre", "Marseille", "Leeds United", "Manchester United"]],
  ["Ryan Giggs", "Wales", ["Manchester United"]],
  ["Paul Scholes", "England", ["Manchester United"]],
  ["Roy Keane", "Ireland", ["Nottingham Forest", "Manchester United"]],
  ["Rio Ferdinand", "England", ["West Ham United", "Leeds United", "Manchester United"]],
  ["Patrice Evra", "France", ["Monaco", "Manchester United", "Juventus", "Marseille"]],
  ["Michael Carrick", "England", ["West Ham United", "Tottenham", "Manchester United"]],

  // Liverpool kadro derinligi
  ["Luis Diaz", "Colombia", ["Junior", "Porto", "Liverpool"]],
  ["Cody Gakpo", "Netherlands", ["PSV Eindhoven", "Liverpool"]],
  ["Dominik Szoboszlai", "Hungary", ["Salzburg", "RB Leipzig", "Liverpool"]],
  ["Ibrahima Konate", "France", ["Sochaux", "RB Leipzig", "Liverpool"]],
  ["Xherdan Shaqiri", "Switzerland", ["Basel", "Bayern Munich", "Inter Milan", "Liverpool"]],

  // Chelsea kadro derinligi
  ["Cole Palmer", "England", ["Manchester City", "Chelsea"]],
  ["Reece James", "England", ["Chelsea"]],
  ["Mason Mount", "England", ["Chelsea", "Manchester United"]],
  ["John Terry", "England", ["Chelsea"]],
  ["Petr Cech", "Czech Republic", ["Sparta Prague", "Rennes", "Chelsea", "Arsenal"]],

  // Arsenal kadro derinligi
  ["Gabriel Jesus", "Brazil", ["Palmeiras", "Manchester City", "Arsenal"]],
  ["Gabriel Magalhaes", "Brazil", ["Avai", "Lille", "Arsenal"]],
  ["William Saliba", "France", ["Saint-Etienne", "Arsenal"]],
  ["Aaron Ramsdale", "England", ["Sheffield United", "Bournemouth", "Arsenal"]],
  ["Patrick Vieira", "France", ["Cannes", "AC Milan", "Arsenal", "Juventus", "Inter Milan", "Manchester City"]],
  ["Robert Pires", "France", ["Metz", "Marseille", "Arsenal", "Villarreal"]],

  // Tottenham kadro derinligi
  ["James Maddison", "England", ["Coventry City", "Norwich City", "Leicester City", "Tottenham"]],
  ["Dejan Kulusevski", "Sweden", ["Atalanta", "Parma", "Juventus", "Tottenham"]],
  ["Cristian Romero", "Argentina", ["Belgrano", "Genoa", "Juventus", "Atalanta", "Tottenham"]],

  // Bayern Munich kadro derinligi
  ["Leon Goretzka", "Germany", ["Bochum", "Schalke 04", "Bayern Munich"]],
  ["Serge Gnabry", "Germany", ["Stuttgart", "Arsenal", "West Bromwich Albion", "Werder Bremen", "Bayern Munich"]],
  ["Dayot Upamecano", "France", ["Valenciennes", "Salzburg", "RB Leipzig", "Bayern Munich"]],
  ["Alphonso Davies", "Canada", ["Vancouver Whitecaps", "Bayern Munich"]],
  ["Michael Olise", "France", ["Reading", "Crystal Palace", "Bayern Munich"]],

  // Borussia Dortmund kadro derinligi
  ["Marco Reus", "Germany", ["Borussia Monchengladbach", "Borussia Dortmund"]],
  ["Julian Brandt", "Germany", ["Bayer Leverkusen", "Borussia Dortmund"]],
  ["Niclas Fullkrug", "Germany", ["Werder Bremen", "Borussia Dortmund", "West Ham United"]],
  ["Karim Adeyemi", "Germany", ["Salzburg", "Borussia Dortmund"]],

  // PSG kadro derinligi
  ["Vitinha", "Portugal", ["Porto", "Paris Saint-Germain"]],
  ["Bradley Barcola", "France", ["Lyon", "Paris Saint-Germain"]],
  ["Warren Zaire-Emery", "France", ["Paris Saint-Germain"]],
  ["Randal Kolo Muani", "France", ["Nantes", "Eintracht Frankfurt", "Paris Saint-Germain"]],

  // Juventus kadro derinligi
  ["Manuel Locatelli", "Italy", ["AC Milan", "Sassuolo", "Juventus"]],
  ["Danilo", "Brazil", ["Santos", "Porto", "Real Madrid", "Manchester City", "Juventus"]],
  ["Gleison Bremer", "Brazil", ["Atletico Mineiro", "Torino", "Juventus"]],

  // AC Milan kadro derinligi
  ["Mike Maignan", "France", ["Paris Saint-Germain", "Lille", "AC Milan"]],
  ["Fikayo Tomori", "England", ["Chelsea", "AC Milan"]],
  ["Ismael Bennacer", "Algeria", ["Arsenal", "Empoli", "AC Milan"]],
  ["Andriy Shevchenko", "Ukraine", ["Dynamo Kyiv", "AC Milan", "Chelsea"]],

  // Inter Milan kadro derinligi
  ["Marcus Thuram", "France", ["Sochaux", "Guingamp", "Borussia Monchengladbach", "Inter Milan"]],
  ["Federico Dimarco", "Italy", ["Inter Milan"]],
  ["Alessandro Bastoni", "Italy", ["Atalanta", "Parma", "Inter Milan"]],
  ["Denzel Dumfries", "Netherlands", ["Heerenveen", "PSV Eindhoven", "Inter Milan"]],
  ["Javier Zanetti", "Argentina", ["Talleres", "Banfield", "Inter Milan"]],

  // Napoli / Roma kadro derinligi
  ["Kalidou Koulibaly", "Senegal", ["Genk", "Napoli", "Chelsea", "Al Hilal"]],
  ["Giovanni Di Lorenzo", "Italy", ["Empoli", "Napoli"]],
  ["Edin Dzeko", "Bosnia", ["Wolfsburg", "Manchester City", "Roma", "Inter Milan", "Fenerbahce"]],
  ["Lorenzo Pellegrini", "Italy", ["Roma"]],

  // Galatasaray kadro derinligi
  ["Mauro Icardi", "Argentina", ["Sampdoria", "Inter Milan", "Paris Saint-Germain", "Galatasaray"]],
  ["Dries Mertens", "Belgium", ["Anderlecht", "Utrecht", "PSV Eindhoven", "Napoli", "Galatasaray"]],
  ["Fernando Muslera", "Uruguay", ["Nacional", "Lazio", "Galatasaray"]],
  ["Hakan Sukur", "Turkey", ["Sakaryaspor", "Galatasaray", "Torino", "Parma", "Inter Milan"]],
  ["Lucas Torreira", "Uruguay", ["Sampdoria", "Arsenal", "Atletico Madrid", "Fiorentina", "Galatasaray"]],

  // Fenerbahce kadro derinligi
  ["Dusan Tadic", "Serbia", ["Vojvodina", "Groningen", "Twente", "Southampton", "Ajax", "Fenerbahce"]],
  ["Sebastian Szymanski", "Poland", ["Legia Warsaw", "Fenerbahce"]],
  ["Irfan Can Kahveci", "Turkey", ["Fenerbahce", "Basaksehir"]],

  // Besiktas / Trabzonspor kadro derinligi
  ["Ricardo Quaresma", "Portugal", ["Sporting CP", "Barcelona", "Inter Milan", "Chelsea", "Porto", "Besiktas"]],
  ["Vincent Aboubakar", "Cameroon", ["Valenciennes", "Lorient", "Porto", "Besiktas", "Al Nassr"]],
  ["Trezeguet", "Egypt", ["Al Ahly", "Kasimpasa", "Aston Villa", "Trabzonspor"]],

  // Benfica / Porto / Sporting kadro derinligi
  ["David Luiz", "Brazil", ["Vitoria", "Benfica", "Chelsea", "Paris Saint-Germain", "Arsenal"]],
  ["Nemanja Matic", "Serbia", ["Kosice", "Chelsea", "Benfica", "Manchester United", "Roma"]],
  ["Hulk", "Brazil", ["Vitoria", "Porto", "Shanghai SIPG"]],
  ["Nani", "Portugal", ["Sporting CP", "Manchester United", "Fenerbahce", "Valencia", "Lazio", "Orlando City"]],
  ["Viktor Gyokeres", "Sweden", ["Brommapojkarna", "Sporting CP"]],

  // Ajax / PSV / Feyenoord kadro derinligi
  ["Daley Blind", "Netherlands", ["Ajax", "Manchester United", "Bayern Munich", "Girona"]],
  ["Edwin van der Sar", "Netherlands", ["Ajax", "Juventus", "Fulham", "Manchester United"]],

  // Guney Amerika kulup derinligi
  ["Juan Roman Riquelme", "Argentina", ["Boca Juniors", "Barcelona", "Villarreal"]],
  ["Fernando Gago", "Argentina", ["Boca Juniors", "Real Madrid", "Valencia"]],
  ["Marcos Rojo", "Argentina", ["Spartak Moscow", "Sporting CP", "Manchester United", "Estudiantes", "Boca Juniors"]],
  ["Gabigol", "Brazil", ["Santos", "Inter Milan", "Benfica", "Flamengo"]],

  // Suudi kulupleri kadro derinligi
  ["Ruben Neves", "Portugal", ["Porto", "Wolves", "Al Hilal"]],
  ["Aleksandar Mitrovic", "Serbia", ["Partizan", "Anderlecht", "Newcastle United", "Fulham", "Al Hilal"]],

  // Diger Avrupa ulkeleri
  ["Gylfi Sigurdsson", "Iceland", ["Reading", "Hoffenheim", "Tottenham", "Everton"]],
  ["Marko Arnautovic", "Austria", ["Inter Milan", "Werder Bremen", "Stoke City", "West Ham United", "Bologna"]],
  ["Granit Xhaka", "Switzerland", ["Basel", "Borussia Monchengladbach", "Arsenal", "Bayer Leverkusen"]],
  ["Breel Embolo", "Switzerland", ["Basel", "Schalke 04", "Borussia Monchengladbach", "Monaco"]],
  ["Piotr Zielinski", "Poland", ["Udinese", "Empoli", "Napoli", "Inter Milan"]],
  ["Wojciech Szczesny", "Poland", ["Legia Warsaw", "Arsenal", "Roma", "Juventus", "Barcelona"]],
  ["Patrik Schick", "Czech Republic", ["Sparta Prague", "Sampdoria", "Roma", "RB Leipzig", "Bayer Leverkusen"]],
  ["Marek Hamsik", "Slovakia", ["Slovan Bratislava", "Brescia", "Napoli"]],

  // Afrika
  ["Asamoah Gyan", "Ghana", ["Udinese", "Rennes", "Sunderland", "Al Ain"]],
  ["Yves Bissouma", "Mali", ["Lille", "Brighton", "Tottenham"]],
  ["Pierre-Emerick Aubameyang", "Gabon", ["AC Milan", "Monaco", "Saint-Etienne", "Borussia Dortmund", "Arsenal", "Barcelona", "Chelsea", "Marseille"]],

  // Kuzey Amerika
  ["Jonathan David", "Canada", ["Gent", "Lille"]],
  ["Gio Reyna", "USA", ["Borussia Dortmund"]],
  ["Sergino Dest", "USA", ["Ajax", "Barcelona", "AC Milan", "PSV Eindhoven"]],
  ["Javier Hernandez", "Mexico", ["Guadalajara", "Manchester United", "Real Madrid", "Bayer Leverkusen", "West Ham United", "Sevilla", "LA Galaxy"]],
  ["Keylor Navas", "Costa Rica", ["Real Madrid", "Paris Saint-Germain", "Nottingham Forest"]],

  // Guney Amerika (diger)
  ["Enner Valencia", "Ecuador", ["Everton", "Fenerbahce"]],
  ["Paolo Guerrero", "Peru", ["Bayern Munich", "Hamburger SV", "Corinthians", "Flamengo", "Internacional"]],

  // Asya / Okyanusya
  ["Shinji Kagawa", "Japan", ["Cerezo Osaka", "Borussia Dortmund", "Manchester United"]],
  // --- EK OYUNCULAR 2 (Premier League / LaLiga / Bundesliga / Serie A / Ligue 1 / Süper Lig genişletme) ---
  ["Alan Shearer", "England", ["Southampton", "Blackburn Rovers", "Newcastle United"]],
  ["Ian Wright", "England", ["Crystal Palace", "Arsenal", "West Ham United"]],
  ["Peter Schmeichel", "Denmark", ["Brondby", "Manchester United", "Sporting CP", "Aston Villa", "Manchester City"]],
  ["Eric Dier", "England", ["Sporting CP", "Tottenham", "Bayern Munich"]],
  ["Sol Campbell", "England", ["Tottenham", "Arsenal", "Portsmouth"]],
  ["Ashley Cole", "England", ["Arsenal", "Chelsea", "Roma"]],
  ["Didier Deschamps", "France", ["Nantes", "Marseille", "Bordeaux", "Juventus", "Chelsea", "Valencia"]],
  ["Michael Owen", "England", ["Liverpool", "Real Madrid", "Newcastle United", "Manchester United", "Stoke City"]],
  ["Robbie Fowler", "England", ["Liverpool", "Leeds United", "Manchester City", "Blackburn Rovers", "Cardiff City"]],
  ["Jamie Carragher", "England", ["Liverpool"]],
  ["Cesar Azpilicueta", "Spain", ["Osasuna", "Marseille", "Chelsea", "Atletico Madrid"]],
  ["Victor Moses", "Nigeria", ["Crystal Palace", "Wigan Athletic", "Chelsea", "Fenerbahce", "Inter Milan", "Spartak Moscow"]],
  ["Willian", "Brazil", ["Corinthians", "Shakhtar Donetsk", "Chelsea", "Arsenal", "Fulham"]],
  ["Pedro Rodriguez", "Spain", ["Barcelona", "Chelsea", "Roma", "Lazio"]],
  ["Diego Costa", "Spain", ["Atletico Madrid", "Chelsea"]],
  ["Marcos Alonso", "Spain", ["Real Madrid", "Bolton Wanderers", "Fiorentina", "Sunderland", "Chelsea", "Barcelona"]],
  ["Kepa Arrizabalaga", "Spain", ["Athletic Bilbao", "Chelsea", "Real Madrid", "Bournemouth"]],
  ["Edouard Mendy", "Senegal", ["Marseille", "Reims", "Rennes", "Chelsea", "Al-Ahli"]],
  ["Wilfried Zaha", "Ivory Coast", ["Crystal Palace", "Manchester United", "Galatasaray"]],
  ["Christian Benteke", "Belgium", ["Genk", "Aston Villa", "Liverpool", "Crystal Palace", "DC United"]],
  ["Divock Origi", "Belgium", ["Lille", "Liverpool", "AC Milan"]],
  ["James Milner", "England", ["Leeds United", "Newcastle United", "Aston Villa", "Manchester City", "Liverpool", "Brighton"]],
  ["Naby Keita", "Guinea", ["RB Leipzig", "Liverpool", "Werder Bremen"]],
  ["Joel Matip", "Cameroon", ["Schalke 04", "Liverpool"]],
  ["Joe Gomez", "England", ["Charlton Athletic", "Liverpool"]],
  ["Alex Oxlade-Chamberlain", "England", ["Southampton", "Arsenal", "Liverpool"]],
  ["Adam Lallana", "England", ["Southampton", "Liverpool", "Brighton"]],
  ["Emre Can", "Germany", ["Bayern Munich", "Bayer Leverkusen", "Liverpool", "Juventus", "Borussia Dortmund"]],
  ["Simon Mignolet", "Belgium", ["Sint-Truiden", "Sunderland", "Liverpool"]],
  ["Loris Karius", "Germany", ["Manchester City", "Liverpool", "Besiktas", "Union Berlin"]],
  ["Dejan Lovren", "Croatia", ["Dinamo Zagreb", "Lyon", "Southampton", "Liverpool"]],
  ["Nathaniel Clyne", "England", ["Crystal Palace", "Southampton", "Liverpool", "Bournemouth"]],
  ["Micah Richards", "England", ["Manchester City", "Fiorentina", "Aston Villa"]],
  ["Wilfried Bony", "Ivory Coast", ["Vitesse", "Swansea City", "Manchester City", "Stoke City"]],
  ["Fernandinho", "Brazil", ["Shakhtar Donetsk", "Manchester City"]],
  ["Aleksandar Kolarov", "Serbia", ["Lazio", "Manchester City", "Roma", "Inter Milan"]],
  ["Pablo Zabaleta", "Argentina", ["San Lorenzo", "Espanyol", "Manchester City", "West Ham United"]],
  ["Samir Nasri", "France", ["Marseille", "Arsenal", "Manchester City", "Sevilla", "Anderlecht", "West Ham United"]],
  ["Kelechi Iheanacho", "Nigeria", ["Manchester City", "Leicester City"]],
  ["Bacary Sagna", "France", ["Auxerre", "Arsenal", "Manchester City", "Benfica"]],
  ["Gael Clichy", "France", ["Cannes", "Arsenal", "Manchester City"]],
  ["Nicolas Otamendi", "Argentina", ["Velez Sarsfield", "Porto", "Valencia", "Manchester City", "Benfica"]],
  ["Juan Mata", "Spain", ["Real Madrid", "Valencia", "Chelsea", "Manchester United"]],
  ["Ander Herrera", "Spain", ["Real Zaragoza", "Athletic Bilbao", "Manchester United", "Paris Saint-Germain"]],
  ["Marouane Fellaini", "Belgium", ["Standard Liege", "Everton", "Manchester United"]],
  ["Chris Smalling", "England", ["Fulham", "Manchester United", "Roma"]],
  ["Phil Jones", "England", ["Blackburn Rovers", "Manchester United"]],
  ["Ashley Young", "England", ["Watford", "Aston Villa", "Manchester United", "Inter Milan", "Everton"]],
  ["Fred", "Brazil", ["Internacional", "Shakhtar Donetsk", "Manchester United", "Fenerbahce"]],
  ["Victor Lindelof", "Sweden", ["Benfica", "Manchester United"]],
  ["Aaron Wan-Bissaka", "England", ["Crystal Palace", "Manchester United", "West Ham United"]],
  ["Jadon Sancho", "England", ["Manchester City", "Borussia Dortmund", "Manchester United", "Chelsea"]],
  ["Michael Essien", "Ghana", ["Bastia", "Lyon", "Chelsea", "Real Madrid", "AC Milan"]],
  ["Claude Makelele", "France", ["Nantes", "Marseille", "Real Madrid", "Chelsea", "Paris Saint-Germain"]],
  ["Joe Cole", "England", ["West Ham United", "Chelsea", "Liverpool", "Lille", "Aston Villa"]],
  ["Ricardo Carvalho", "Portugal", ["Porto", "Chelsea", "Real Madrid", "Monaco"]],
  ["William Gallas", "France", ["Caen", "Marseille", "Chelsea", "Arsenal", "Tottenham"]],
  ["Marcel Desailly", "France", ["Nantes", "Marseille", "AC Milan", "Chelsea"]],
  ["Gianfranco Zola", "Italy", ["Napoli", "Parma", "Chelsea", "Cagliari"]],
  ["Hernan Crespo", "Argentina", ["River Plate", "Parma", "Lazio", "Inter Milan", "Chelsea", "AC Milan"]],
  ["Michael Ballack", "Germany", ["Kaiserslautern", "Bayer Leverkusen", "Bayern Munich", "Chelsea"]],
  ["Nicolas Anelka", "France", ["Paris Saint-Germain", "Arsenal", "Real Madrid", "Liverpool", "Manchester City", "Fenerbahce", "Bolton Wanderers", "Chelsea", "West Bromwich Albion"]],
  ["Florent Malouda", "France", ["Guingamp", "Lyon", "Chelsea", "Trabzonspor"]],
  ["Timo Werner", "Germany", ["Stuttgart", "RB Leipzig", "Chelsea", "Tottenham"]],
  ["Freddie Ljungberg", "Sweden", ["Halmstad", "Arsenal", "West Ham United", "Seattle Sounders"]],
  ["Emmanuel Petit", "France", ["Monaco", "Arsenal", "Barcelona", "Chelsea"]],
  ["Jack Wilshere", "England", ["Arsenal", "Bournemouth", "West Ham United"]],
  ["Theo Walcott", "England", ["Southampton", "Arsenal", "Everton"]],
  ["Per Mertesacker", "Germany", ["Hannover 96", "Werder Bremen", "Arsenal"]],
  ["Laurent Koscielny", "France", ["Guingamp", "Lorient", "Arsenal", "Bordeaux"]],
  ["Alexandre Lacazette", "France", ["Lyon", "Arsenal"]],
  ["Nicolas Pepe", "Ivory Coast", ["Angers", "Lille", "Arsenal", "Nice", "Villarreal"]],
  ["Santi Cazorla", "Spain", ["Villarreal", "Malaga", "Arsenal"]],
  ["Mikel Arteta", "Spain", ["Barcelona", "Paris Saint-Germain", "Rangers", "Real Sociedad", "Everton", "Arsenal"]],
  ["Gabriel Martinelli", "Brazil", ["Ituano", "Arsenal"]],
  ["Eddie Nketiah", "England", ["Arsenal", "Crystal Palace"]],
  ["Dele Alli", "England", ["MK Dons", "Tottenham", "Everton"]],
  ["Danny Rose", "England", ["Leeds United", "Tottenham", "Newcastle United"]],
  ["Mousa Dembele", "Belgium", ["AZ Alkmaar", "Fulham", "Tottenham"]],
  ["Erik Lamela", "Argentina", ["River Plate", "Roma", "Tottenham", "Sevilla"]],
  ["Emmanuel Adebayor", "Togo", ["Metz", "Monaco", "Arsenal", "Manchester City", "Real Madrid", "Tottenham", "Crystal Palace"]],
  ["Robbie Keane", "Ireland", ["Wolverhampton Wanderers", "Coventry City", "Inter Milan", "Leeds United", "Tottenham", "Liverpool", "LA Galaxy"]],
  ["Ledley King", "England", ["Tottenham"]],
  ["Jermain Defoe", "England", ["West Ham United", "Tottenham", "Portsmouth", "Toronto FC", "Sunderland", "Bournemouth", "Rangers"]],
  ["Diego Simeone", "Argentina", ["Velez Sarsfield", "Sevilla", "Atletico Madrid", "Inter Milan", "Lazio", "Racing Club"]],
  ["Koke", "Spain", ["Atletico Madrid"]],
  ["Saul Niguez", "Spain", ["Atletico Madrid", "Chelsea"]],
  ["Filipe Luis", "Brazil", ["Deportivo La Coruna", "Atletico Madrid", "Chelsea"]],
  ["Gabi", "Spain", ["Real Madrid", "Getafe", "Atletico Madrid"]],
  ["Jose Gimenez", "Uruguay", ["Danubio", "Atletico Madrid"]],
  ["Marcos Llorente", "Spain", ["Real Madrid", "Alaves", "Atletico Madrid"]],
  ["Angel Correa", "Argentina", ["San Lorenzo", "Atletico Madrid"]],
  ["Yannick Carrasco", "Belgium", ["Monaco", "Atletico Madrid", "Dalian Yifang", "Al-Shabab"]],
  ["Jesus Navas", "Spain", ["Sevilla", "Manchester City"]],
  ["Jules Kounde", "France", ["Bordeaux", "Sevilla", "Barcelona"]],
  ["Wissam Ben Yedder", "France", ["Toulouse", "Monaco", "Sevilla"]],
  ["Daniel Parejo", "Spain", ["Real Madrid", "Getafe", "Valencia", "Villarreal"]],
  ["Goncalo Guedes", "Portugal", ["Benfica", "Paris Saint-Germain", "Valencia", "Wolves"]],
  ["Mikel Oyarzabal", "Spain", ["Real Sociedad"]],
  ["Martin Zubimendi", "Spain", ["Real Sociedad"]],
  ["Aritz Aduriz", "Spain", ["Athletic Bilbao", "Valencia", "Mallorca"]],
  ["Iker Muniain", "Spain", ["Athletic Bilbao"]],
  ["Gerard Moreno", "Spain", ["Barcelona", "Espanyol", "Villarreal"]],
  ["Pau Torres", "Spain", ["Villarreal", "Aston Villa"]],
  ["Samuel Chukwueze", "Nigeria", ["Villarreal", "AC Milan"]],
  ["Mario Gomez", "Germany", ["Stuttgart", "Bayern Munich", "Fiorentina", "Besiktas", "Wolfsburg"]],
  ["Mario Gotze", "Germany", ["Borussia Dortmund", "Bayern Munich", "PSV Eindhoven", "Eintracht Frankfurt"]],
  ["Lukas Podolski", "Germany", ["Koln", "Bayern Munich", "Arsenal", "Inter Milan", "Galatasaray", "Vissel Kobe"]],
  ["Sami Khedira", "Germany", ["Stuttgart", "Real Madrid", "Juventus", "Hertha Berlin"]],
  ["Kevin Trapp", "Germany", ["Kaiserslautern", "Eintracht Frankfurt", "Paris Saint-Germain"]],
  ["Corentin Tolisso", "France", ["Lyon", "Bayern Munich"]],
  ["Niklas Sule", "Germany", ["Hoffenheim", "Bayern Munich", "Borussia Dortmund"]],
  ["Benjamin Pavard", "France", ["Lille", "Stuttgart", "Bayern Munich", "Inter Milan"]],
  ["Lucas Hernandez", "France", ["Atletico Madrid", "Bayern Munich", "Paris Saint-Germain"]],
  ["Youssoufa Moukoko", "Germany", ["Borussia Dortmund"]],
  ["Nico Schlotterbeck", "Germany", ["Freiburg", "Borussia Dortmund"]],
  ["Christopher Nkunku", "France", ["Paris Saint-Germain", "RB Leipzig", "Chelsea"]],
  ["Xavi Simons", "Netherlands", ["Barcelona", "Paris Saint-Germain", "PSV Eindhoven", "RB Leipzig"]],
  ["Florian Wirtz", "Germany", ["Bayer Leverkusen", "Liverpool"]],
  ["Jonathan Tah", "Germany", ["Hamburger SV", "Bayer Leverkusen"]],
  ["Duvan Zapata", "Colombia", ["Napoli", "Udinese", "Sampdoria", "Atalanta", "Torino"]],
  ["Ruslan Malinovskyi", "Ukraine", ["Shakhtar Donetsk", "Genk", "Atalanta", "Marseille"]],
  ["Papu Gomez", "Argentina", ["Catania", "San Lorenzo", "Atalanta", "Sevilla", "Monza"]],
  ["Felipe Anderson", "Brazil", ["Santos", "Lazio", "West Ham United", "Porto"]],
  ["Luis Alberto", "Spain", ["Sevilla", "Liverpool", "Malaga", "Deportivo La Coruna", "Lazio"]],
  ["Dimitri Payet", "France", ["Nantes", "Saint-Etienne", "Lille", "Marseille", "West Ham United"]],
  ["Florian Thauvin", "France", ["Bastia", "Lille", "Marseille", "Newcastle United", "Udinese"]],
  ["Nabil Fekir", "France", ["Lyon", "Real Betis", "Rennes", "Los Angeles FC"]],
  ["Moussa Dembele", "France", ["Rennes", "Fulham", "Celtic", "Lyon", "Atletico Madrid"]],
  ["Rustu Recber", "Turkey", ["Fenerbahce", "Besiktas", "Barcelona"]],
  ["Alpay Ozalan", "Turkey", ["Trabzonspor", "Fenerbahce", "Aston Villa"]],
  ["Tugay Kerimoglu", "Turkey", ["Galatasaray", "Rangers", "Blackburn Rovers"]],
  ["Okan Buruk", "Turkey", ["Galatasaray", "Inter Milan", "Standard Liege"]],
  ["Tuncay Sanli", "Turkey", ["Fenerbahce", "Middlesbrough", "Stoke City", "Wolfsburg"]],
  ["Volkan Demirel", "Turkey", ["Fenerbahce"]],
  ["Selcuk Inan", "Turkey", ["Galatasaray"]],
  ["Sergen Yalcin", "Turkey", ["Besiktas", "Galatasaray", "Fenerbahce"]],
  ["Nuri Sahin", "Turkey", ["Borussia Dortmund", "Real Madrid", "Liverpool", "Feyenoord"]],
  ["Caner Erkin", "Turkey", ["Fenerbahce", "Besiktas"]],
  ["Cengiz Under", "Turkey", ["Basaksehir", "Roma", "Leicester City", "Marseille", "Fenerbahce"]],
  ["Kerem Akturkoglu", "Turkey", ["Galatasaray", "Benfica"]],
  ["Ozan Tufan", "Turkey", ["Fenerbahce", "Watford", "Besiktas"]],
  ["Roberto Carlos", "Brazil", ["Palmeiras", "Real Madrid", "Corinthians", "Fenerbahce", "Anzhi Makhachkala"]],
  ["Alex de Souza", "Brazil", ["Fenerbahce", "Palmeiras"]],
  ["Ryan Babel", "Netherlands", ["Ajax", "Liverpool", "Hoffenheim", "Kasimpasa", "Besiktas", "Fulham", "Galatasaray"]],
  ["Emre Mor", "Turkey", ["Nordsjaelland", "Borussia Dortmund", "Celta Vigo", "Galatasaray"]],
  ["Cenk Tosun", "Turkey", ["Besiktas", "Everton", "Crystal Palace"]],
  ["Johan Cruyff", "Netherlands", ["Ajax", "Barcelona", "Feyenoord"]],
  ["Franz Beckenbauer", "Germany", ["Bayern Munich", "New York Cosmos", "Hamburger SV"]],
  ["Michel Platini", "France", ["Nancy", "Saint-Etienne", "Juventus"]],
  ["Marco van Basten", "Netherlands", ["Ajax", "AC Milan"]],
  ["Ruud Gullit", "Netherlands", ["Haarlem", "Feyenoord", "PSV Eindhoven", "AC Milan", "Sampdoria", "Chelsea"]],
  ["Roberto Baggio", "Italy", ["Vicenza", "Fiorentina", "Juventus", "AC Milan", "Bologna", "Inter Milan", "Brescia"]],
  ["George Best", "Northern Ireland", ["Manchester United", "Fulham"]],
  ["Bobby Charlton", "England", ["Manchester United"]],
  ["Gerd Muller", "Germany", ["Bayern Munich"]],
  ["Lothar Matthaus", "Germany", ["Borussia Monchengladbach", "Bayern Munich", "Inter Milan"]],
  ["Jurgen Klinsmann", "Germany", ["Stuttgart", "Inter Milan", "Monaco", "Tottenham", "Bayern Munich", "Sampdoria"]],
  ["Rudi Voller", "Germany", ["Werder Bremen", "Roma", "Marseille", "Bayer Leverkusen"]],
  ["Oliver Kahn", "Germany", ["Karlsruhe", "Bayern Munich"]],
  ["Fabio Cannavaro", "Italy", ["Napoli", "Parma", "Inter Milan", "Juventus", "Real Madrid"]],
  ["Alessandro Nesta", "Italy", ["Lazio", "AC Milan"]],
  ["Christian Vieri", "Italy", ["Torino", "Juventus", "Atletico Madrid", "Lazio", "Inter Milan", "AC Milan", "Monaco"]],
  ["Filippo Inzaghi", "Italy", ["Piacenza", "Parma", "Atalanta", "Juventus", "AC Milan"]],
  ["Gabriel Batistuta", "Argentina", ["River Plate", "Fiorentina", "Roma", "Inter Milan"]],
  ["Juan Sebastian Veron", "Argentina", ["Estudiantes", "Boca Juniors", "Sampdoria", "Parma", "Lazio", "Manchester United", "Chelsea", "Inter Milan"]],
  ["Hristo Stoichkov", "Bulgaria", ["CSKA Sofia", "Barcelona", "Parma", "Chicago Fire"]],
  ["Davor Suker", "Croatia", ["Dinamo Zagreb", "Sevilla", "Real Madrid", "Arsenal", "West Ham United"]],
  ["Zvonimir Boban", "Croatia", ["Dinamo Zagreb", "AC Milan", "Celta Vigo"]],
  ["Patrick Kluivert", "Netherlands", ["Ajax", "AC Milan", "Barcelona", "Newcastle United", "Valencia", "PSV Eindhoven"]],
  ["Edgar Davids", "Netherlands", ["Ajax", "AC Milan", "Juventus", "Barcelona", "Inter Milan", "Tottenham"]],
  ["Clarence Seedorf", "Netherlands", ["Ajax", "Sampdoria", "Real Madrid", "Inter Milan", "AC Milan"]],
  ["Frank de Boer", "Netherlands", ["Ajax", "Barcelona", "Galatasaray", "Rangers"]],
  ["Ronald de Boer", "Netherlands", ["Ajax", "Barcelona", "Rangers"]],
  ["Michael Laudrup", "Denmark", ["Brondby", "Lazio", "Juventus", "Barcelona", "Real Madrid", "Ajax"]],
  ["Brian Laudrup", "Denmark", ["Brondby", "Bayern Munich", "Fiorentina", "AC Milan", "Rangers", "Chelsea", "Copenhagen"]],
  ["Gianluca Vialli", "Italy", ["Cremonese", "Sampdoria", "Juventus", "Chelsea"]],
  ["George Weah", "Liberia", ["Monaco", "Paris Saint-Germain", "AC Milan", "Chelsea", "Manchester City", "Marseille"]],
  ["Jay-Jay Okocha", "Nigeria", ["Eintracht Frankfurt", "Fenerbahce", "Paris Saint-Germain", "Bolton Wanderers"]],
  ["Nwankwo Kanu", "Nigeria", ["Ajax", "Inter Milan", "Arsenal", "West Bromwich Albion", "Portsmouth"]],
  ["Sulley Muntari", "Ghana", ["Udinese", "Portsmouth", "Inter Milan", "AC Milan", "Sunderland"]],
  ["Emmanuel Eboue", "Ivory Coast", ["Arsenal", "Galatasaray"]],
  ["Salomon Kalou", "Ivory Coast", ["Feyenoord", "Chelsea", "Lille", "Hertha Berlin"]],
  ["Mohamed Aboutrika", "Egypt", ["Al Ahly"]],
  ["Pablo Aimar", "Argentina", ["River Plate", "Valencia", "Real Zaragoza", "Benfica", "Malaga"]],
  ["Esteban Cambiasso", "Argentina", ["Independiente", "Real Madrid", "Inter Milan", "Leicester City"]],
  ["Walter Samuel", "Argentina", ["Newell's Old Boys", "Boca Juniors", "Roma", "Real Madrid", "Inter Milan"]],
  ["Diego Milito", "Argentina", ["Racing Club", "Genoa", "Real Zaragoza", "Inter Milan"]],
  ["Hernanes", "Brazil", ["Sao Paulo", "Lazio", "Inter Milan", "Juventus"]],
  ["Oscar", "Brazil", ["Internacional", "Chelsea", "Shanghai SIPG"]],
  ["Diego", "Brazil", ["Santos", "Porto", "Werder Bremen", "Juventus", "Wolfsburg", "Atletico Mineiro", "Flamengo"]],
  ["Anderson", "Brazil", ["Gremio", "Porto", "Manchester United"]],
  ["Park Ji-sung", "South Korea", ["PSV Eindhoven", "Manchester United", "Queens Park Rangers"]],
  ["Shinji Okazaki", "Japan", ["Shimizu S-Pulse", "Stuttgart", "Mainz 05", "Leicester City", "Malaga"]],
  ["Keisuke Honda", "Japan", ["VVV-Venlo", "CSKA Moscow", "AC Milan", "Melbourne Victory"]],
  ["Hidetoshi Nakata", "Japan", ["Bellmare Hiratsuka", "Perugia", "Roma", "Parma", "Bologna", "Fiorentina"]],
  ["Landon Donovan", "USA", ["San Jose Earthquakes", "Bayer Leverkusen", "LA Galaxy", "Everton"]],
  ["Clint Dempsey", "USA", ["New England Revolution", "Fulham", "Tottenham", "Seattle Sounders"]],
  ["Tim Howard", "USA", ["Manchester United", "Everton", "Colorado Rapids"]],
  ["Carlos Vela", "Mexico", ["Guadalajara", "Arsenal", "Osasuna", "Real Sociedad", "Los Angeles FC"]],
  ["Rafael Marquez", "Mexico", ["Atlas", "Monaco", "Barcelona", "New York Red Bulls"]],
  ["Andres Guardado", "Mexico", ["Atlas", "Deportivo La Coruna", "Valencia", "PSV Eindhoven", "Bayer Leverkusen", "Real Betis"]],
  ["Giovani dos Santos", "Mexico", ["Barcelona", "Tottenham", "Galatasaray", "Mallorca", "LA Galaxy"]],  // --- EK OYUNCULAR 3 (guncel yildizlar + genis yil araligi icin tarihi efsaneler) ---
  ["Desire Doue", "France", ["Rennes", "Paris Saint-Germain"]],
  ["Joao Neves", "Portugal", ["Benfica", "Paris Saint-Germain"]],
  ["David Raya", "Spain", ["Blackburn Rovers", "Brentford", "Arsenal"]],
  ["Ben White", "England", ["Brighton", "Arsenal"]],
  ["Leandro Trossard", "Belgium", ["Genk", "Brighton", "Arsenal"]],
  ["Riccardo Calafiori", "Italy", ["Roma", "Basel", "Bologna", "Arsenal"]],
  ["Mikel Merino", "Spain", ["Osasuna", "Newcastle United", "Real Sociedad", "Arsenal"]],
  ["Jurrien Timber", "Netherlands", ["Ajax", "Arsenal"]],
  ["Kobbie Mainoo", "England", ["Manchester United"]],
  ["Alejandro Garnacho", "Argentina", ["Manchester United"]],
  ["Lisandro Martinez", "Argentina", ["Defensa y Justicia", "Ajax", "Manchester United"]],
  ["Noussair Mazraoui", "Morocco", ["Ajax", "Bayern Munich", "Manchester United"]],
  ["Joshua Zirkzee", "Netherlands", ["Bayern Munich", "Bologna", "Manchester United"]],
  ["Josko Gvardiol", "Croatia", ["Dinamo Zagreb", "RB Leipzig", "Manchester City"]],
  ["Jeremy Doku", "Belgium", ["Anderlecht", "Rennes", "Manchester City"]],
  ["Savinho", "Brazil", ["Atletico Mineiro", "Girona", "Manchester City"]],
  ["Omar Marmoush", "Egypt", ["Stuttgart", "Eintracht Frankfurt", "Manchester City"]],
  ["Nico Gonzalez", "Argentina", ["Argentinos Juniors", "Stuttgart", "Fiorentina", "Juventus"]],
  ["Levi Colwill", "England", ["Chelsea"]],
  ["Noni Madueke", "England", ["PSV Eindhoven", "Chelsea"]],
  ["Nicolas Jackson", "Senegal", ["Villarreal", "Chelsea"]],
  ["Robert Sanchez", "Spain", ["Levante", "Brighton", "Chelsea"]],
  ["Inigo Martinez", "Spain", ["Real Sociedad", "Athletic Bilbao", "Barcelona"]],
  ["Dani Olmo", "Spain", ["Dinamo Zagreb", "RB Leipzig", "Barcelona"]],
  ["Pau Cubarsi", "Spain", ["Barcelona"]],
  ["Fermin Lopez", "Spain", ["Barcelona"]],
  ["Konrad Laimer", "Austria", ["Salzburg", "RB Leipzig", "Bayern Munich"]],
  ["Yann Sommer", "Switzerland", ["Basel", "Borussia Monchengladbach", "Bayern Munich", "Inter Milan"]],
  ["Tijjani Reijnders", "Netherlands", ["AZ Alkmaar", "AC Milan"]],
  ["Kenan Yildiz", "Turkey", ["Juventus"]],
  ["Alexander Isak", "Sweden", ["AIK", "Borussia Dortmund", "Real Sociedad", "Newcastle United"]],
  ["Anthony Gordon", "England", ["Everton", "Newcastle United"]],
  ["Bruno Guimaraes", "Brazil", ["Athletico Paranaense", "Lyon", "Newcastle United"]],
  ["Kieran Trippier", "England", ["Burnley", "Tottenham", "Atletico Madrid", "Newcastle United"]],
  ["Sven Botman", "Netherlands", ["Ajax", "Lille", "Newcastle United"]],
  ["Callum Wilson", "England", ["Coventry City", "Bournemouth", "Newcastle United"]],
  ["Ollie Watkins", "England", ["Exeter City", "Brentford", "Aston Villa"]],
  ["John McGinn", "Scotland", ["Hibernian", "Aston Villa"]],
  ["Douglas Luiz", "Brazil", ["Vasco da Gama", "Manchester City", "Girona", "Aston Villa", "Juventus"]],
  ["Victor Boniface", "Nigeria", ["Union SG", "Bayer Leverkusen"]],
  ["Alex Grimaldo", "Spain", ["Barcelona", "Benfica"]],
  ["Mario Balotelli", "Italy", ["Inter Milan", "Manchester City", "AC Milan", "Liverpool", "Nice", "Marseille", "Adana Demirspor", "Genoa"]],
  ["Younes Belhanda", "Morocco", ["Montpellier", "Galatasaray", "Basaksehir"]],
  ["Michy Batshuayi", "Belgium", ["Standard Liege", "Marseille", "Chelsea", "Borussia Dortmund", "Crystal Palace", "Besiktas", "Fenerbahce"]],
  ["Miralem Pjanic", "Bosnia", ["Metz", "Lyon", "Roma", "Juventus", "Barcelona", "Besiktas"]],
  ["Rodrigo Bentancur", "Uruguay", ["Boca Juniors", "Juventus", "Tottenham"]],
  ["Edin Visca", "Bosnia", ["Basaksehir", "Trabzonspor"]],
  ["Anderson Talisca", "Brazil", ["Bahia", "Benfica", "Besiktas", "Al Nassr"]],
  ["Ryan Kent", "England", ["Liverpool", "Rangers", "Fenerbahce"]],
  ["Bright Osayi-Samuel", "Nigeria", ["Queens Park Rangers", "Fenerbahce"]],
  ["Eusebio", "Portugal", ["Benfica"]],
  ["Bobby Moore", "England", ["West Ham United", "Fulham"]],
  ["Gordon Banks", "England", ["Leicester City", "Stoke City"]],
  ["Franco Baresi", "Italy", ["AC Milan"]],
  ["Dino Zoff", "Italy", ["Udinese", "Napoli", "Juventus"]],
  ["Kenny Dalglish", "Scotland", ["Celtic", "Liverpool"]],
  ["Denis Law", "Scotland", ["Huddersfield Town", "Manchester City", "Torino", "Manchester United"]],
  ["Ferenc Puskas", "Hungary", ["Honved", "Real Madrid"]],
  ["Alfredo Di Stefano", "Argentina", ["River Plate", "Millonarios", "Real Madrid", "Espanyol"]],
  ["Pele", "Brazil", ["Santos", "New York Cosmos"]],
  ["Zico", "Brazil", ["Flamengo", "Udinese", "Kashima Antlers"]],
  ["Socrates", "Brazil", ["Corinthians", "Fiorentina", "Flamengo"]],
  ["Careca", "Brazil", ["Guarani", "Sao Paulo", "Napoli", "Kashiwa Reysol"]],
  ["Bebeto", "Brazil", ["Flamengo", "Vasco da Gama", "Deportivo La Coruna"]],
  ["Preben Elkjaer", "Denmark", ["Vejle", "Lokeren", "Verona"]],
  ["Allan Simonsen", "Denmark", ["Vejle", "Borussia Monchengladbach", "Barcelona", "Charlton Athletic"]],
  ["Peter Shilton", "England", ["Leicester City", "Stoke City", "Nottingham Forest", "Southampton", "Derby County"]],
  ["Gary Lineker", "England", ["Leicester City", "Everton", "Barcelona", "Tottenham"]],
  ["Paul Gascoigne", "England", ["Newcastle United", "Tottenham", "Lazio", "Rangers", "Middlesbrough", "Everton"]],
  ["Peter Beardsley", "England", ["Newcastle United", "Liverpool", "Everton"]],
  ["Emlyn Hughes", "England", ["Liverpool", "Wolverhampton Wanderers"]],
  ["Kevin Keegan", "England", ["Scunthorpe United", "Liverpool", "Hamburger SV", "Southampton", "Newcastle United"]],
  ["Trevor Francis", "England", ["Birmingham City", "Nottingham Forest", "Manchester City", "Sampdoria"]],
  ["Glenn Hoddle", "England", ["Tottenham", "Monaco", "Chelsea"]],
  ["Bryan Robson", "England", ["West Bromwich Albion", "Manchester United"]],
  ["Terry Butcher", "England", ["Ipswich Town", "Rangers"]],
  ["Chris Waddle", "England", ["Newcastle United", "Tottenham", "Marseille", "Sheffield Wednesday"]],
  ["Peter Crouch", "England", ["Tottenham", "Aston Villa", "Southampton", "Liverpool", "Portsmouth", "Stoke City"]],
  ["Emile Heskey", "England", ["Leicester City", "Liverpool", "Birmingham City", "Wigan Athletic", "Aston Villa"]],
  ["Darren Anderton", "England", ["Portsmouth", "Tottenham"]],
  ["Teddy Sheringham", "England", ["Millwall", "Nottingham Forest", "Tottenham", "Manchester United", "Portsmouth", "West Ham United"]],
  ["Les Ferdinand", "England", ["Queens Park Rangers", "Newcastle United", "Tottenham", "West Ham United"]],
  ["Matt Le Tissier", "England", ["Southampton"]],
  ["Stuart Pearce", "England", ["Nottingham Forest", "West Ham United", "Manchester City"]],
  ["David Seaman", "England", ["Leeds United", "Queens Park Rangers", "Arsenal", "Manchester City"]],
  ["Nigel Winterburn", "England", ["Wimbledon", "Arsenal", "West Ham United"]],
  ["Tony Adams", "England", ["Arsenal"]],
  ["Martin Keown", "England", ["Arsenal", "Everton", "Aston Villa"]],
  ["Ray Parlour", "England", ["Arsenal", "Middlesbrough"]],
  ["David Platt", "England", ["Crewe Alexandra", "Aston Villa", "Bari", "Juventus", "Sampdoria", "Arsenal"]],
  ["Roberto Mancini", "Italy", ["Bologna", "Sampdoria", "Lazio"]],
  ["Salvatore Schillaci", "Italy", ["Messina", "Juventus", "Inter Milan"]],
  ["Alessandro Costacurta", "Italy", ["AC Milan"]],
  ["Demetrio Albertini", "Italy", ["AC Milan", "Barcelona", "Atletico Madrid"]],
  ["Christian Panucci", "Italy", ["AC Milan", "Real Madrid", "Chelsea", "Roma", "Monaco"]],
  ["Antonio Cassano", "Italy", ["Bari", "Roma", "Real Madrid", "Sampdoria", "AC Milan", "Parma"]],
  ["Antonio Di Natale", "Italy", ["Empoli", "Viterbese", "Udinese"]],
  ["Simone Inzaghi", "Italy", ["Piacenza", "Lazio"]],
  ["Marco Materazzi", "Italy", ["Messina", "Perugia", "Everton", "Inter Milan"]],
  ["Gennaro Gattuso", "Italy", ["Perugia", "Rangers", "AC Milan"]],
  ["Alessandro Diamanti", "Italy", ["Livorno", "West Ham United", "Bologna"]],
  ["Mauro Camoranesi", "Italy", ["Cruzeiro", "Banfield", "Hellas Verona", "Juventus"]],
  ["Fabio Grosso", "Italy", ["Chieti", "Perugia", "Palermo", "Inter Milan", "Lyon", "Juventus"]],
  ["Gianluca Zambrotta", "Italy", ["Como", "Juventus", "Barcelona", "AC Milan"]],
  ["Marco Delvecchio", "Italy", ["Roma"]],
  ["Vincenzo Montella", "Italy", ["Empoli", "Genoa", "Sampdoria", "Roma"]],
  ["Bixente Lizarazu", "France", ["Bordeaux", "Athletic Bilbao", "Bayern Munich"]],
  ["Youri Djorkaeff", "France", ["Grenoble", "Strasbourg", "Monaco", "Paris Saint-Germain", "Inter Milan", "Kaiserslautern", "Bolton Wanderers"]],
  ["Christian Karembeu", "France", ["Nantes", "Sampdoria", "Real Madrid", "Middlesbrough", "Olympiacos"]],
  ["Alain Boghossian", "France", ["Sochaux", "Sampdoria", "Parma", "Napoli"]],
  ["Marcel Petit", "France", ["Monaco", "Arsenal", "Barcelona", "Chelsea"]],
  ["Fabien Barthez", "France", ["Toulouse", "Marseille", "Monaco", "Manchester United"]],
  ["Laurent Blanc", "France", ["Montpellier", "Napoli", "Nimes", "Saint-Etienne", "Auxerre", "Barcelona", "Marseille", "Inter Milan", "Manchester United"]],
  ["Lilian Thuram", "France", ["Monaco", "Parma", "Juventus", "Barcelona"]],
  ["Vincent Candela", "France", ["Guingamp", "Roma"]],
  ["Sylvain Wiltord", "France", ["Rennes", "Bordeaux", "Arsenal", "Lyon"]],
  ["David Trezeguet", "France", ["Monaco", "Juventus", "Hercules", "Baniyas"]],
  ["Steve Marlet", "France", ["Marseille", "Lyon", "Fulham", "Olympique Lyonnais"]],
  ["Ludovic Giuly", "France", ["Monaco", "Barcelona", "Roma", "Paris Saint-Germain"]],
  ["Andres Escobar", "Colombia", ["Atletico Nacional"]],
  ["Carlos Valderrama", "Colombia", ["Millonarios", "Deportivo Cali", "Montpellier", "Valladolid", "Junior"]],
  ["Faustino Asprilla", "Colombia", ["Atletico Nacional", "Parma", "Newcastle United", "Palmeiras"]],
  ["Ivan Cordoba", "Colombia", ["Deportivo Cali", "Inter Milan"]],
  ["Rene Higuita", "Colombia", ["Atletico Nacional", "Real Valladolid"]],
  ["Ivan Zamorano", "Chile", ["Cobresal", "Universidad Catolica", "Sevilla", "Real Madrid", "Inter Milan"]],
  ["Marcelo Salas", "Chile", ["Universidad de Chile", "River Plate", "Lazio", "Juventus"]],
  ["Elias Figueroa", "Chile", ["Santiago Wanderers", "Penarol", "Internacional"]],
  ["Enzo Francescoli", "Uruguay", ["Wanderers", "River Plate", "Racing Club", "Marseille", "Cagliari", "Torino"]],
  ["Alvaro Recoba", "Uruguay", ["Danubio", "Inter Milan", "Venezia", "Torino"]],
  ["Nestor Lorenzo", "Argentina", ["Estudiantes"]],
  ["Ariel Ortega", "Argentina", ["River Plate", "Valencia", "Parma", "Sampdoria", "Fenerbahce"]],
  ["Fernando Redondo", "Argentina", ["Argentinos Juniors", "Tenerife", "Real Madrid", "AC Milan"]],
  ["Claudio Caniggia", "Argentina", ["River Plate", "Verona", "Atalanta", "Benfica", "Rangers", "Boca Juniors"]],
  ["Gabriel Heinze", "Argentina", ["Newell's Old Boys", "Real Valladolid", "Paris Saint-Germain", "Manchester United", "Real Madrid", "Marseille"]],
  ["Roberto Ayala", "Argentina", ["River Plate", "Napoli", "Valencia"]],
];


// ---------------------------------------------------------------------------
function seed() {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      country TEXT NOT NULL
    );
    CREATE TABLE countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nationality TEXT NOT NULL,
      clubs TEXT NOT NULL -- JSON array
    );
  `);

  const insertClub = db.prepare("INSERT OR IGNORE INTO clubs (name, country) VALUES (?, ?)");
  const insertCountry = db.prepare("INSERT OR IGNORE INTO countries (name) VALUES (?)");
  const insertPlayer = db.prepare("INSERT INTO players (name, nationality, clubs) VALUES (?, ?, ?)");

  const tx = db.transaction(() => {
    const clubNames = new Set();
    for (const [name, country] of CLUBS) {
      insertClub.run(name, country);
      insertCountry.run(country);
      clubNames.add(name);
    }
    for (const [name, nat, clubs] of PLAYERS) {
      insertCountry.run(nat);
      // Oyuncunun oynadigi her kulubun clubs tablosunda da bulunmasini garanti et
      for (const c of clubs) {
        if (!clubNames.has(c)) {
          insertClub.run(c, nat);
          clubNames.add(c);
        }
      }
      insertPlayer.run(name, nat, JSON.stringify(clubs));
    }
  });
  tx();

  const clubCount = db.prepare("SELECT COUNT(*) c FROM clubs").get().c;
  const countryCount = db.prepare("SELECT COUNT(*) c FROM countries").get().c;
  const playerCount = db.prepare("SELECT COUNT(*) c FROM players").get().c;
  console.log(`[seed] clubs=${clubCount} countries=${countryCount} players=${playerCount}`);

  db.close();
}

if (require.main === module) {
  seed();
}

module.exports = { seed, DB_PATH };
