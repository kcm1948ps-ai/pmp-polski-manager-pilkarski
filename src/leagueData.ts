import { podkarpackieLeagueGroups } from './podkarpackieLeagueData.ts'
import { zachodniopomorskieLeagueGroups } from './zachodniopomorskieLeagueData.ts'
import { pomorskieLeagueGroups } from './pomorskieLeagueData.ts'
import { warminskoMazurskieLeagueGroups } from './warminskoMazurskieLeagueData.ts'
import { opolskieLeagueGroups } from './opolskieLeagueData.ts'
import { lubuskieLeagueGroups } from './lubuskieLeagueData.ts'

export type LeagueTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export const leagueGroups = {
  'third-1': {
    tier: 4,
    name: 'Trzecia Liga Polska · grupa I',
    subtitle: 'Czwarty poziom · grupa I',
    clubs: [
      'KTS Weszło', 'Wigry Suwałki', 'Świt Nowy Dwór Mazowiecki', 'Pelikan Łowicz', 'Mazovia Mińsk Mazowiecki',
      'Ząbkovia Ząbki', 'Mazur Płock II', 'Warta Sieradz', 'Olimpia Zambrów', 'Olimpia Elbląg',
      'Żubr Białystok II', 'Włókniarz Łódź II', 'Łodzianka Łódź II', 'Lechia Tomaszów Mazowiecki',
      'Mławianka Mława', 'Polonia Lidzbark Warmiński', 'KS CK Troszyn', 'ŁKS Łomża',
    ],
  },
  'third-2': {
    tier: 4,
    name: 'Trzecia Liga Polska · grupa II',
    subtitle: 'Czwarty poziom · grupa II',
    clubs: [
      'Polonia Środa Wielkopolska', 'Wikęd Luzino', 'Wda Świecie', 'Kluczevia Stargard', 'Błękitni Stargard',
      'Bałtyk Koszalin', 'Gryf Poznań II', 'Noteć Czarnków', 'KKS 1925 Kalisz', 'Grom Nowy Staw',
      'Elana Toruń', 'Unia Swarzędz', 'Gedania Gdańsk', 'Flota Świnoujście', 'Chemik Moderator Bydgoszcz',
      'Victoria Września', 'Lipno Stęszew', 'Kotwica Kórnik',
    ],
  },
  'third-3': {
    tier: 4,
    name: 'Trzecia Liga Polska · grupa III',
    subtitle: 'Czwarty poziom · grupa III',
    clubs: [
      'Zagłębie Sosnowiec', 'Sparta Katowice', 'Odra Skrzynie Zając Bytom Odrzański', 'Miedziak Lubin II',
      'Barycz Sułów', 'ROW 1964 Rybnik', 'Karkonosze Jelenia Góra', 'Górnik Polkowice', 'Kolej Legnica II',
      'Stilon Gorzów Wielkopolski', 'Stal Brzeg', 'Panattoni Goczałkowice-Zdrój', 'MKS Kluczbork',
      'Warta Gorzów Wielkopolski', 'Straż Częstochowa II', 'Polonia Nysa', 'Carina Gubin', 'Ślęza Wrocław',
    ],
  },
  'third-4': {
    tier: 4,
    name: 'Trzecia Liga Polska · grupa IV',
    subtitle: 'Czwarty poziom · grupa IV',
    clubs: [
      'Chełmianka Chełm', 'KSZO 1929 Ostrowiec Świętokrzyski', 'Wisłoka Dębica', 'Naprzód Jędrzejów',
      'Wiślanie Master Way Skawina', 'Czarni Połaniec', 'Hetman Zamość', 'JKS Jarosław', 'Siarka Tarnobrzeg',
      'Sokół Kolbuszowa Dolna', 'Smok Kraków II', 'Bursztyn Kraków II', 'Star Starachowice', 'Jodła Kielce II',
      'AKS 1947 Busko-Zdrój', 'Podlasie Biała Podlaska', 'Moravia Kopalnia Morawica', 'Pogoń-Sokół Lubaczów',
    ],
  },
  'fourth-dolnoslaskie': {
    tier: 5,
    name: 'Czwarta liga Polska · dolnośląska',
    subtitle: 'Piąty poziom · województwo dolnośląskie',
    clubs: [
      'Ratusz Głogów II', 'Piast Żmigród', 'Lechia Dzierżoniów', 'Górnik Złotoryja', 'Błyskawica Gać',
      'MOTO-JELCZ Oława', 'Polonia Bielany Wrocławskie', 'GKS Mirków-Długołęka', 'Cement Raciborowice',
      'AKS Bazalt Strzegom', 'Polonia Środa Śląska', 'Orzeł Ząbkowice Śląskie', 'WKS Wierzbice',
      'MKS Odra Ścinawa', 'Iskra Księginice', 'Piast Nowa Ruda', 'Polonia Świdnica', 'Prochowiczanka Prochowice',
    ],
  },
  'fourth-kujawsko-pomorskie': {
    tier: 5,
    name: 'Czwarta liga Polska · kujawsko-pomorska',
    subtitle: 'Piąty poziom · województwo kujawsko-pomorskie',
    clubs: [
      'Unia Solec Kujawski', 'Tłuchowia Tłuchowo', 'Unia Wąbrzeźno', 'Pogoń Mogilno', 'Wisła Dobrzyń nad Wisłą',
      'Mustang Ostaszewo', 'Sparta Brodnica', 'Kujawiak Kowal', 'Pomorzanin Toruń', 'Start ECO-POL Pruszcz',
      'Skrwa Skrwilno', 'Victoria Czernikowo', 'Rawys CEO Raciąż', 'Lech Rypin', 'Cuiavia Inowrocław',
      'Łokietek Brześć Kujawski', 'Noteć Gębice', 'Orlęta Aleksandrów Kujawski',
    ],
  },
  'fourth-lodzkie': {
    tier: 5,
    name: 'Czwarta liga Polska · łódzka',
    subtitle: 'Piąty poziom · województwo łódzkie',
    clubs: [
      'RKS Radomsko', 'GKS Buczek', 'Polonia Piotrków Trybunalski', 'Zjednoczeni Stryków', 'Włókniarz Pabianice',
      'AKS SMS Łódź', 'Sokół Aleksandrów', 'KS Kutno', 'GKS Bełchatów', 'Stal Głowno', 'Ceramika Opoczno',
      'Orzeł Parzęczew', 'Łodzianka Łódź III', 'Zryw Wygoda', 'Boruta Zgierz', 'Ekolog Wojsławice',
      'Concordia 1909 Piotrków Trybunalski', 'LZS Justynów',
    ],
  },
  'fourth-lubelskie': {
    tier: 5,
    name: 'Czwarta liga Polska · lubelska',
    subtitle: 'Piąty poziom · województwo lubelskie',
    clubs: [
      'Łada 1945 Biłgoraj', 'Lublinianka', 'Lewart Lubartów', 'Sokolik Świdnik II', 'Orlęta-Spomlek Radzyń Podlaski',
      'Powiślak Końskowola', 'Granit Bychawa', 'Victoria Łukowa', 'Kopalnia Łęczna U21', 'Janowianka Janów Lubelski',
      'Tomasovia Tomaszów Lubelski', 'Ruch Ryki', 'Bug Hanna', 'Świdniczanka Świdnik', 'Tur Milejów', 'Orlęta Łuków',
    ],
  },
  'fourth-lubuskie': {
    tier: 5,
    name: 'Czwarta liga Polska · lubuska',
    subtitle: 'Piąty poziom · województwo lubuskie',
    clubs: [
      'Victoria Szczaniec', 'Polonia Słubice', 'Korona Kożuchów', 'Czarni Żagań 1957', 'Winobranie Zielona Góra II',
      'Celuloza Kostrzyn nad Odrą', 'Piast Karnin', 'Pogoń Świebodzin', 'Odra Nietków', 'Ilanka Rzepin',
      'Róża Różanki', 'Piast Iłowa', 'Promień Żary', 'Pogoń Skwierzyna', 'Dozamet Nowa Sól', 'Sprotavia Szprotawa',
      'Stal Sulęcin', 'Łucznik Strzelce Krajeńskie',
    ],
  },
  'fourth-malopolskie': {
    tier: 5,
    name: 'Czwarta liga Polska · małopolska',
    subtitle: 'Piąty poziom · województwo małopolskie',
    clubs: [
      'Brama Kraków II', 'Victoria Jaworzno', 'Dalin Myślenice', 'Termit Nieciecza II', 'Glinik Gorlice',
      'Orzeł Ryczów', 'Młot Kraków II', 'Wolania Wola Rzędzińska', 'Pcimianka Pcim', 'Lubań Maniowy',
      'Beskid Andrychów', 'BKS Hal-Mont Bochnia', 'Unia Tarnów', 'Kalwarianka Kalwaria Zebrzydowska',
      'Limanovia Limanowa', 'Poprad Muszyna', 'Watra Białka Tatrzańska', 'Błękitni Modlnica',
    ],
  },
  'fourth-mazowieckie': {
    tier: 5,
    name: 'Czwarta liga Polska · mazowiecka',
    subtitle: 'Piąty poziom · województwo mazowieckie',
    clubs: [
      'Hutnik Warszawa', 'MKS Piaseczno', 'Podlasie Sokołów Podlaski', 'Ursus Warszawa', 'Makowianka Maków Mazowiecki',
      'Oskar Przysucha', 'Syrena Warszawa II', 'Legionovia Legionowo', 'Broń Radom', 'Mszczonowianka Mszczonów',
      'Talent Warszawa', 'Błonianka Błonie', 'Enea Energia Kozienice', 'Mazur Karczew', 'Nadnarwianka Pułtusk',
      'Łomianki', 'Victoria Sulejówek', 'Przasnysz',
    ],
  },
  'fourth-opolskie': {
    tier: 5,
    name: 'Czwarta liga Polska · opolska',
    subtitle: 'Piąty poziom · województwo opolskie',
    clubs: [
      'Polonia Nysa', 'LZS Starowice Dolne', 'Ruch Zdzieszowice', 'Małapanew Ozimek', 'Opolski Grom Opole II',
      'LZS Domaszkowice', 'Start Namysłów', 'Fortuna Głogówek', 'LZS Starościn', 'Śląsk Łubniany',
      'Polonia Karłowice', 'Po-Ra-Wie Większyce', 'LZS Adamietz Kadłub', 'Stal Zawadzkie', 'MKS Gogolin',
      'Victoria Żyrowa',
    ],
  },
  'fourth-podkarpackie': {
    tier: 5,
    name: 'Czwarta liga Polska · podkarpacka',
    subtitle: 'Piąty poziom · województwo podkarpackie',
    clubs: [
      'Igloopol Dębica', 'Błękitni Ropczyce', 'KS Wiązownica', 'Górnik Strachocina', 'Ekoball Stal Sanok',
      'Izolator Boguchwała', 'Sokół Nisko', 'Rzeszowska Fala Rzeszów II', 'Pogoń-Sokół II Lubaczów', 'Stal Łańcut',
      'Polonia Przemyśl', 'Sokół Sieniawa', 'Legion Pilzno', 'Czarni Jasło', 'Wisłok Wiśniowa', 'Strug Tyczyn',
      'Radomyślanka Geyer & Hosaja Radomyśl Wielki', 'Pogoń Leżajsk',
    ],
  },
  'fourth-podlaskie': {
    tier: 5,
    name: 'Czwarta liga Polska · podlaska',
    subtitle: 'Piąty poziom · województwo podlaskie',
    clubs: [
      'Wasilków', 'Warmia Grajewo', 'ŁKS II Łomża', 'Tur Bielsk Podlaski', 'Wissa Szczuczyn',
      'Hetman Skłodowscy Tykocin', 'Pionier Brańsk', 'Promień Mońki', 'Czarni Czarna Białostocka', 'Michałowo',
      'Ruch Wysokie Mazowieckie', 'LZS Krynki', 'Pomorzanka Sejny', 'Krypnianka Krypno', 'Śniadowo',
    ],
  },
  'fourth-pomorskie': {
    tier: 5,
    name: 'Czwarta liga Polska · pomorska',
    subtitle: 'Piąty poziom · województwo pomorskie',
    clubs: [
      'Pogoń Lębork', 'Radunia Stężyca', 'Sparta Sycewice', 'Gryf Wejherowo', 'KP Starogard Gdański',
      'Dolina Speranda Niepoględzie', 'Wierzyca Pelplin', 'Gryf Słupsk', 'Czarni Pruszcz Gdański',
      'Sokół Bożepole Wielkie', 'Stoczniowiec Gdańsk', 'Borowiak Chojnice II', 'Stolem Gniewino',
      'Powiśle Dzierzgoń', 'Jaguar Gdańsk AP', 'Anioły Garczegorze', 'Gdyński Żagiel Gdynia II', 'Cartusia Kartuzy',
    ],
  },
  'fourth-slaskie': {
    tier: 5,
    name: 'Czwarta liga Polska · śląska',
    subtitle: 'Piąty poziom · województwo śląskie',
    clubs: [
      'Unia Turza Śląska', 'Ruch Radzionków', 'MRKS Czechowice-Dziedzice', 'Bielska Przełęcz Bielsko-Biała II',
      'Wicher Chorzów II', 'Sygnał Katowice II', 'Przemsza Siewierz', 'Spójnia Landek-Jasienica', 'Polonia Łaziska Górne',
      'Drama Zbrosławice', 'Szombierki Bytom', 'Kuźnia Ustroń', 'Decor Bełk', 'Podlesianka Katowice',
      'Iskra Gliwice II', 'Gwarek Tarnowskie Góry', 'Rozwój Katowice', 'Victoria Kosmos Częstochowa',
    ],
  },
  'fourth-swietokrzyskie': {
    tier: 5,
    name: 'Czwarta liga Polska · świętokrzyska',
    subtitle: 'Piąty poziom · województwo świętokrzyskie',
    clubs: [
      'Arka Pawłów', 'Orlęta Kielce', 'Sparta Kazimierza Wielka', 'Neptun Końskie', 'GKS Nowiny',
      'Victoria 2015 Skalbmierz', 'Spartakus Daleszyce', 'GKS Rudki', 'OKS Opatów', 'Korona Kielce',
      'Jodła Kielce III', 'Alit Ożarów', 'Wicher Miedziana Góra', 'Klimontowianka Klimontów', 'Wierna Małogoszcz',
      'Granat Skarżysko-Kamienna', 'Hetman Włoszczowa', 'Orlicz Suchedniów',
    ],
  },
  'fourth-warminsko-mazurskie': {
    tier: 5,
    name: 'Czwarta liga Polska · warmińsko-mazurska',
    subtitle: 'Piąty poziom · województwo warmińsko-mazurskie',
    clubs: [
      'Stomil Olsztyn SA', 'MMKS Concordia Elbląg', 'KKS Granica Kętrzyn', 'GKS LZS Wikielec', 'OKS Sokół Ostróda',
      'BKS Tęcza Biskupiec', 'GKS Pisa Eco-Ter Barczewo', 'DKS Dobre Miasto', 'MKS Rominta Gołdap', 'MLKS Znicz Biała Piska',
      'MKS Mazur Ełk', 'MKS Start Nidzica', 'UKS Naki Olsztyn', 'GKS Mamry Giżycko', 'MKS Zatoka Braniewo', 'KS Polonia Pasłęk',
    ],
  },
  'fourth-wielkopolskie': {
    tier: 5,
    name: 'Czwarta liga Polska · wielkopolska',
    subtitle: 'Piąty poziom · województwo wielkopolskie',
    clubs: [
      'Górnik Konin', 'Pogoń Nowe Skalmierzyce', 'Polonia Golina', 'Mieszko Gniezno', 'Obra 1912 Kościan',
      'Piast Kobylnica', 'Polonia Chodzież', 'Kania Gostyń', 'Kłos Budzyń', 'Gołuchów', 'Astra Krotoszyn',
      'Polonia 1912 Leszno', 'Meblorz Swarzędz', 'Huragan Pobiedziska', 'Warta Śrem', 'Nielba Wągrowiec',
      'Avia Kamionki', 'Ostrovia 1909 Ostrów Wielkopolski',
    ],
  },
  'fourth-zachodniopomorskie': {
    tier: 5,
    name: 'Czwarta liga Polska · zachodniopomorska',
    subtitle: 'Piąty poziom · województwo zachodniopomorskie',
    clubs: [
      'Latarnia Szczecin II', 'Wybrzeże Rewalskie Rewal', 'Arkonia Szczecin', 'Kotwica Kołobrzeg', 'Zorza Szczecin II',
      'Gwardia Koszalin', 'Biali Sądów', 'Sparta Gryfice', 'Dąb Dębno', 'Astra Ustronie Morskie', 'Iskierka Szczecin',
      'Ina Elektrobim Ińsko', 'Chemik Police', 'Orzeł Wałcz', 'Pogoń Barlinek', 'GKS Manowo',
    ],
  },
  ...podkarpackieLeagueGroups,
  ...zachodniopomorskieLeagueGroups,
  ...pomorskieLeagueGroups,
  ...warminskoMazurskieLeagueGroups,
  ...opolskieLeagueGroups,
  ...lubuskieLeagueGroups,
} as const satisfies Record<string, { tier: LeagueTier; name: string; subtitle: string; clubs: readonly string[]; regionId?: string }>
