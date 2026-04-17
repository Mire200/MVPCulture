#!/usr/bin/env node
// Generates ~1000 Wikipedia-sourced questions across all 7 game modes.
// Writes one file per mode in ../seed/wikipedia-<mode>.json.
// Usage: node packages/content/scripts/generate-wikipedia.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = resolve(__dirname, '..', 'seed');
mkdirSync(SEED_DIR, { recursive: true });

const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const lower = (s) => s.toLowerCase().trim();
const aliasesFor = (answer, extras = []) => {
  const set = new Set();
  const add = (v) => { if (v && v.length > 0) set.add(lower(v)); };
  add(answer);
  add(stripAccents(answer));
  add(answer.replace(/^(le |la |les |l'|un |une |des )/i, ''));
  add(stripAccents(answer).replace(/^(le |la |les |l'|un |une |des )/i, ''));
  extras.forEach(add);
  return Array.from(set).filter((v) => v !== lower(answer));
};

// ----------------------------------------------------------------------------
// DATA (all facts sourced from Wikipedia)
// ----------------------------------------------------------------------------

// [fr-name, capital, continent, population-millions, area-km2, lat, lng, difficulty]
const COUNTRIES = [
  ['France', 'Paris', 'Europe', 68.05, 643801, 48.8566, 2.3522, 'easy'],
  ['Allemagne', 'Berlin', 'Europe', 84.36, 357022, 52.52, 13.405, 'easy'],
  ['Italie', 'Rome', 'Europe', 58.85, 301340, 41.9028, 12.4964, 'easy'],
  ['Espagne', 'Madrid', 'Europe', 48.59, 505990, 40.4168, -3.7038, 'easy'],
  ['Portugal', 'Lisbonne', 'Europe', 10.35, 92212, 38.7223, -9.1393, 'easy'],
  ['Belgique', 'Bruxelles', 'Europe', 11.69, 30528, 50.8503, 4.3517, 'easy'],
  ['Pays-Bas', 'Amsterdam', 'Europe', 17.62, 41850, 52.3676, 4.9041, 'easy'],
  ['Suisse', 'Berne', 'Europe', 8.77, 41285, 46.948, 7.4474, 'medium'],
  ['Autriche', 'Vienne', 'Europe', 9.04, 83879, 48.2082, 16.3738, 'easy'],
  ['Royaume-Uni', 'Londres', 'Europe', 67.33, 243610, 51.5074, -0.1278, 'easy'],
  ['Irlande', 'Dublin', 'Europe', 5.15, 70273, 53.3498, -6.2603, 'easy'],
  ['Danemark', 'Copenhague', 'Europe', 5.93, 43094, 55.6761, 12.5683, 'easy'],
  ['Norvège', 'Oslo', 'Europe', 5.51, 385207, 59.9139, 10.7522, 'easy'],
  ['Suède', 'Stockholm', 'Europe', 10.55, 450295, 59.3293, 18.0686, 'easy'],
  ['Finlande', 'Helsinki', 'Europe', 5.55, 338424, 60.1699, 24.9384, 'easy'],
  ['Islande', 'Reykjavik', 'Europe', 0.39, 103000, 64.1466, -21.9426, 'medium'],
  ['Pologne', 'Varsovie', 'Europe', 37.64, 312696, 52.2297, 21.0122, 'medium'],
  ['République tchèque', 'Prague', 'Europe', 10.51, 78867, 50.0755, 14.4378, 'medium'],
  ['Hongrie', 'Budapest', 'Europe', 9.6, 93030, 47.4979, 19.0402, 'medium'],
  ['Roumanie', 'Bucarest', 'Europe', 19.05, 238397, 44.4268, 26.1025, 'medium'],
  ['Grèce', 'Athènes', 'Europe', 10.41, 131957, 37.9838, 23.7275, 'easy'],
  ['Bulgarie', 'Sofia', 'Europe', 6.87, 110879, 42.6977, 23.3219, 'medium'],
  ['Croatie', 'Zagreb', 'Europe', 3.87, 56594, 45.815, 15.9819, 'medium'],
  ['Serbie', 'Belgrade', 'Europe', 6.64, 77474, 44.7866, 20.4489, 'medium'],
  ['Ukraine', 'Kiev', 'Europe', 36.74, 603500, 50.4501, 30.5234, 'easy'],
  ['Biélorussie', 'Minsk', 'Europe', 9.2, 207600, 53.9006, 27.5591, 'hard'],
  ['Russie', 'Moscou', 'Europe', 143.4, 17098246, 55.7558, 37.6173, 'easy'],
  ['Turquie', 'Ankara', 'Asie', 85.81, 783356, 39.9334, 32.8597, 'medium'],
  ['Moldavie', 'Chișinău', 'Europe', 2.6, 33846, 47.0105, 28.8638, 'hard'],
  ['Slovaquie', 'Bratislava', 'Europe', 5.43, 49035, 48.1486, 17.1077, 'hard'],
  ['Slovénie', 'Ljubljana', 'Europe', 2.12, 20273, 46.0569, 14.5058, 'hard'],
  ['Lettonie', 'Riga', 'Europe', 1.88, 64589, 56.9496, 24.1052, 'hard'],
  ['Lituanie', 'Vilnius', 'Europe', 2.86, 65300, 54.6872, 25.2797, 'hard'],
  ['Estonie', 'Tallinn', 'Europe', 1.33, 45227, 59.437, 24.7536, 'hard'],
  ['Luxembourg', 'Luxembourg', 'Europe', 0.66, 2586, 49.6116, 6.1319, 'medium'],
  ['Malte', 'La Valette', 'Europe', 0.52, 316, 35.8989, 14.5146, 'hard'],
  ['Chypre', 'Nicosie', 'Europe', 1.26, 9251, 35.1856, 33.3823, 'medium'],
  ['Albanie', 'Tirana', 'Europe', 2.79, 28748, 41.3275, 19.8187, 'medium'],
  ['Monténégro', 'Podgorica', 'Europe', 0.62, 13812, 42.4304, 19.2594, 'hard'],
  ['Macédoine du Nord', 'Skopje', 'Europe', 2.08, 25713, 41.9973, 21.428, 'hard'],
  ['Kosovo', 'Pristina', 'Europe', 1.93, 10887, 42.6629, 21.1655, 'hard'],
  ['Bosnie-Herzégovine', 'Sarajevo', 'Europe', 3.23, 51209, 43.8563, 18.4131, 'medium'],
  ['Andorre', "Andorre-la-Vieille", 'Europe', 0.08, 468, 42.5063, 1.5218, 'hard'],
  ['Monaco', 'Monaco', 'Europe', 0.04, 2.02, 43.7384, 7.4246, 'medium'],
  ['Vatican', 'Cité du Vatican', 'Europe', 0.001, 0.49, 41.9029, 12.4534, 'medium'],
  ['Saint-Marin', 'Saint-Marin', 'Europe', 0.034, 61, 43.9424, 12.4578, 'hard'],
  ['Chine', 'Pékin', 'Asie', 1411, 9596961, 39.9042, 116.4074, 'easy'],
  ['Japon', 'Tokyo', 'Asie', 125.4, 377975, 35.6762, 139.6503, 'easy'],
  ['Corée du Sud', 'Séoul', 'Asie', 51.63, 100363, 37.5665, 126.978, 'easy'],
  ['Corée du Nord', 'Pyongyang', 'Asie', 25.8, 120540, 39.0392, 125.7625, 'medium'],
  ['Inde', 'New Delhi', 'Asie', 1417, 3287263, 28.6139, 77.209, 'easy'],
  ['Pakistan', 'Islamabad', 'Asie', 240, 881913, 33.6844, 73.0479, 'medium'],
  ['Bangladesh', 'Dacca', 'Asie', 171, 147570, 23.8103, 90.4125, 'medium'],
  ['Sri Lanka', 'Colombo', 'Asie', 22.04, 65610, 6.9271, 79.8612, 'medium'],
  ['Népal', 'Katmandou', 'Asie', 30.03, 147181, 27.7172, 85.324, 'medium'],
  ['Bhoutan', 'Thimphou', 'Asie', 0.78, 38394, 27.4728, 89.6393, 'hard'],
  ['Afghanistan', 'Kaboul', 'Asie', 40.1, 652230, 34.5553, 69.2075, 'medium'],
  ['Iran', 'Téhéran', 'Asie', 88.55, 1648195, 35.6892, 51.389, 'medium'],
  ['Irak', 'Bagdad', 'Asie', 43.53, 438317, 33.3152, 44.3661, 'medium'],
  ['Arabie saoudite', 'Riyad', 'Asie', 36.4, 2149690, 24.7136, 46.6753, 'medium'],
  ['Émirats arabes unis', 'Abou Dabi', 'Asie', 9.9, 83600, 24.4539, 54.3773, 'medium'],
  ['Qatar', 'Doha', 'Asie', 2.69, 11586, 25.2854, 51.531, 'medium'],
  ['Koweït', 'Koweït', 'Asie', 4.25, 17818, 29.3759, 47.9774, 'medium'],
  ['Oman', 'Mascate', 'Asie', 4.58, 309500, 23.588, 58.3829, 'hard'],
  ['Yémen', 'Sanaa', 'Asie', 33.7, 527968, 15.3694, 44.191, 'hard'],
  ['Bahreïn', 'Manama', 'Asie', 1.46, 765, 26.2285, 50.586, 'hard'],
  ['Jordanie', 'Amman', 'Asie', 11.28, 89342, 31.9454, 35.9284, 'medium'],
  ['Liban', 'Beyrouth', 'Asie', 5.48, 10452, 33.8938, 35.5018, 'medium'],
  ['Syrie', 'Damas', 'Asie', 22.13, 185180, 33.5138, 36.2765, 'medium'],
  ['Israël', 'Jérusalem', 'Asie', 9.36, 20770, 31.7683, 35.2137, 'easy'],
  ['Palestine', 'Ramallah', 'Asie', 5.2, 6020, 31.9038, 35.2034, 'hard'],
  ['Thaïlande', 'Bangkok', 'Asie', 71.7, 513120, 13.7563, 100.5018, 'easy'],
  ['Vietnam', 'Hanoï', 'Asie', 98.19, 331212, 21.0285, 105.8542, 'medium'],
  ['Cambodge', 'Phnom Penh', 'Asie', 16.77, 181035, 11.5564, 104.9282, 'medium'],
  ['Laos', 'Vientiane', 'Asie', 7.53, 236800, 17.9757, 102.6331, 'hard'],
  ['Birmanie', 'Naypyidaw', 'Asie', 54.4, 676578, 19.7633, 96.0785, 'hard'],
  ['Malaisie', 'Kuala Lumpur', 'Asie', 33.94, 330803, 3.139, 101.6869, 'medium'],
  ['Singapour', 'Singapour', 'Asie', 5.45, 728.6, 1.3521, 103.8198, 'medium'],
  ['Indonésie', 'Jakarta', 'Asie', 277.5, 1904569, -6.2088, 106.8456, 'easy'],
  ['Philippines', 'Manille', 'Asie', 115.6, 300000, 14.5995, 120.9842, 'medium'],
  ['Brunei', 'Bandar Seri Begawan', 'Asie', 0.45, 5765, 4.9031, 114.9398, 'hard'],
  ['Timor oriental', 'Dili', 'Asie', 1.34, 14874, -8.5569, 125.5603, 'hard'],
  ['Mongolie', 'Oulan-Bator', 'Asie', 3.4, 1564110, 47.8864, 106.9057, 'hard'],
  ['Kazakhstan', 'Astana', 'Asie', 19.6, 2724900, 51.1694, 71.4491, 'medium'],
  ['Ouzbékistan', 'Tachkent', 'Asie', 34.92, 448978, 41.2995, 69.2401, 'hard'],
  ['Kirghizistan', 'Bichkek', 'Asie', 6.69, 199951, 42.8746, 74.5698, 'hard'],
  ['Tadjikistan', 'Douchanbé', 'Asie', 9.75, 143100, 38.5598, 68.787, 'hard'],
  ['Turkménistan', 'Achgabat', 'Asie', 6.43, 488100, 37.9601, 58.3261, 'hard'],
  ['Azerbaïdjan', 'Bakou', 'Asie', 10.14, 86600, 40.4093, 49.8671, 'medium'],
  ['Géorgie', 'Tbilissi', 'Asie', 3.72, 69700, 41.7151, 44.8271, 'medium'],
  ['Arménie', 'Erevan', 'Asie', 2.78, 29743, 40.1792, 44.4991, 'medium'],
  ['Maldives', 'Malé', 'Asie', 0.52, 298, 4.1755, 73.5093, 'hard'],
  ['États-Unis', 'Washington', 'Amérique du Nord', 333.3, 9833520, 38.9072, -77.0369, 'easy'],
  ['Canada', 'Ottawa', 'Amérique du Nord', 39.57, 9984670, 45.4215, -75.6972, 'easy'],
  ['Mexique', 'Mexico', 'Amérique du Nord', 128.5, 1964375, 19.4326, -99.1332, 'easy'],
  ['Cuba', 'La Havane', 'Amérique du Nord', 11.21, 109884, 23.1136, -82.3666, 'easy'],
  ['Haïti', 'Port-au-Prince', 'Amérique du Nord', 11.58, 27750, 18.5944, -72.3074, 'medium'],
  ['République dominicaine', 'Saint-Domingue', 'Amérique du Nord', 11.11, 48671, 18.4861, -69.9312, 'medium'],
  ['Jamaïque', 'Kingston', 'Amérique du Nord', 2.83, 10991, 17.9771, -76.7674, 'medium'],
  ['Bahamas', 'Nassau', 'Amérique du Nord', 0.4, 13943, 25.0343, -77.3963, 'hard'],
  ['Trinité-et-Tobago', 'Port-d\'Espagne', 'Amérique du Nord', 1.53, 5131, 10.6918, -61.2225, 'hard'],
  ['Barbade', 'Bridgetown', 'Amérique du Nord', 0.28, 430, 13.0943, -59.6167, 'hard'],
  ['Guatemala', 'Guatemala', 'Amérique du Nord', 17.6, 108889, 14.6349, -90.5069, 'medium'],
  ['Honduras', 'Tegucigalpa', 'Amérique du Nord', 10.27, 112492, 14.072, -87.1921, 'medium'],
  ['Salvador', 'San Salvador', 'Amérique du Nord', 6.34, 21041, 13.6929, -89.2182, 'hard'],
  ['Nicaragua', 'Managua', 'Amérique du Nord', 6.85, 130373, 12.1149, -86.2362, 'medium'],
  ['Costa Rica', 'San José', 'Amérique du Nord', 5.18, 51100, 9.9281, -84.0907, 'medium'],
  ['Panama', 'Panama', 'Amérique du Nord', 4.41, 75417, 8.9824, -79.5199, 'medium'],
  ['Brésil', 'Brasilia', 'Amérique du Sud', 215.3, 8515767, -15.7939, -47.8828, 'medium'],
  ['Argentine', 'Buenos Aires', 'Amérique du Sud', 46.23, 2780400, -34.6037, -58.3816, 'easy'],
  ['Chili', 'Santiago', 'Amérique du Sud', 19.6, 756102, -33.4489, -70.6693, 'medium'],
  ['Pérou', 'Lima', 'Amérique du Sud', 34.05, 1285216, -12.0464, -77.0428, 'easy'],
  ['Colombie', 'Bogota', 'Amérique du Sud', 51.87, 1141748, 4.711, -74.0721, 'medium'],
  ['Venezuela', 'Caracas', 'Amérique du Sud', 28.3, 916445, 10.4806, -66.9036, 'medium'],
  ['Équateur', 'Quito', 'Amérique du Sud', 17.8, 283561, -0.1807, -78.4678, 'medium'],
  ['Bolivie', 'La Paz', 'Amérique du Sud', 12.22, 1098581, -16.4897, -68.1193, 'medium'],
  ['Paraguay', 'Asunción', 'Amérique du Sud', 6.78, 406752, -25.2637, -57.5759, 'hard'],
  ['Uruguay', 'Montevideo', 'Amérique du Sud', 3.42, 176215, -34.9011, -56.1645, 'medium'],
  ['Guyana', 'Georgetown', 'Amérique du Sud', 0.81, 214969, 6.8013, -58.1551, 'hard'],
  ['Suriname', 'Paramaribo', 'Amérique du Sud', 0.62, 163820, 5.852, -55.2038, 'hard'],
  ['Égypte', 'Le Caire', 'Afrique', 111, 1001449, 30.0444, 31.2357, 'easy'],
  ['Maroc', 'Rabat', 'Afrique', 37.46, 446550, 34.0209, -6.8416, 'easy'],
  ['Algérie', 'Alger', 'Afrique', 44.9, 2381741, 36.7538, 3.0588, 'easy'],
  ['Tunisie', 'Tunis', 'Afrique', 12.36, 163610, 36.8065, 10.1815, 'easy'],
  ['Libye', 'Tripoli', 'Afrique', 6.81, 1759540, 32.8872, 13.1913, 'medium'],
  ['Soudan', 'Khartoum', 'Afrique', 46.87, 1861484, 15.5007, 32.5599, 'medium'],
  ['Éthiopie', 'Addis-Abeba', 'Afrique', 123, 1104300, 9.032, 38.7492, 'medium'],
  ['Kenya', 'Nairobi', 'Afrique', 54.99, 580367, -1.2921, 36.8219, 'medium'],
  ['Tanzanie', 'Dodoma', 'Afrique', 65.5, 945087, -6.163, 35.75, 'medium'],
  ['Ouganda', 'Kampala', 'Afrique', 47.25, 241038, 0.3476, 32.5825, 'medium'],
  ['Rwanda', 'Kigali', 'Afrique', 13.46, 26338, -1.9441, 30.0619, 'medium'],
  ['Burundi', 'Gitega', 'Afrique', 12.89, 27834, -3.4271, 29.9246, 'hard'],
  ['Somalie', 'Mogadiscio', 'Afrique', 17.6, 637657, 2.0469, 45.3182, 'medium'],
  ['Djibouti', 'Djibouti', 'Afrique', 1.12, 23200, 11.5886, 43.1452, 'hard'],
  ['Érythrée', 'Asmara', 'Afrique', 3.68, 117600, 15.3229, 38.9251, 'hard'],
  ['Afrique du Sud', 'Pretoria', 'Afrique', 60.6, 1221037, -25.7479, 28.2293, 'medium'],
  ['Namibie', 'Windhoek', 'Afrique', 2.57, 825615, -22.5609, 17.0658, 'hard'],
  ['Botswana', 'Gaborone', 'Afrique', 2.63, 581730, -24.6282, 25.9231, 'hard'],
  ['Zimbabwe', 'Harare', 'Afrique', 15.99, 390757, -17.8252, 31.0335, 'medium'],
  ['Mozambique', 'Maputo', 'Afrique', 32.97, 801590, -25.9653, 32.5892, 'medium'],
  ['Zambie', 'Lusaka', 'Afrique', 20.02, 752612, -15.3875, 28.3228, 'hard'],
  ['Malawi', 'Lilongwe', 'Afrique', 20.4, 118484, -13.9626, 33.7741, 'hard'],
  ['Angola', 'Luanda', 'Afrique', 35.59, 1246700, -8.839, 13.2894, 'medium'],
  ['Madagascar', 'Antananarivo', 'Afrique', 29.61, 587041, -18.8792, 47.5079, 'medium'],
  ['Nigéria', 'Abuja', 'Afrique', 218.5, 923768, 9.0765, 7.3986, 'medium'],
  ['Ghana', 'Accra', 'Afrique', 33.48, 238533, 5.6037, -0.187, 'medium'],
  ['Côte d\'Ivoire', 'Yamoussoukro', 'Afrique', 28.16, 322463, 6.8276, -5.2893, 'hard'],
  ['Sénégal', 'Dakar', 'Afrique', 17.32, 196722, 14.7167, -17.4677, 'medium'],
  ['Mali', 'Bamako', 'Afrique', 22.59, 1240192, 12.6392, -8.0029, 'medium'],
  ['Burkina Faso', 'Ouagadougou', 'Afrique', 22.67, 272967, 12.3714, -1.5197, 'hard'],
  ['Niger', 'Niamey', 'Afrique', 26.21, 1267000, 13.5128, 2.1128, 'medium'],
  ['Tchad', 'N\'Djamena', 'Afrique', 17.72, 1284000, 12.1348, 15.0557, 'medium'],
  ['Cameroun', 'Yaoundé', 'Afrique', 27.91, 475442, 3.848, 11.5021, 'medium'],
  ['Gabon', 'Libreville', 'Afrique', 2.39, 267667, 0.4162, 9.4673, 'hard'],
  ['Congo', 'Brazzaville', 'Afrique', 5.97, 342000, -4.2634, 15.2429, 'medium'],
  ['République démocratique du Congo', 'Kinshasa', 'Afrique', 99.01, 2344858, -4.4419, 15.2663, 'medium'],
  ['Togo', 'Lomé', 'Afrique', 8.85, 56785, 6.1375, 1.2123, 'hard'],
  ['Bénin', 'Porto-Novo', 'Afrique', 13.35, 114763, 6.4969, 2.6283, 'hard'],
  ['Guinée', 'Conakry', 'Afrique', 13.86, 245857, 9.6412, -13.5784, 'hard'],
  ['Mauritanie', 'Nouakchott', 'Afrique', 4.74, 1030700, 18.0735, -15.9582, 'hard'],
  ['Gambie', 'Banjul', 'Afrique', 2.64, 10689, 13.4549, -16.579, 'hard'],
  ['Libéria', 'Monrovia', 'Afrique', 5.3, 111369, 6.3005, -10.7969, 'hard'],
  ['Sierra Leone', 'Freetown', 'Afrique', 8.6, 71740, 8.4657, -13.2317, 'hard'],
  ['Cap-Vert', 'Praia', 'Afrique', 0.59, 4033, 14.933, -23.5133, 'hard'],
  ['Comores', 'Moroni', 'Afrique', 0.84, 1862, -11.7172, 43.2473, 'hard'],
  ['Maurice', 'Port-Louis', 'Afrique', 1.26, 2040, -20.1609, 57.5012, 'hard'],
  ['Seychelles', 'Victoria', 'Afrique', 0.1, 459, -4.6191, 55.4513, 'hard'],
  ['Australie', 'Canberra', 'Océanie', 26.14, 7692024, -35.2809, 149.13, 'easy'],
  ['Nouvelle-Zélande', 'Wellington', 'Océanie', 5.12, 268021, -41.2866, 174.7756, 'medium'],
  ['Fidji', 'Suva', 'Océanie', 0.93, 18274, -18.1416, 178.4419, 'hard'],
  ['Papouasie-Nouvelle-Guinée', 'Port Moresby', 'Océanie', 10.14, 462840, -9.4438, 147.1803, 'hard'],
  ['Samoa', 'Apia', 'Océanie', 0.22, 2842, -13.759, -172.1046, 'hard'],
  ['Tonga', 'Nuku\'alofa', 'Océanie', 0.11, 747, -21.139, -175.2018, 'hard'],
  ['Vanuatu', 'Port-Vila', 'Océanie', 0.33, 12189, -17.7334, 168.3273, 'hard'],
];

// Historical events (chronology + classic + speed-elim) — year, label, category
const HISTORICAL_EVENTS = [
  [-776, 'Premiers Jeux Olympiques antiques', 'Histoire'],
  [-753, 'Fondation de Rome (légende)', 'Histoire'],
  [-509, 'Fondation de la République romaine', 'Histoire'],
  [-490, 'Bataille de Marathon', 'Histoire'],
  [-480, 'Bataille des Thermopyles', 'Histoire'],
  [-44, 'Assassinat de Jules César', 'Histoire'],
  [-27, 'Auguste devient empereur romain', 'Histoire'],
  [79, 'Éruption du Vésuve (Pompéi)', 'Histoire'],
  [313, 'Édit de Milan (liberté de culte chrétien)', 'Histoire'],
  [476, 'Chute de l\'Empire romain d\'Occident', 'Histoire'],
  [622, 'Hégire (début du calendrier musulman)', 'Histoire'],
  [800, 'Couronnement de Charlemagne', 'Histoire'],
  [1066, 'Bataille de Hastings', 'Histoire'],
  [1095, 'Appel à la première croisade', 'Histoire'],
  [1215, 'Magna Carta en Angleterre', 'Histoire'],
  [1271, 'Marco Polo part pour la Chine', 'Histoire'],
  [1337, 'Début de la guerre de Cent Ans', 'Histoire'],
  [1347, 'Début de la peste noire en Europe', 'Histoire'],
  [1431, 'Mort de Jeanne d\'Arc sur le bûcher', 'Histoire'],
  [1453, 'Chute de Constantinople', 'Histoire'],
  [1492, 'Découverte de l\'Amérique par Christophe Colomb', 'Histoire'],
  [1498, 'Vasco de Gama atteint l\'Inde', 'Histoire'],
  [1517, 'Thèses de Luther (Réforme protestante)', 'Histoire'],
  [1519, 'Magellan commence son tour du monde', 'Histoire'],
  [1534, 'Jacques Cartier découvre le Canada', 'Histoire'],
  [1588, 'Défaite de l\'Invincible Armada', 'Histoire'],
  [1605, 'Publication de Don Quichotte (1ère partie)', 'Littérature'],
  [1610, 'Assassinat d\'Henri IV', 'Histoire'],
  [1643, 'Début du règne de Louis XIV', 'Histoire'],
  [1666, 'Grand incendie de Londres', 'Histoire'],
  [1682, 'Installation de Louis XIV à Versailles', 'Histoire'],
  [1687, 'Principia de Newton', 'Sciences'],
  [1703, 'Fondation de Saint-Pétersbourg', 'Histoire'],
  [1776, 'Déclaration d\'indépendance des États-Unis', 'Histoire'],
  [1789, 'Révolution française / prise de la Bastille', 'Histoire'],
  [1804, 'Sacre de Napoléon empereur', 'Histoire'],
  [1815, 'Bataille de Waterloo', 'Histoire'],
  [1825, 'Première ligne de chemin de fer (Stockton-Darlington)', 'Technologie'],
  [1830, 'Révolution des Trois Glorieuses', 'Histoire'],
  [1839, 'Invention de la photographie (Daguerre)', 'Technologie'],
  [1848, 'Printemps des peuples / manifeste communiste', 'Histoire'],
  [1859, 'Publication de De l\'origine des espèces', 'Sciences'],
  [1863, 'Abolition de l\'esclavage aux États-Unis', 'Histoire'],
  [1869, 'Ouverture du canal de Suez', 'Histoire'],
  [1871, 'Commune de Paris', 'Histoire'],
  [1876, 'Invention du téléphone (Bell)', 'Technologie'],
  [1879, 'Invention de l\'ampoule électrique (Edison)', 'Technologie'],
  [1889, 'Inauguration de la tour Eiffel', 'Histoire'],
  [1896, 'Premiers Jeux Olympiques modernes (Athènes)', 'Sport'],
  [1903, 'Premier vol des frères Wright', 'Technologie'],
  [1905, 'Théorie de la relativité restreinte (Einstein)', 'Sciences'],
  [1912, 'Naufrage du Titanic', 'Histoire'],
  [1914, 'Début de la Première Guerre mondiale', 'Histoire'],
  [1917, 'Révolution russe', 'Histoire'],
  [1918, 'Fin de la Première Guerre mondiale', 'Histoire'],
  [1920, 'Fondation de la Société des Nations', 'Histoire'],
  [1922, 'Marche sur Rome (Mussolini)', 'Histoire'],
  [1927, 'Lindbergh traverse l\'Atlantique en avion', 'Histoire'],
  [1928, 'Découverte de la pénicilline (Fleming)', 'Sciences'],
  [1929, 'Krach boursier de Wall Street', 'Histoire'],
  [1933, 'Hitler devient chancelier d\'Allemagne', 'Histoire'],
  [1936, 'Front populaire en France', 'Histoire'],
  [1939, 'Début de la Seconde Guerre mondiale', 'Histoire'],
  [1941, 'Attaque de Pearl Harbor', 'Histoire'],
  [1944, 'Débarquement de Normandie', 'Histoire'],
  [1945, 'Fin de la Seconde Guerre mondiale / Hiroshima', 'Histoire'],
  [1947, 'Indépendance de l\'Inde', 'Histoire'],
  [1948, 'Création de l\'État d\'Israël', 'Histoire'],
  [1949, 'Fondation de la RFA et de la RDA', 'Histoire'],
  [1953, 'Découverte de la structure de l\'ADN', 'Sciences'],
  [1954, 'Début de la guerre d\'Algérie', 'Histoire'],
  [1957, 'Lancement de Spoutnik (1er satellite)', 'Technologie'],
  [1961, 'Youri Gagarine 1er homme dans l\'espace', 'Technologie'],
  [1962, 'Crise des missiles de Cuba', 'Histoire'],
  [1963, 'Assassinat de John F. Kennedy', 'Histoire'],
  [1968, 'Mai 68 en France', 'Histoire'],
  [1969, 'Premier pas sur la Lune (Armstrong)', 'Histoire'],
  [1973, 'Premier choc pétrolier', 'Histoire'],
  [1975, 'Fin de la guerre du Vietnam', 'Histoire'],
  [1979, 'Révolution islamique en Iran', 'Histoire'],
  [1981, 'Mitterrand élu président de la République', 'Histoire'],
  [1986, 'Catastrophe de Tchernobyl', 'Histoire'],
  [1989, 'Chute du mur de Berlin', 'Histoire'],
  [1991, 'Dissolution de l\'URSS', 'Histoire'],
  [1994, 'Génocide au Rwanda / fin de l\'apartheid', 'Histoire'],
  [1995, 'Création de l\'Organisation mondiale du commerce', 'Histoire'],
  [1998, 'France championne du monde de football', 'Sport'],
  [2001, 'Attentats du 11 septembre', 'Histoire'],
  [2002, 'Passage à l\'euro fiduciaire', 'Histoire'],
  [2004, 'Tsunami dans l\'océan Indien', 'Histoire'],
  [2008, 'Crise financière mondiale', 'Histoire'],
  [2011, 'Printemps arabe / mort de Ben Laden', 'Histoire'],
  [2015, 'Attentats du Bataclan à Paris', 'Histoire'],
  [2016, 'Brexit (référendum)', 'Histoire'],
  [2020, 'Pandémie de Covid-19', 'Histoire'],
  [2022, 'Invasion de l\'Ukraine par la Russie', 'Histoire'],
];

// Famous people: name, category, birth, death, fact
const PEOPLE = [
  ['Léonard de Vinci', 'Art', 1452, 1519, 'peintre et inventeur italien de la Renaissance'],
  ['Michel-Ange', 'Art', 1475, 1564, 'sculpteur et peintre italien (plafond de la Sixtine)'],
  ['Raphaël', 'Art', 1483, 1520, 'peintre italien de la Haute Renaissance'],
  ['Rembrandt', 'Art', 1606, 1669, 'peintre néerlandais (La Ronde de nuit)'],
  ['Vermeer', 'Art', 1632, 1675, 'peintre néerlandais (La Jeune Fille à la perle)'],
  ['Goya', 'Art', 1746, 1828, 'peintre espagnol (Les Désastres de la guerre)'],
  ['Monet', 'Art', 1840, 1926, 'peintre impressionniste français'],
  ['Van Gogh', 'Art', 1853, 1890, 'peintre néerlandais post-impressionniste'],
  ['Cézanne', 'Art', 1839, 1906, 'peintre français post-impressionniste'],
  ['Gauguin', 'Art', 1848, 1903, 'peintre français (Tahiti)'],
  ['Picasso', 'Art', 1881, 1973, 'peintre espagnol (Guernica)'],
  ['Matisse', 'Art', 1869, 1954, 'peintre français fauviste'],
  ['Dalí', 'Art', 1904, 1989, 'peintre surréaliste espagnol'],
  ['Magritte', 'Art', 1898, 1967, 'peintre surréaliste belge'],
  ['Frida Kahlo', 'Art', 1907, 1954, 'peintre mexicaine'],
  ['Warhol', 'Art', 1928, 1987, 'figure du pop art américain'],
  ['Rodin', 'Art', 1840, 1917, 'sculpteur français (Le Penseur)'],
  ['Shakespeare', 'Littérature', 1564, 1616, 'dramaturge anglais (Hamlet)'],
  ['Molière', 'Littérature', 1622, 1673, 'dramaturge français (Tartuffe)'],
  ['Victor Hugo', 'Littérature', 1802, 1885, 'écrivain français (Les Misérables)'],
  ['Balzac', 'Littérature', 1799, 1850, 'auteur de La Comédie humaine'],
  ['Flaubert', 'Littérature', 1821, 1880, 'auteur de Madame Bovary'],
  ['Zola', 'Littérature', 1840, 1902, 'auteur des Rougon-Macquart'],
  ['Baudelaire', 'Littérature', 1821, 1867, 'auteur des Fleurs du mal'],
  ['Rimbaud', 'Littérature', 1854, 1891, 'poète français adolescent'],
  ['Verlaine', 'Littérature', 1844, 1896, 'poète français symboliste'],
  ['Proust', 'Littérature', 1871, 1922, 'auteur d\'À la recherche du temps perdu'],
  ['Camus', 'Littérature', 1913, 1960, 'auteur de L\'Étranger, Nobel 1957'],
  ['Sartre', 'Littérature', 1905, 1980, 'philosophe et écrivain existentialiste'],
  ['Simone de Beauvoir', 'Littérature', 1908, 1986, 'auteure du Deuxième Sexe'],
  ['Dostoïevski', 'Littérature', 1821, 1881, 'auteur de Crime et Châtiment'],
  ['Tolstoï', 'Littérature', 1828, 1910, 'auteur de Guerre et Paix'],
  ['Tchekhov', 'Littérature', 1860, 1904, 'dramaturge russe (La Cerisaie)'],
  ['Goethe', 'Littérature', 1749, 1832, 'auteur allemand de Faust'],
  ['Cervantès', 'Littérature', 1547, 1616, 'auteur espagnol de Don Quichotte'],
  ['Dante', 'Littérature', 1265, 1321, 'auteur italien de La Divine Comédie'],
  ['Hemingway', 'Littérature', 1899, 1961, 'auteur du Vieil Homme et la Mer, Nobel 1954'],
  ['Faulkner', 'Littérature', 1897, 1962, 'auteur américain (Le Bruit et la Fureur)'],
  ['Orwell', 'Littérature', 1903, 1950, 'auteur de 1984'],
  ['Kafka', 'Littérature', 1883, 1924, 'auteur de La Métamorphose'],
  ['Dickens', 'Littérature', 1812, 1870, 'auteur anglais d\'Oliver Twist'],
  ['Jane Austen', 'Littérature', 1775, 1817, 'auteure d\'Orgueil et Préjugés'],
  ['Agatha Christie', 'Littérature', 1890, 1976, 'reine du roman policier (Hercule Poirot)'],
  ['Tolkien', 'Littérature', 1892, 1973, 'auteur du Seigneur des anneaux'],
  ['Saint-Exupéry', 'Littérature', 1900, 1944, 'auteur du Petit Prince'],
  ['Jules Verne', 'Littérature', 1828, 1905, 'auteur de Vingt mille lieues sous les mers'],
  ['Galilée', 'Sciences', 1564, 1642, 'astronome italien (lunette astronomique)'],
  ['Newton', 'Sciences', 1643, 1727, 'découvreur de la gravitation'],
  ['Darwin', 'Sciences', 1809, 1882, 'théoricien de l\'évolution'],
  ['Pasteur', 'Sciences', 1822, 1895, 'inventeur de la pasteurisation'],
  ['Marie Curie', 'Sciences', 1867, 1934, 'découvreuse du radium, 2 Nobel'],
  ['Einstein', 'Sciences', 1879, 1955, 'auteur de la relativité'],
  ['Bohr', 'Sciences', 1885, 1962, 'physicien danois (modèle atomique)'],
  ['Heisenberg', 'Sciences', 1901, 1976, 'physicien du principe d\'incertitude'],
  ['Schrödinger', 'Sciences', 1887, 1961, 'physicien quantique autrichien'],
  ['Mendeleïev', 'Sciences', 1834, 1907, 'créateur du tableau périodique'],
  ['Freud', 'Sciences', 1856, 1939, 'père de la psychanalyse'],
  ['Copernic', 'Sciences', 1473, 1543, 'astronome héliocentrisme'],
  ['Kepler', 'Sciences', 1571, 1630, 'astronome (lois du mouvement planétaire)'],
  ['Tesla', 'Sciences', 1856, 1943, 'inventeur du courant alternatif'],
  ['Fleming', 'Sciences', 1881, 1955, 'découvreur de la pénicilline'],
  ['Turing', 'Technologie', 1912, 1954, 'pionnier de l\'informatique (machine de Turing)'],
  ['Hawking', 'Sciences', 1942, 2018, 'astrophysicien britannique'],
  ['Napoléon', 'Histoire', 1769, 1821, 'empereur des Français'],
  ['Jules César', 'Histoire', -100, -44, 'général et dictateur romain'],
  ['Alexandre le Grand', 'Histoire', -356, -323, 'roi de Macédoine'],
  ['Cléopâtre', 'Histoire', -69, -30, 'dernière reine d\'Égypte'],
  ['Jeanne d\'Arc', 'Histoire', 1412, 1431, 'héroïne française de la guerre de Cent Ans'],
  ['Louis XIV', 'Histoire', 1638, 1715, 'Roi-Soleil'],
  ['Catherine de Médicis', 'Histoire', 1519, 1589, 'reine de France'],
  ['Henri IV', 'Histoire', 1553, 1610, 'roi de France (édit de Nantes)'],
  ['Marie-Antoinette', 'Histoire', 1755, 1793, 'reine de France guillotinée'],
  ['Robespierre', 'Histoire', 1758, 1794, 'révolutionnaire français (la Terreur)'],
  ['De Gaulle', 'Histoire', 1890, 1970, 'président français, chef de la France libre'],
  ['Winston Churchill', 'Histoire', 1874, 1965, 'premier ministre britannique'],
  ['Staline', 'Histoire', 1878, 1953, 'dirigeant soviétique'],
  ['Lénine', 'Histoire', 1870, 1924, 'fondateur de l\'URSS'],
  ['Mao Zedong', 'Histoire', 1893, 1976, 'fondateur de la Chine populaire'],
  ['Gandhi', 'Histoire', 1869, 1948, 'leader de l\'indépendance de l\'Inde'],
  ['Nelson Mandela', 'Histoire', 1918, 2013, 'président sud-africain contre l\'apartheid'],
  ['Martin Luther King', 'Histoire', 1929, 1968, 'leader des droits civiques américains'],
  ['Mère Teresa', 'Histoire', 1910, 1997, 'religieuse missionnaire, Nobel de la paix'],
];

const FILMS = [
  // [title, year, director, stars, genre]
  ['Citizen Kane', 1941, 'Orson Welles', ['orson welles'], 'drame'],
  ['Casablanca', 1942, 'Michael Curtiz', ['humphrey bogart', 'ingrid bergman'], 'drame'],
  ['Autant en emporte le vent', 1939, 'Victor Fleming', ['clark gable', 'vivien leigh'], 'drame'],
  ['Le Magicien d\'Oz', 1939, 'Victor Fleming', ['judy garland'], 'fantastique'],
  ['Les Temps modernes', 1936, 'Charlie Chaplin', ['charlie chaplin'], 'comédie'],
  ['Psychose', 1960, 'Alfred Hitchcock', ['anthony perkins'], 'thriller'],
  ['Les Oiseaux', 1963, 'Alfred Hitchcock', [], 'thriller'],
  ['Le Parrain', 1972, 'Francis Ford Coppola', ['marlon brando', 'al pacino'], 'drame'],
  ['Le Parrain 2', 1974, 'Francis Ford Coppola', ['al pacino', 'robert de niro'], 'drame'],
  ['Taxi Driver', 1976, 'Martin Scorsese', ['robert de niro'], 'drame'],
  ['Les Dents de la mer', 1975, 'Steven Spielberg', [], 'thriller'],
  ['La Guerre des étoiles', 1977, 'George Lucas', ['mark hamill', 'harrison ford'], 'sf'],
  ['L\'Empire contre-attaque', 1980, 'Irvin Kershner', ['mark hamill', 'harrison ford'], 'sf'],
  ['Indiana Jones : Les Aventuriers de l\'arche perdue', 1981, 'Steven Spielberg', ['harrison ford'], 'aventure'],
  ['E.T.', 1982, 'Steven Spielberg', [], 'sf'],
  ['Blade Runner', 1982, 'Ridley Scott', ['harrison ford'], 'sf'],
  ['Retour vers le futur', 1985, 'Robert Zemeckis', ['michael j fox'], 'sf'],
  ['Le Silence des agneaux', 1991, 'Jonathan Demme', ['jodie foster', 'anthony hopkins'], 'thriller'],
  ['Jurassic Park', 1993, 'Steven Spielberg', [], 'sf'],
  ['La Liste de Schindler', 1993, 'Steven Spielberg', ['liam neeson'], 'drame'],
  ['Forrest Gump', 1994, 'Robert Zemeckis', ['tom hanks'], 'drame'],
  ['Pulp Fiction', 1994, 'Quentin Tarantino', ['john travolta', 'samuel l jackson', 'uma thurman'], 'crime'],
  ['Les Évadés', 1994, 'Frank Darabont', ['tim robbins', 'morgan freeman'], 'drame'],
  ['Seven', 1995, 'David Fincher', ['brad pitt', 'morgan freeman'], 'thriller'],
  ['Titanic', 1997, 'James Cameron', ['leonardo dicaprio', 'kate winslet'], 'drame'],
  ['Matrix', 1999, 'Les Wachowski', ['keanu reeves'], 'sf'],
  ['Gladiator', 2000, 'Ridley Scott', ['russell crowe'], 'épopée'],
  ['Le Seigneur des anneaux : La Communauté de l\'anneau', 2001, 'Peter Jackson', ['elijah wood'], 'fantastique'],
  ['Le Seigneur des anneaux : Les Deux Tours', 2002, 'Peter Jackson', ['elijah wood'], 'fantastique'],
  ['Le Seigneur des anneaux : Le Retour du roi', 2003, 'Peter Jackson', ['elijah wood'], 'fantastique'],
  ['Harry Potter à l\'école des sorciers', 2001, 'Chris Columbus', ['daniel radcliffe'], 'fantastique'],
  ['Avatar', 2009, 'James Cameron', ['sam worthington'], 'sf'],
  ['Inception', 2010, 'Christopher Nolan', ['leonardo dicaprio'], 'sf'],
  ['The Dark Knight', 2008, 'Christopher Nolan', ['christian bale', 'heath ledger'], 'super-héros'],
  ['Interstellar', 2014, 'Christopher Nolan', ['matthew mcconaughey'], 'sf'],
  ['Parasite', 2019, 'Bong Joon-ho', [], 'thriller'],
  ['Le Fabuleux Destin d\'Amélie Poulain', 2001, 'Jean-Pierre Jeunet', ['audrey tautou'], 'comédie'],
  ['Les Intouchables', 2011, 'Toledano & Nakache', ['omar sy', 'françois cluzet'], 'comédie'],
  ['La Grande Vadrouille', 1966, 'Gérard Oury', ['louis de funès', 'bourvil'], 'comédie'],
  ['Les Bronzés', 1978, 'Patrice Leconte', [], 'comédie'],
  ['Le Dîner de cons', 1998, 'Francis Veber', ['jacques villeret'], 'comédie'],
  ['La Haine', 1995, 'Mathieu Kassovitz', ['vincent cassel'], 'drame'],
  ['Léon', 1994, 'Luc Besson', ['jean reno', 'natalie portman'], 'thriller'],
  ['Le Cinquième Élément', 1997, 'Luc Besson', ['bruce willis'], 'sf'],
  ['La Cité de la peur', 1994, 'Alain Berbérian', [], 'comédie'],
  ['Astérix et Obélix : Mission Cléopâtre', 2002, 'Alain Chabat', [], 'comédie'],
  ['OSS 117 : Le Caire, nid d\'espions', 2006, 'Michel Hazanavicius', ['jean dujardin'], 'comédie'],
  ['The Artist', 2011, 'Michel Hazanavicius', ['jean dujardin'], 'drame'],
  ['Le Voyage de Chihiro', 2001, 'Hayao Miyazaki', [], 'animation'],
  ['Mon voisin Totoro', 1988, 'Hayao Miyazaki', [], 'animation'],
  ['Princesse Mononoké', 1997, 'Hayao Miyazaki', [], 'animation'],
  ['Le Roi lion', 1994, 'Roger Allers', [], 'animation'],
  ['La Reine des neiges', 2013, 'Jennifer Lee', [], 'animation'],
  ['Toy Story', 1995, 'John Lasseter', [], 'animation'],
  ['Le Monde de Nemo', 2003, 'Andrew Stanton', [], 'animation'],
  ['Shrek', 2001, 'Andrew Adamson', [], 'animation'],
  ['Joker', 2019, 'Todd Phillips', ['joaquin phoenix'], 'drame'],
  ['Oppenheimer', 2023, 'Christopher Nolan', ['cillian murphy'], 'drame'],
  ['Everything Everywhere All at Once', 2022, 'Daniels', ['michelle yeoh'], 'sf'],
];

const MUSIC_ALBUMS = [
  // [title, year, artist]
  ['Thriller', 1982, 'Michael Jackson'],
  ['Bad', 1987, 'Michael Jackson'],
  ['The Dark Side of the Moon', 1973, 'Pink Floyd'],
  ['The Wall', 1979, 'Pink Floyd'],
  ['Abbey Road', 1969, 'The Beatles'],
  ['Sgt. Pepper\'s Lonely Hearts Club Band', 1967, 'The Beatles'],
  ['Let It Be', 1970, 'The Beatles'],
  ['Rumours', 1977, 'Fleetwood Mac'],
  ['Hotel California', 1976, 'Eagles'],
  ['Born to Run', 1975, 'Bruce Springsteen'],
  ['Born in the U.S.A.', 1984, 'Bruce Springsteen'],
  ['Nevermind', 1991, 'Nirvana'],
  ['OK Computer', 1997, 'Radiohead'],
  ['The Joshua Tree', 1987, 'U2'],
  ['Back in Black', 1980, 'AC/DC'],
  ['A Night at the Opera', 1975, 'Queen'],
  ['Led Zeppelin IV', 1971, 'Led Zeppelin'],
  ['Purple Rain', 1984, 'Prince'],
  ['Like a Virgin', 1984, 'Madonna'],
  ['21', 2011, 'Adele'],
  ['Lemonade', 2016, 'Beyoncé'],
  ['Divide', 2017, 'Ed Sheeran'],
  ['1989', 2014, 'Taylor Swift'],
  ['Folklore', 2020, 'Taylor Swift'],
  ['Damn.', 2017, 'Kendrick Lamar'],
  ['To Pimp a Butterfly', 2015, 'Kendrick Lamar'],
  ['Renaissance', 2022, 'Beyoncé'],
];

const SCIENCE_FACTS = [
  ['Symbole chimique de l\'or', 'Au', ['au'], 'easy'],
  ['Symbole chimique de l\'argent', 'Ag', ['ag'], 'easy'],
  ['Symbole chimique du fer', 'Fe', ['fe'], 'easy'],
  ['Symbole chimique du cuivre', 'Cu', ['cu'], 'medium'],
  ['Symbole chimique du plomb', 'Pb', ['pb'], 'medium'],
  ['Symbole chimique du mercure', 'Hg', ['hg'], 'medium'],
  ['Symbole chimique du potassium', 'K', ['k'], 'hard'],
  ['Symbole chimique du sodium', 'Na', ['na'], 'medium'],
  ['Symbole chimique du chlore', 'Cl', ['cl'], 'medium'],
  ['Symbole chimique de l\'oxygène', 'O', ['o'], 'easy'],
  ['Symbole chimique du carbone', 'C', ['c'], 'easy'],
  ['Symbole chimique de l\'azote', 'N', ['n'], 'easy'],
  ['Symbole chimique de l\'hydrogène', 'H', ['h'], 'easy'],
  ['Symbole chimique du calcium', 'Ca', ['ca'], 'medium'],
  ['Symbole chimique du tungstène', 'W', ['w'], 'hard'],
  ['Planète la plus proche du Soleil', 'Mercure', [], 'easy'],
  ['Planète la plus éloignée du Soleil', 'Neptune', [], 'medium'],
  ['Plus grande planète du système solaire', 'Jupiter', [], 'easy'],
  ['Plus petite planète du système solaire', 'Mercure', [], 'medium'],
  ['Planète connue pour ses anneaux', 'Saturne', [], 'easy'],
  ['Planète surnommée l\'étoile du berger', 'Vénus', [], 'medium'],
  ['Planète rouge', 'Mars', [], 'easy'],
  ['Nom de notre galaxie', 'Voie lactée', ['voie lactee', 'milky way'], 'easy'],
  ['Étoile la plus proche du Soleil', 'Proxima du Centaure', ['proxima centauri', 'proxima'], 'hard'],
  ['Satellite naturel de la Terre', 'Lune', [], 'easy'],
  ['Nombre de planètes dans le système solaire', '8', ['huit'], 'easy'],
  ['Année-lumière désigne une unité de', 'distance', [], 'medium'],
  ['Organe qui pompe le sang', 'cœur', ['coeur'], 'easy'],
  ['Plus grand organe du corps humain', 'peau', [], 'medium'],
  ['Nombre de chromosomes chez l\'humain', '46', ['quarante-six'], 'medium'],
  ['Gaz le plus abondant de l\'atmosphère', 'azote', [], 'medium'],
  ['Vitesse de la lumière en km/s (approx.)', '300000', ['300 000', '299792', '299 792'], 'medium'],
  ['Son voyage le plus vite dans', "l'acier", ['acier', 'solides'], 'hard'],
  ['Nombre d\'os chez l\'adulte humain', '206', [], 'medium'],
  ['Élément le plus abondant de l\'univers', 'hydrogène', ['hydrogene'], 'medium'],
];

const ANIMAL_FACTS = [
  ['Plus grand animal terrestre', 'éléphant d\'Afrique', ['elephant', 'elephant d afrique'], 'easy'],
  ['Plus grand animal marin', 'baleine bleue', [], 'easy'],
  ['Plus rapide animal terrestre', 'guépard', ['guepard'], 'easy'],
  ['Plus rapide oiseau en piqué', 'faucon pèlerin', ['faucon pelerin'], 'medium'],
  ['Plus grand oiseau au monde', 'autruche', [], 'easy'],
  ['Plus petit oiseau au monde', 'colibri', [], 'easy'],
  ['Seul mammifère volant', 'chauve-souris', [], 'easy'],
  ['Mammifère qui pond des œufs', 'ornithorynque', [], 'medium'],
  ['Nom scientifique de l\'être humain', 'Homo sapiens', ['homo sapiens'], 'easy'],
  ['Nom scientifique du chat domestique', 'Felis catus', ['felis catus'], 'medium'],
  ['Nom scientifique du chien', 'Canis familiaris', ['canis familiaris', 'canis lupus familiaris'], 'medium'],
  ['Couleur du sang des poulpes', 'bleu', [], 'medium'],
  ['Animal connu pour avoir 8 bras', 'pieuvre', ['poulpe', 'octopus'], 'easy'],
  ['Les dauphins sont des', 'mammifères', ['mammifere'], 'easy'],
  ['Le panda géant vit principalement en', 'Chine', [], 'easy'],
  ['Le kangourou est originaire de', 'Australie', [], 'easy'],
  ['Le kiwi est un oiseau originaire de', 'Nouvelle-Zélande', ['nouvelle zelande'], 'medium'],
  ['Le lémurien vit sur l\'île de', 'Madagascar', [], 'medium'],
  ['Animal le plus venimeux au monde', 'cubozoaire', ['guêpe de mer', 'guepe de mer'], 'hard'],
  ['Combien d\'yeux a une araignée (en général)', '8', ['huit'], 'medium'],
  ['Combien de pattes a un mille-pattes (environ)', '30', ['plusieurs dizaines', 'des dizaines'], 'hard'],
];

const SPORT_FACTS = [
  ['Nombre de joueurs par équipe au football (terrain)', '11', ['onze'], 'easy'],
  ['Nombre de joueurs par équipe au rugby à XV', '15', ['quinze'], 'easy'],
  ['Nombre de joueurs par équipe au basket (terrain)', '5', ['cinq'], 'easy'],
  ['Nombre de joueurs par équipe au volley', '6', ['six'], 'easy'],
  ['Nombre de joueurs par équipe au handball', '7', ['sept'], 'medium'],
  ['Nombre de joueurs par équipe au hockey sur glace (terrain)', '6', ['six'], 'medium'],
  ['Distance d\'un marathon (km)', '42.195', ['42,195', '42'], 'medium'],
  ['Ville du plus ancien Grand Chelem de tennis', 'Londres', [], 'medium'],
  ['Surface du tournoi de Wimbledon', 'gazon', [], 'easy'],
  ['Surface du tournoi de Roland-Garros', 'terre battue', [], 'easy'],
  ['Pays créateur du judo', 'Japon', [], 'easy'],
  ['Pays créateur du Taekwondo', 'Corée du Sud', ['coree du sud', 'coree'], 'medium'],
  ['Pays organisateur de la Coupe du monde de football 1998', 'France', [], 'easy'],
  ['Pays vainqueur de la Coupe du monde de football 2022', 'Argentine', [], 'easy'],
  ['Pays vainqueur de la Coupe du monde de football 2018', 'France', [], 'easy'],
  ['Nombre de médailles d\'or de Michael Phelps', '23', ['vingt-trois'], 'hard'],
  ['Plus titré vainqueur du Tour de France (record partagé)', 'Eddy Merckx', ['merckx', 'bernard hinault', 'hinault'], 'hard'],
  ['Nombre de joueurs sur un terrain de baseball (défense)', '9', ['neuf'], 'medium'],
  ['Pays natal de Roger Federer', 'Suisse', [], 'easy'],
  ['Pays natal de Rafael Nadal', 'Espagne', [], 'easy'],
  ['Pays natal de Novak Djokovic', 'Serbie', [], 'medium'],
  ['Surface glacée du hockey', 'glace', [], 'easy'],
];

const TECH_FACTS = [
  ['Fondateur de Microsoft', 'Bill Gates', ['gates'], 'easy'],
  ['Cofondateur d\'Apple (avec Steve Wozniak)', 'Steve Jobs', ['jobs'], 'easy'],
  ['Fondateur de Tesla (entreprise actuelle dirigée par)', 'Elon Musk', ['musk'], 'easy'],
  ['Créateur de Facebook', 'Mark Zuckerberg', ['zuckerberg'], 'easy'],
  ['Créateurs de Google', 'Larry Page et Sergey Brin', ['page et brin', 'page', 'brin'], 'medium'],
  ['Créateur de Linux', 'Linus Torvalds', ['torvalds'], 'medium'],
  ['Créateur du World Wide Web', 'Tim Berners-Lee', ['berners-lee', 'tim berners lee'], 'medium'],
  ['Langage de programmation créé par Guido van Rossum', 'Python', ['python'], 'medium'],
  ['Langage de programmation utilisé par Node.js', 'JavaScript', ['javascript', 'js'], 'easy'],
  ['Extension standard d\'un fichier image compressé courant', 'jpg', ['jpeg', '.jpg', '.jpeg'], 'easy'],
  ['Signification de URL', 'Uniform Resource Locator', ['uniform resource locator'], 'medium'],
  ['Signification de HTML', 'HyperText Markup Language', ['hypertext markup language'], 'medium'],
  ['Signification de CSS', 'Cascading Style Sheets', ['cascading style sheets'], 'medium'],
  ['Année de création d\'Internet (ARPANET)', '1969', [], 'hard'],
  ['Année de création du WWW', '1989', [], 'hard'],
  ['Société mère d\'Android', 'Google', [], 'easy'],
  ['Système d\'exploitation mobile d\'Apple', 'iOS', ['ios'], 'easy'],
  ['Protocole d\'envoi d\'e-mails', 'SMTP', ['smtp'], 'medium'],
];

const GASTRONOMIE = [
  ['Pays d\'origine de la pizza', 'Italie', [], 'easy'],
  ['Pays d\'origine du sushi', 'Japon', [], 'easy'],
  ['Pays d\'origine du couscous', 'Maghreb', ['maroc', 'algerie', 'tunisie'], 'medium'],
  ['Pays d\'origine de la paella', 'Espagne', [], 'easy'],
  ['Pays d\'origine de la fondue (savoyarde)', 'Suisse', ['france', 'suisse'], 'medium'],
  ['Pays d\'origine du fish and chips', 'Royaume-Uni', ['angleterre', 'uk'], 'easy'],
  ['Pays d\'origine du tacos (traditionnel)', 'Mexique', [], 'easy'],
  ['Pays d\'origine du goulash', 'Hongrie', [], 'medium'],
  ['Pays d\'origine du kebab', 'Turquie', [], 'medium'],
  ['Pays d\'origine du pho', 'Vietnam', [], 'medium'],
  ['Pays d\'origine du ramen', 'Japon', [], 'easy'],
  ['Pays d\'origine du kimchi', 'Corée du Sud', ['coree'], 'medium'],
  ['Pays d\'origine du ceviche', 'Pérou', [], 'hard'],
  ['Pays d\'origine du feijoada', 'Brésil', [], 'hard'],
  ['Pays d\'origine du bœuf bourguignon', 'France', [], 'easy'],
  ['Pays d\'origine de la choucroute', 'Allemagne', ['france'], 'medium'],
  ['Pays d\'origine du biryani', 'Inde', [], 'medium'],
  ['Ingrédient principal du guacamole', 'avocat', [], 'easy'],
  ['Ingrédient principal de la ratatouille', 'légumes', ['courgette', 'aubergine', 'tomate'], 'medium'],
  ['Fromage italien utilisé dans le tiramisu', 'mascarpone', [], 'medium'],
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

const makeClassic = (id, prompt, answer, aliases, category, difficulty, source) => ({
  id, mode: 'classic', difficulty, category, prompt, answer,
  aliases: aliases.filter((a) => lower(a) !== lower(answer)),
  source,
});

const makeEstimation = (id, prompt, numericAnswer, unit, category, difficulty, source) => ({
  id, mode: 'estimation', difficulty, category, prompt, numericAnswer, unit, source,
});

const makeSpeedElim = (id, prompt, answer, aliases, category, difficulty, timerSeconds = 10, source) => ({
  id, mode: 'speed-elim', difficulty, category, prompt, answer,
  aliases: aliases.filter((a) => lower(a) !== lower(answer)),
  timerSeconds, source,
});

const makeListTurns = (id, prompt, validItems, category, difficulty, turnSeconds = 12, source) => ({
  id, mode: 'list-turns', difficulty, category, prompt,
  validItems: validItems.map(lower), turnSeconds, source,
});

const makeHotPotato = (id, prompt, validItems, category, difficulty, source) => ({
  id, mode: 'hot-potato', difficulty, category, prompt,
  bidSeconds: 10, answerSeconds: difficulty === 'easy' ? 45 : difficulty === 'medium' ? 35 : 30,
  maxBid: Math.min(validItems.length, difficulty === 'easy' ? 10 : 8),
  validItems: validItems.map(lower), source,
});

const makeMap = (id, prompt, label, lat, lng, difficulty, maxKm, source) => ({
  id, mode: 'map', difficulty, category: 'Géographie', prompt, targetLat: lat, targetLng: lng, targetLabel: label, maxKm, source,
});

const makeChronology = (id, prompt, events, category, difficulty, source) => ({
  id, mode: 'chronology', difficulty, category, prompt,
  events: events.map((e, i) => ({ id: `e${i + 1}`, label: e[1], year: e[0] })),
  source,
});

// ----------------------------------------------------------------------------
// Generators
// ----------------------------------------------------------------------------

let id = (prefix, n) => `${prefix}-wp-${String(n).padStart(4, '0')}`;

// ============ CLASSIC (~300) ============
const classicQs = [];
let cN = 1;

// Capitals (country → capital) – 80
for (const [name, capital, , , , , , diff] of COUNTRIES.slice(0, 120)) {
  classicQs.push(makeClassic(
    id('c', cN++),
    `Quelle est la capitale de ${['A','E','I','O','U','Y','É','È','Ê','À'].includes(name[0]) ? "l'" : (name.startsWith('Les ') || name.endsWith('s') && !name.endsWith('us') ? 'des ' : 'du ')}${name} ?`.replace("du États-Unis","des États-Unis").replace("du Émirats arabes unis","des Émirats arabes unis").replace("du Pays-Bas","des Pays-Bas").replace("du Philippines","des Philippines").replace("du Maldives","des Maldives").replace("du Comores","des Comores").replace("du Bahamas","des Bahamas").replace("du Seychelles","des Seychelles").replace("du Fidji","des Fidji"),
    capital,
    aliasesFor(capital),
    'Géographie',
    diff,
    `Wikipedia:${name}`
  ));
}

// Capital → country (reverse) – 40 first
for (const [name, capital, , , , , , diff] of COUNTRIES.slice(0, 50)) {
  classicQs.push(makeClassic(
    id('c', cN++),
    `De quel pays ${capital} est-elle la capitale ?`,
    name,
    aliasesFor(name),
    'Géographie',
    diff === 'easy' ? 'easy' : diff,
    `Wikipedia:${capital}`
  ));
}

// Country → continent – 30
for (const [name, , continent, , , , , diff] of COUNTRIES.slice(40, 90)) {
  classicQs.push(makeClassic(
    id('c', cN++),
    `Sur quel continent se trouve ${name} ?`,
    continent,
    aliasesFor(continent),
    'Géographie',
    diff === 'easy' ? 'easy' : 'medium',
    `Wikipedia:${name}`
  ));
}

// Historical events (year → event) – 60
for (const [year, label, cat] of HISTORICAL_EVENTS) {
  if (classicQs.length >= 230) break;
  const difficulty = year > 1900 ? 'easy' : year > 1500 ? 'medium' : 'hard';
  classicQs.push(makeClassic(
    id('c', cN++),
    `En quelle année a eu lieu : « ${label} » ?`,
    String(Math.abs(year)) + (year < 0 ? ' av. J.-C.' : ''),
    [String(year), String(Math.abs(year))],
    cat,
    difficulty,
    `Wikipedia:${label}`
  ));
}

// People (description → name) – 60
for (const [name, cat, , , fact] of PEOPLE) {
  if (classicQs.length >= 290) break;
  classicQs.push(makeClassic(
    id('c', cN++),
    `Qui était ${fact} ?`,
    name,
    aliasesFor(name),
    cat,
    'medium',
    `Wikipedia:${name}`
  ));
}

// Films → director – 30
for (const [title, year, director] of FILMS) {
  if (classicQs.length >= 320) break;
  classicQs.push(makeClassic(
    id('c', cN++),
    `Qui a réalisé le film « ${title} » (${year}) ?`,
    director,
    aliasesFor(director),
    'Cinéma',
    year > 1990 ? 'medium' : 'hard',
    `Wikipedia:${title}`
  ));
}

// Albums → artist – 20
for (const [album, year, artist] of MUSIC_ALBUMS) {
  if (classicQs.length >= 340) break;
  classicQs.push(makeClassic(
    id('c', cN++),
    `Quel artiste/groupe a sorti l'album « ${album} » (${year}) ?`,
    artist,
    aliasesFor(artist),
    'Musique',
    'medium',
    `Wikipedia:${album}`
  ));
}

// Science – 25
for (const [prompt, answer, aliases, diff] of SCIENCE_FACTS) {
  if (classicQs.length >= 365) break;
  classicQs.push(makeClassic(
    id('c', cN++),
    prompt + ' ?',
    answer,
    aliases,
    'Sciences',
    diff,
    'Wikipedia'
  ));
}

// Animals – 15
for (const [prompt, answer, aliases, diff] of ANIMAL_FACTS) {
  if (classicQs.length >= 385) break;
  classicQs.push(makeClassic(
    id('c', cN++),
    prompt + ' ?',
    answer,
    aliases,
    'Animaux',
    diff,
    'Wikipedia'
  ));
}

// Gastronomie – 20
for (const [prompt, answer, aliases, diff] of GASTRONOMIE) {
  if (classicQs.length >= 410) break;
  classicQs.push(makeClassic(
    id('c', cN++),
    prompt + ' ?',
    answer,
    aliases,
    'Gastronomie',
    diff,
    'Wikipedia'
  ));
}

// Trim to 350
classicQs.length = Math.min(classicQs.length, 350);

// ============ ESTIMATION (~150) ============
const estQs = [];
let eN = 1;

// Populations of countries (millions) – 60
for (const [name, , , pop, , , , diff] of COUNTRIES.slice(0, 80)) {
  estQs.push(makeEstimation(
    id('e', eN++),
    `Quelle est la population de ${name} (en millions) ?`,
    pop, 'millions', 'Géographie', diff, `Wikipedia:${name}`
  ));
}

// Areas of countries (km2) – 30
for (const [name, , , , area, , , diff] of COUNTRIES.slice(10, 50)) {
  if (estQs.length >= 90) break;
  estQs.push(makeEstimation(
    id('e', eN++),
    `Quelle est la superficie de ${name} (en km²) ?`,
    area, 'km²', 'Géographie', diff === 'easy' ? 'medium' : 'hard', `Wikipedia:${name}`
  ));
}

// Historical years – 30
for (const [year, label] of HISTORICAL_EVENTS.slice(0, 40)) {
  if (estQs.length >= 120) break;
  estQs.push(makeEstimation(
    id('e', eN++),
    `En quelle année : « ${label} » ?`,
    year, '', 'Histoire', 'medium', `Wikipedia:${label}`
  ));
}

// Miscellaneous Wikipedia-sourced estimations
const miscEstim = [
  ['Quelle est la longueur de la Grande Muraille de Chine (en km) ?', 21196, 'km', 'Histoire', 'medium'],
  ['Quelle est la hauteur du Burj Khalifa (en m) ?', 828, 'm', 'Technologie', 'medium'],
  ['Quelle est la hauteur de la statue de la Liberté (socle inclus, en m) ?', 93, 'm', 'Histoire', 'hard'],
  ['Quelle est la hauteur des pyramides de Khéops à l\'origine (en m) ?', 147, 'm', 'Histoire', 'medium'],
  ['Longueur du Mississippi (en km) ?', 3778, 'km', 'Géographie', 'medium'],
  ['Longueur de l\'Amazone (en km) ?', 6992, 'km', 'Géographie', 'medium'],
  ['Longueur du Nil (en km) ?', 6650, 'km', 'Géographie', 'medium'],
  ['Profondeur de la fosse des Mariannes (en m) ?', 10984, 'm', 'Géographie', 'hard'],
  ['Nombre de pays membres de l\'ONU ?', 193, '', 'Histoire', 'medium'],
  ['Nombre de pays membres de l\'UE ?', 27, '', 'Histoire', 'easy'],
  ['Année de création de l\'ONU ?', 1945, '', 'Histoire', 'easy'],
  ['Année de création de l\'OTAN ?', 1949, '', 'Histoire', 'medium'],
  ['Année de la 1ère Coupe du monde de foot ?', 1930, '', 'Sport', 'hard'],
  ['Année de création des JO modernes ?', 1896, '', 'Sport', 'medium'],
  ['Nombre d\'anneaux sur le drapeau olympique ?', 5, '', 'Sport', 'easy'],
  ['Nombre d\'os dans le corps humain adulte ?', 206, '', 'Sciences', 'medium'],
  ['Nombre de muscles dans le corps humain (approx) ?', 650, '', 'Sciences', 'hard'],
  ['Nombre de chromosomes chez l\'humain ?', 46, '', 'Sciences', 'medium'],
  ['Nombre de dents chez l\'adulte ?', 32, '', 'Sciences', 'easy'],
  ['Litres de sang dans un corps humain adulte ?', 5, 'L', 'Sciences', 'easy'],
  ['Distance Terre-Lune (en km) ?', 384400, 'km', 'Sciences', 'medium'],
  ['Distance Terre-Soleil (en millions de km) ?', 150, 'M km', 'Sciences', 'easy'],
  ['Diamètre de la Terre à l\'équateur (en km) ?', 12742, 'km', 'Sciences', 'medium'],
  ['Circonférence de la Terre à l\'équateur (en km) ?', 40075, 'km', 'Sciences', 'medium'],
  ['Température moyenne à la surface de Vénus (°C) ?', 464, '°C', 'Sciences', 'hard'],
  ['Température de fusion de l\'or (°C) ?', 1064, '°C', 'Sciences', 'hard'],
  ['Température d\'ébullition de l\'eau (°C) au niveau de la mer ?', 100, '°C', 'Sciences', 'easy'],
  ['Année de la mort de Napoléon ?', 1821, '', 'Histoire', 'medium'],
  ['Année de naissance de Mozart ?', 1756, '', 'Musique', 'hard'],
  ['Année de publication de 1984 (Orwell) ?', 1949, '', 'Littérature', 'medium'],
  ['Année du début des Beatles (groupe formé) ?', 1960, '', 'Musique', 'medium'],
  ['Nombre de tableaux peints par Van Gogh (approx) ?', 900, '', 'Art', 'hard'],
  ['Nombre de sonnets de Shakespeare ?', 154, '', 'Littérature', 'hard'],
  ['Longueur de la Tour Eiffel (sans antenne, en m) ?', 300, 'm', 'Histoire', 'medium'],
  ['Âge de la Terre (en milliards d\'années) ?', 4.5, 'Ga', 'Sciences', 'medium'],
  ['Âge de l\'univers (en milliards d\'années) ?', 13.8, 'Ga', 'Sciences', 'medium'],
  ['Vitesse de la lumière (en km/s) ?', 299792, 'km/s', 'Sciences', 'medium'],
  ['Vitesse du son dans l\'air à 20°C (en m/s) ?', 343, 'm/s', 'Sciences', 'medium'],
  ['Hauteur du Kilimandjaro (en m) ?', 5895, 'm', 'Géographie', 'medium'],
  ['Hauteur du mont Blanc (en m) ?', 4807, 'm', 'Géographie', 'easy'],
  ['Superficie du Sahara (en M km²) ?', 9.2, 'M km²', 'Géographie', 'medium'],
  ['Superficie de l\'Antarctique (en M km²) ?', 14, 'M km²', 'Géographie', 'medium'],
  ['Nombre d\'habitants à Tokyo (agglo, en millions) ?', 37.4, 'M', 'Géographie', 'medium'],
  ['Nombre d\'habitants à Paris intra-muros (en millions) ?', 2.1, 'M', 'Géographie', 'medium'],
  ['Pourcentage d\'eau sur Terre (surface) ?', 71, '%', 'Géographie', 'easy'],
  ['Pourcentage d\'oxygène dans l\'air ?', 21, '%', 'Sciences', 'medium'],
  ['Pourcentage d\'azote dans l\'air ?', 78, '%', 'Sciences', 'medium'],
];
for (const row of miscEstim) {
  if (estQs.length >= 150) break;
  estQs.push(makeEstimation(id('e', eN++), row[0], row[1], row[2], row[3], row[4], 'Wikipedia'));
}

estQs.length = Math.min(estQs.length, 150);

// ============ SPEED-ELIM (~200) ============
const seQs = [];
let sN = 1;

// Capital rapid-fire – 100
for (const [name, capital, , , , , , diff] of COUNTRIES.slice(0, 130)) {
  if (seQs.length >= 100) break;
  seQs.push(makeSpeedElim(
    id('se', sN++),
    `Capitale de ${name} ?`,
    capital,
    aliasesFor(capital),
    'Géographie',
    diff,
    diff === 'hard' ? 12 : 10,
    `Wikipedia:${name}`
  ));
}

// Historical years – 40
for (const [year, label, cat] of HISTORICAL_EVENTS) {
  if (seQs.length >= 140) break;
  const difficulty = year > 1900 ? 'easy' : year > 1500 ? 'medium' : 'hard';
  seQs.push(makeSpeedElim(
    id('se', sN++),
    `Année de : ${label} ?`,
    String(Math.abs(year)),
    [String(year), year < 0 ? String(Math.abs(year)) + ' av jc' : ''].filter(Boolean),
    cat,
    difficulty,
    difficulty === 'hard' ? 12 : 10,
    `Wikipedia:${label}`
  ));
}

// Science facts – 25
for (const [prompt, answer, aliases, diff] of SCIENCE_FACTS) {
  if (seQs.length >= 165) break;
  seQs.push(makeSpeedElim(
    id('se', sN++),
    prompt + ' ?',
    answer, aliases, 'Sciences', diff, diff === 'hard' ? 12 : 10,
    'Wikipedia'
  ));
}

// Sports facts – 15
for (const [prompt, answer, aliases, diff] of SPORT_FACTS) {
  if (seQs.length >= 180) break;
  seQs.push(makeSpeedElim(
    id('se', sN++),
    prompt + ' ?',
    answer, aliases, 'Sport', diff, diff === 'hard' ? 12 : 10,
    'Wikipedia'
  ));
}

// Tech facts – 15
for (const [prompt, answer, aliases, diff] of TECH_FACTS) {
  if (seQs.length >= 195) break;
  seQs.push(makeSpeedElim(
    id('se', sN++),
    prompt + ' ?',
    answer, aliases, 'Technologie', diff, diff === 'hard' ? 12 : 10,
    'Wikipedia'
  ));
}

// Fill with misc
const seMisc = [
  ['Symbole chimique de l\'eau ?', 'H2O', ['h2o'], 'Sciences', 'easy'],
  ['Monnaie officielle du Japon ?', 'Yen', ['yen'], 'Divers', 'easy'],
  ['Monnaie officielle du Royaume-Uni ?', 'Livre sterling', ['livre', 'gbp', 'pound'], 'Divers', 'easy'],
  ['Monnaie officielle de la Suisse ?', 'Franc suisse', ['franc', 'chf'], 'Divers', 'easy'],
  ['Monnaie de la zone euro ?', 'Euro', ['euro', 'eur'], 'Divers', 'easy'],
  ['Langue officielle du Brésil ?', 'Portugais', ['portugais'], 'Divers', 'easy'],
  ['Langue officielle de l\'Argentine ?', 'Espagnol', ['espagnol'], 'Divers', 'easy'],
];
for (const [prompt, answer, aliases, cat, diff] of seMisc) {
  if (seQs.length >= 200) break;
  seQs.push(makeSpeedElim(id('se', sN++), prompt, answer, aliases, cat, diff, 10, 'Wikipedia'));
}

seQs.length = Math.min(seQs.length, 200);

// ============ LIST-TURNS (~100) ============
const ltQs = [];
let lN = 1;

// Countries by continent – 15
const byContinent = {};
for (const [name, , continent] of COUNTRIES) {
  (byContinent[continent] ||= []).push(lower(name));
}
for (const [continent, names] of Object.entries(byContinent)) {
  ltQs.push(makeListTurns(
    id('l', lN++),
    `Citez un pays d'${continent.startsWith('A') || continent.startsWith('O') || continent.startsWith('E') ? '' : 'de '}${continent}.`,
    names, 'Géographie', 'medium', 12, `Wikipedia:${continent}`
  ));
}
// Capitals by continent
for (const [continent, names] of Object.entries(byContinent)) {
  const caps = COUNTRIES.filter((c) => c[2] === continent).map((c) => lower(c[1]));
  ltQs.push(makeListTurns(
    id('l', lN++),
    `Citez une capitale d'${continent.startsWith('A') || continent.startsWith('O') || continent.startsWith('E') ? '' : 'de '}${continent}.`,
    caps, 'Géographie', 'medium', 12, `Wikipedia:${continent}`
  ));
}

// Thematic lists
const thematicLists = [
  ['Pays membres du G7.', ['france','allemagne','italie','royaume-uni','royaume uni','états-unis','etats-unis','usa','canada','japon'], 'Histoire', 'medium'],
  ['Pays membres du G20 (principales économies).', ['argentine','australie','brésil','bresil','canada','chine','france','allemagne','inde','indonésie','indonesie','italie','japon','mexique','russie','arabie saoudite','afrique du sud','corée du sud','coree du sud','turquie','royaume-uni','royaume uni','états-unis','etats-unis','usa','union européenne','union europeenne'], 'Histoire', 'hard'],
  ['Pays de l\'Union européenne.', ['allemagne','autriche','belgique','bulgarie','chypre','croatie','danemark','espagne','estonie','finlande','france','grèce','grece','hongrie','irlande','italie','lettonie','lituanie','luxembourg','malte','pays-bas','pologne','portugal','roumanie','slovaquie','slovénie','slovenie','suède','suede','république tchèque','republique tcheque','tchequie','tchéquie'], 'Histoire', 'medium'],
  ['Membres permanents du Conseil de sécurité de l\'ONU.', ['états-unis','etats-unis','usa','russie','chine','france','royaume-uni','royaume uni','uk'], 'Histoire', 'medium'],
  ['Pays nordiques.', ['norvège','norvege','suède','suede','finlande','danemark','islande'], 'Géographie', 'medium'],
  ['Pays baltes.', ['estonie','lettonie','lituanie'], 'Géographie', 'medium'],
  ['Pays du Benelux.', ['belgique','pays-bas','luxembourg'], 'Géographie', 'easy'],
  ['Pays d\'Amérique centrale.', ['guatemala','belize','honduras','salvador','nicaragua','costa rica','panama'], 'Géographie', 'medium'],
  ['Océans du monde.', ['pacifique','atlantique','indien','arctique','austral','antarctique'], 'Géographie', 'easy'],
  ['Continents.', ['afrique','asie','europe','amérique','amerique','amérique du nord','amerique du nord','amérique du sud','amerique du sud','océanie','oceanie','antarctique'], 'Géographie', 'easy'],
  ['Planètes du système solaire.', ['mercure','vénus','venus','terre','mars','jupiter','saturne','uranus','neptune'], 'Sciences', 'easy'],
  ['Mers qui bordent la France.', ['méditerranée','mediterranee','atlantique','manche','mer du nord'], 'Géographie', 'easy'],
  ['Régions viticoles françaises.', ['bordeaux','bourgogne','champagne','alsace','loire','rhône','rhone','languedoc','provence','sud-ouest','beaujolais','jura','savoie','corse'], 'Gastronomie', 'medium'],
  ['Couleurs du drapeau français.', ['bleu','blanc','rouge'], 'Divers', 'easy'],
  ['Jours de la semaine.', ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'], 'Divers', 'easy'],
  ['Mois de l\'année.', ['janvier','février','fevrier','mars','avril','mai','juin','juillet','août','aout','septembre','octobre','novembre','décembre','decembre'], 'Divers', 'easy'],
  ['Chiffres romains de 1 à 10.', ['i','ii','iii','iv','v','vi','vii','viii','ix','x'], 'Divers', 'easy'],
  ['Signes du zodiaque.', ['bélier','belier','taureau','gémeaux','gemeaux','cancer','lion','vierge','balance','scorpion','sagittaire','capricorne','verseau','poissons'], 'Divers', 'easy'],
  ['7 merveilles du monde moderne.', ['grande muraille','petra','christ rédempteur','christ redempteur','machu picchu','chichen itza','colisée','colisee','taj mahal'], 'Histoire', 'medium'],
  ['Grands lacs américains.', ['supérieur','superieur','michigan','huron','érié','erie','ontario'], 'Géographie', 'hard'],
  ['Capitales scandinaves.', ['oslo','stockholm','copenhague','helsinki','reykjavik'], 'Géographie', 'medium'],
  ['Pays frontaliers de la France.', ['belgique','luxembourg','allemagne','suisse','italie','monaco','espagne','andorre'], 'Géographie', 'easy'],
  ['Pays frontaliers de l\'Allemagne.', ['france','belgique','pays-bas','luxembourg','danemark','pologne','république tchèque','republique tcheque','tchéquie','tchequie','autriche','suisse'], 'Géographie', 'medium'],
  ['Pays frontaliers de l\'Espagne.', ['france','portugal','andorre','maroc','gibraltar'], 'Géographie', 'medium'],
  ['Fleuves français.', ['seine','loire','rhône','rhone','rhin','garonne','meuse','dordogne','moselle'], 'Géographie', 'medium'],
  ['Départements bretons.', ['finistère','finistere','côtes-d\'armor','cotes d armor','morbihan','ille-et-vilaine','ille et vilaine'], 'Géographie', 'hard'],
  ['Îles de la Méditerranée (≥ 1000 km²).', ['sicile','sardaigne','chypre','corse','crète','crete','majorque'], 'Géographie', 'medium'],
  ['Éléments chimiques de base (H, C, N, O, etc.) — citez un symbole.', ['h','c','n','o','na','k','ca','fe','mg','cl','s','p','au','ag','cu','hg','pb','zn'], 'Sciences', 'medium'],
  ['Réalisateurs de la Nouvelle Vague française.', ['godard','truffaut','chabrol','rivette','rohmer','varda','resnais'], 'Cinéma', 'hard'],
  ['Groupes britanniques des années 60-70.', ['the beatles','beatles','rolling stones','led zeppelin','pink floyd','the who','the kinks','queen','deep purple','black sabbath'], 'Musique', 'medium'],
  ['Compositeurs classiques.', ['mozart','beethoven','bach','chopin','tchaikovski','tchaïkovski','vivaldi','haendel','schubert','brahms','debussy','ravel','wagner','verdi','mahler','stravinsky'], 'Musique', 'medium'],
  ['Joueurs de tennis ayant gagné Roland-Garros (hommes, 2000+).', ['nadal','federer','djokovic','gustavo kuerten','kuerten','albert costa','gaston gaudio','juan carlos ferrero','ferrero','stanislas wawrinka','wawrinka','carlos alcaraz','alcaraz'], 'Sport', 'hard'],
  ['Équipes championnes du monde de foot (pays).', ['uruguay','italie','allemagne','brésil','bresil','angleterre','argentine','france','espagne'], 'Sport', 'medium'],
  ['Sports olympiques d\'été.', ['athlétisme','athletisme','natation','cyclisme','escrime','gymnastique','tennis','judo','boxe','basket','volley','handball','football','tir à l\'arc','tir a l arc','escalade','surf','skateboard','aviron','voile','équitation','equitation','tennis de table','badminton'], 'Sport', 'medium'],
  ['Personnages de Star Wars.', ['luke','leia','han solo','yoda','chewbacca','darth vader','dark vador','obi-wan','obi wan','palpatine','r2-d2','c-3po','boba fett','kylo ren','rey','finn'], 'Cinéma', 'medium'],
  ['Héros Marvel.', ['iron man','captain america','thor','hulk','spider-man','spiderman','black widow','hawkeye','black panther','doctor strange','ant-man','wasp','vision','scarlet witch'], 'Cinéma', 'medium'],
  ['Pièces d\'échecs.', ['roi','reine','dame','tour','fou','cavalier','pion'], 'Divers', 'easy'],
  ['Fromages français.', ['camembert','brie','roquefort','reblochon','comté','comte','emmental','munster','chèvre','chevre','bleu','gruyère','gruyere','cantal','morbier','beaufort','saint-nectaire'], 'Gastronomie', 'medium'],
  ['Légumes verts.', ['épinard','epinard','salade','laitue','brocoli','courgette','haricot vert','poireau','chou','chou kale','kale','asperge','artichaut','concombre','persil','ciboulette'], 'Gastronomie', 'easy'],
  ['Animaux de la savane africaine.', ['lion','éléphant','elephant','girafe','zèbre','zebre','guépard','guepard','hyène','hyene','gnou','antilope','rhinocéros','rhinoceros','hippopotame','buffle','léopard','leopard'], 'Animaux', 'easy'],
  ['Races de chiens.', ['labrador','golden retriever','caniche','berger allemand','bulldog','chihuahua','rottweiler','teckel','beagle','husky','yorkshire','boxer','dalmatien','boxer','bichon'], 'Animaux', 'medium'],
  ['Romans de Victor Hugo.', ['les misérables','les miserables','notre-dame de paris','notre dame de paris','les travailleurs de la mer','l\'homme qui rit','quatrevingt-treize','quatrevingt treize'], 'Littérature', 'hard'],
  ['Pièces de Shakespeare.', ['hamlet','roméo et juliette','romeo et juliette','macbeth','othello','le roi lear','richard iii','henry v','jules césar','jules cesar','la tempête','la tempete','le songe d\'une nuit d\'été','antoine et cléopâtre'], 'Littérature', 'hard'],
  ['Livres Harry Potter.', ['à l\'école des sorciers','a l ecole des sorciers','la chambre des secrets','le prisonnier d\'azkaban','la coupe de feu','l\'ordre du phénix','l ordre du phenix','le prince de sang-mêlé','prince de sang mele','les reliques de la mort'], 'Littérature', 'medium'],
  ['Pays organisateurs des JO d\'été (2000-2024).', ['australie','grèce','grece','chine','royaume-uni','royaume uni','brésil','bresil','japon','france'], 'Sport', 'medium'],
  ['Animaux domestiques courants.', ['chien','chat','hamster','lapin','cochon d\'inde','cochon d inde','perroquet','perruche','poisson rouge','tortue','furet'], 'Animaux', 'easy'],
  ['Sports de raquette.', ['tennis','badminton','squash','tennis de table','ping-pong','pickleball','paddle','padel'], 'Sport', 'easy'],
  ['Langues officielles de l\'ONU.', ['anglais','français','francais','espagnol','russe','chinois','arabe'], 'Histoire', 'medium'],
  ['Musiciens des Beatles.', ['john lennon','paul mccartney','george harrison','ringo starr'], 'Musique', 'easy'],
  ['Marques automobiles françaises.', ['renault','peugeot','citroën','citroen','bugatti','alpine','ds','dacia'], 'Divers', 'easy'],
  ['Marques automobiles allemandes.', ['mercedes','bmw','audi','volkswagen','porsche','opel'], 'Divers', 'easy'],
];
for (const [prompt, items, cat, diff] of thematicLists) {
  if (ltQs.length >= 100) break;
  ltQs.push(makeListTurns(id('l', lN++), prompt, items, cat, diff, 12, 'Wikipedia'));
}

ltQs.length = Math.min(ltQs.length, 100);

// ============ HOT-POTATO (~50) ============
const hpQs = [];
let hN = 1;

const hotPotatoThemes = [
  ['Pays d\'Europe', ['france','allemagne','italie','espagne','portugal','royaume-uni','irlande','belgique','pays-bas','luxembourg','suisse','autriche','danemark','norvège','norvege','suède','suede','finlande','islande','pologne','république tchèque','republique tcheque','hongrie','roumanie','bulgarie','grèce','grece','croatie','serbie','slovénie','slovenie','slovaquie','estonie','lettonie','lituanie','biélorussie','bielorussie','ukraine','moldavie','albanie','macédoine du nord','macedoine du nord','bosnie','monténégro','montenegro','kosovo','malte','chypre'], 'Géographie', 'easy'],
  ['Capitales d\'Amérique du Sud', ['buenos aires','brasilia','santiago','lima','bogota','caracas','quito','la paz','asunción','asuncion','montevideo','georgetown','paramaribo'], 'Géographie', 'medium'],
  ['Pays du Moyen-Orient', ['arabie saoudite','émirats arabes unis','emirats arabes unis','qatar','koweït','koweit','bahreïn','bahrein','oman','yémen','yemen','iran','irak','turquie','syrie','liban','jordanie','israël','israel','palestine'], 'Géographie', 'medium'],
  ['Personnages de Game of Thrones', ['jon snow','daenerys','tyrion','cersei','jaime','arya','sansa','bran','ned stark','robb','theon','littlefinger','varys','joffrey','khal drogo','night king','melisandre','brienne','samwell','jorah'], 'Cinéma', 'medium'],
  ['Séries HBO', ['les sopranos','sex and the city','six feet under','the wire','rome','game of thrones','westworld','chernobyl','succession','true detective','euphoria','the last of us','the white lotus','silicon valley','veep','entourage'], 'Cinéma', 'hard'],
  ['Jeux Nintendo emblématiques', ['super mario bros','mario kart','super mario 64','zelda','ocarina of time','breath of the wild','metroid','donkey kong','pokémon','pokemon','pokémon rouge','super smash bros','kirby','animal crossing','splatoon','star fox','mother','fire emblem'], 'Technologie', 'medium'],
  ['Joueurs de la NBA de légende', ['michael jordan','lebron james','kobe bryant','shaquille o\'neal','tim duncan','magic johnson','larry bird','kareem abdul-jabbar','wilt chamberlain','bill russell','stephen curry','kevin durant','kevin garnett','dirk nowitzki','hakeem olajuwon'], 'Sport', 'hard'],
  ['Pays d\'Amérique du Sud', ['argentine','bolivie','brésil','bresil','chili','colombie','équateur','equateur','guyana','paraguay','pérou','perou','suriname','uruguay','venezuela'], 'Géographie', 'easy'],
  ['Pays d\'Asie du Sud-Est', ['thaïlande','thailande','vietnam','cambodge','laos','birmanie','malaisie','singapour','indonésie','indonesie','philippines','brunei','timor oriental'], 'Géographie', 'medium'],
  ['Capitales européennes', ['paris','berlin','madrid','rome','londres','lisbonne','amsterdam','bruxelles','vienne','stockholm','oslo','helsinki','copenhague','reykjavik','varsovie','prague','budapest','athènes','athenes','dublin','bucarest','sofia','bratislava','ljubljana','tallinn','riga','vilnius','luxembourg','zagreb','belgrade','tirana','podgorica','sarajevo','skopje','chisinau','kiev','minsk','moscou','berne','andorre-la-vieille'], 'Géographie', 'medium'],
  ['Capitales africaines', ['le caire','rabat','alger','tunis','tripoli','khartoum','addis-abeba','nairobi','dodoma','kampala','kigali','pretoria','windhoek','gaborone','harare','maputo','lusaka','luanda','antananarivo','abuja','accra','dakar','bamako','ouagadougou','niamey','yaoundé','yaounde','libreville','brazzaville','kinshasa','mogadiscio'], 'Géographie', 'medium'],
  ['Présidents des USA depuis 1960', ['kennedy','johnson','nixon','ford','carter','reagan','bush','clinton','obama','trump','biden'], 'Histoire', 'medium'],
  ['Présidents de la Ve République française', ['de gaulle','pompidou','giscard','mitterrand','chirac','sarkozy','hollande','macron'], 'Histoire', 'medium'],
  ['Empereurs romains', ['auguste','tibère','tibere','caligula','claude','néron','nero','vespasien','titus','domitien','trajan','hadrien','marc aurèle','marc aurele','constantin','dioclétien','diocletien','caracalla'], 'Histoire', 'hard'],
  ['Rois de France', ['clovis','charlemagne','hugues capet','louis ix','philippe le bel','charles vii','louis xi','françois ier','francois ier','henri iv','louis xiii','louis xiv','louis xv','louis xvi','louis xviii','charles x','louis-philippe'], 'Histoire', 'hard'],
  ['Philosophes célèbres', ['socrate','platon','aristote','kant','descartes','nietzsche','sartre','voltaire','rousseau','montesquieu','hegel','hobbes','locke','hume','spinoza','leibniz','épicure','epicure','confucius'], 'Littérature', 'medium'],
  ['Films du MCU (Marvel)', ['iron man','iron man 2','iron man 3','thor','avengers','captain america','captain marvel','black panther','spider-man','doctor strange','ant-man','guardians of the galaxy','gardiens de la galaxie','black widow','eternals','shang-chi','endgame','infinity war'], 'Cinéma', 'medium'],
  ['Films de Pixar', ['toy story','1001 pattes','monstres et cie','monstres et compagnie','le monde de nemo','les indestructibles','cars','ratatouille','wall-e','wall e','là-haut','la haut','rebelle','vice-versa','vice versa','le voyage d\'arlo','coco','en avant','soul','luca','alerte rouge','buzz','élémentaire'], 'Cinéma', 'medium'],
  ['Groupes de rock iconiques', ['the beatles','beatles','the rolling stones','rolling stones','led zeppelin','pink floyd','queen','the who','the doors','ac/dc','metallica','u2','nirvana','guns n roses','aerosmith','bon jovi','radiohead','muse','foo fighters','coldplay','oasis','red hot chili peppers'], 'Musique', 'medium'],
  ['Chanteurs francophones', ['edith piaf','jacques brel','georges brassens','léo ferré','leo ferre','serge gainsbourg','gainsbourg','johnny hallyday','charles aznavour','aznavour','michel sardou','jean-jacques goldman','goldman','renaud','zaz','stromae','francis cabrel','louane','m pokora','orelsan','indochine'], 'Musique', 'medium'],
  ['Ballons d\'Or (depuis 2000)', ['rivaldo','figo','ronaldo','zidane','ronaldinho','cannavaro','kaká','kaka','cristiano ronaldo','messi','modric','benzema','rodri'], 'Sport', 'hard'],
  ['Pays vainqueurs de la Coupe du monde de foot', ['uruguay','italie','allemagne','brésil','bresil','angleterre','argentine','france','espagne'], 'Sport', 'medium'],
  ['Langages de programmation', ['python','javascript','java','c','c++','c#','ruby','php','go','rust','swift','kotlin','typescript','scala','haskell','r','perl','lua','matlab','cobol','fortran','assembleur'], 'Technologie', 'medium'],
  ['Réseaux sociaux', ['facebook','instagram','twitter','x','tiktok','snapchat','linkedin','youtube','reddit','pinterest','whatsapp','telegram','discord','mastodon','threads','bluesky','twitch'], 'Technologie', 'easy'],
  ['Marques de smartphones', ['apple','samsung','xiaomi','huawei','oppo','vivo','sony','lg','nokia','motorola','oneplus','google','honor','realme'], 'Technologie', 'easy'],
  ['Sports olympiques d\'hiver', ['ski alpin','ski de fond','saut à ski','saut a ski','biathlon','combiné nordique','combine nordique','patinage artistique','patinage de vitesse','short track','hockey sur glace','curling','bobsleigh','luge','skeleton','snowboard','freestyle'], 'Sport', 'medium'],
  ['Pays hispanophones', ['espagne','mexique','colombie','argentine','pérou','perou','venezuela','chili','équateur','equateur','guatemala','cuba','bolivie','république dominicaine','republique dominicaine','honduras','paraguay','salvador','nicaragua','costa rica','panama','uruguay','guinée équatoriale','guinee equatoriale'], 'Géographie', 'medium'],
  ['Monnaies dans le monde', ['euro','dollar','yen','livre','yuan','rouble','franc suisse','real','peso','roupie','won','rand','dinar','riyal','shekel','couronne','zloty','forint','lira','lire turque'], 'Divers', 'medium'],
  ['Cépages français', ['chardonnay','sauvignon','merlot','cabernet sauvignon','pinot noir','syrah','grenache','riesling','gewürztraminer','gewurztraminer','viognier','chenin','gamay','cinsault','sémillon','semillon','mourvèdre','mourvedre'], 'Gastronomie', 'hard'],
  ['Oeuvres de Molière', ['tartuffe','le malade imaginaire','l\'avare','les fourberies de scapin','le médecin malgré lui','le medecin malgre lui','le misanthrope','les précieuses ridicules','dom juan','l\'école des femmes','le bourgeois gentilhomme'], 'Littérature', 'hard'],
  ['Oeuvres d\'Agatha Christie', ['le crime de l\'orient-express','dix petits nègres','ils étaient dix','mort sur le nil','abc contre poirot','le meurtre de roger ackroyd','la maison biscornue','miss marple au club du mardi'], 'Littérature', 'hard'],
  ['Symboles du tableau périodique (premiers 20)', ['h','he','li','be','b','c','n','o','f','ne','na','mg','al','si','p','s','cl','ar','k','ca'], 'Sciences', 'hard'],
  ['Sports de combat', ['boxe','judo','karaté','karate','taekwondo','lutte','jiu-jitsu','mma','aïkido','aikido','kung-fu','kung fu','muay thaï','muay thai','sumo','escrime','kickboxing','capoeira'], 'Sport', 'medium'],
  ['Ingrédients classiques du petit-déjeuner français', ['baguette','croissant','beurre','confiture','miel','jus d\'orange','café','cafe','thé','the','chocolat chaud','pain','brioche','yaourt','céréales','cereales'], 'Gastronomie', 'easy'],
  ['Instruments de musique à cordes', ['guitare','violon','alto','violoncelle','contrebasse','harpe','ukulélé','ukulele','mandoline','banjo','piano','clavecin','luth','cithare','balalaïka','balalaika'], 'Musique', 'medium'],
  ['Instruments à vent', ['flûte','flute','clarinette','saxophone','trompette','cor','tuba','trombone','hautbois','basson','harmonica','cornemuse','didgeridoo'], 'Musique', 'medium'],
  ['Peintres impressionnistes', ['monet','renoir','degas','pissarro','sisley','morisot','manet','caillebotte','cassatt','bazille'], 'Art', 'hard'],
  ['Services de streaming vidéo', ['netflix','amazon prime','disney+','disney plus','hulu','apple tv+','apple tv','hbo max','max','paramount+','paramount','youtube premium','canal+','canal plus','ocs','arte'], 'Technologie', 'easy'],
  ['Acteurs oscarisés (meilleur acteur)', ['tom hanks','leonardo dicaprio','matthew mcconaughey','casey affleck','gary oldman','rami malek','joaquin phoenix','anthony hopkins','will smith','brendan fraser','cillian murphy','daniel day-lewis','forest whitaker','sean penn'], 'Cinéma', 'hard'],
  ['Actrices oscarisées (meilleure actrice)', ['meryl streep','cate blanchett','nicole kidman','charlize theron','kate winslet','sandra bullock','natalie portman','meryl streep','jennifer lawrence','emma stone','brie larson','frances mcdormand','olivia colman','jessica chastain','michelle yeoh','emma stone'], 'Cinéma', 'hard'],
  ['Dessinateurs/Scénaristes de BD franco-belge', ['hergé','herge','goscinny','uderzo','morris','franquin','peyo','jacobs','tillieux','leloup','bilal','moebius','gotlib','bretécher','breteche'], 'Littérature', 'hard'],
  ['Héros de BD franco-belge', ['tintin','astérix','asterix','lucky luke','spirou','gaston lagaffe','boule et bill','les schtroumpfs','thorgal','blake et mortimer','achille talon','iznogoud','valérian','valerian','largo winch','titeuf'], 'Littérature', 'medium'],
  ['Marques françaises de luxe', ['chanel','louis vuitton','dior','hermès','hermes','saint laurent','cartier','lancôme','lancome','guerlain','lanvin','givenchy','céline','celine','kenzo','balmain','longchamp'], 'Divers', 'medium'],
  ['Pays frontaliers de la Russie', ['chine','mongolie','kazakhstan','ukraine','biélorussie','bielorussie','finlande','norvège','norvege','estonie','lettonie','lituanie','pologne','géorgie','georgie','azerbaïdjan','azerbaidjan','corée du nord','coree du nord'], 'Géographie', 'hard'],
  ['Pays frontaliers de la Chine', ['russie','mongolie','kazakhstan','kirghizistan','tadjikistan','afghanistan','pakistan','inde','népal','nepal','bhoutan','birmanie','laos','vietnam','corée du nord','coree du nord'], 'Géographie', 'hard'],
  ['Pays d\'Afrique du Nord', ['maroc','algérie','algerie','tunisie','libye','égypte','egypte','mauritanie','soudan'], 'Géographie', 'medium'],
  ['Pays d\'Océanie (hors Australie/NZ)', ['fidji','papouasie-nouvelle-guinée','samoa','tonga','vanuatu','kiribati','salomon','nauru','tuvalu','palaos','îles marshall','iles marshall','micronésie','micronesie'], 'Géographie', 'hard'],
  ['Pays de l\'ancienne Yougoslavie', ['serbie','croatie','slovénie','slovenie','bosnie-herzégovine','bosnie herzegovine','monténégro','montenegro','macédoine du nord','macedoine du nord','kosovo'], 'Géographie', 'hard'],
  ['Sports de plein air', ['randonnée','randonnee','escalade','alpinisme','ski','surf','voile','plongée','plongee','pêche','peche','chasse','équitation','equitation','vélo','velo','course à pied','parapente','kayak','canyoning'], 'Sport', 'easy'],
  ['Personnages de Disney (princesses)', ['blanche-neige','cendrillon','aurore','ariel','belle','jasmine','pocahontas','mulan','tiana','raiponce','mérida','merida','anna','elsa','moana','vaiana'], 'Cinéma', 'easy'],
  ['Jeux de société classiques', ['échecs','echecs','dames','scrabble','monopoly','cluedo','risk','uno','trivial pursuit','catan','carcassonne','pictionary','times up','loups-garous','loups garous','7 wonders'], 'Divers', 'easy'],
  ['Formes géométriques', ['carré','carre','rectangle','cercle','triangle','losange','trapèze','trapeze','parallélogramme','parallelogramme','pentagone','hexagone','heptagone','octogone','ellipse','ovale'], 'Sciences', 'easy'],
  ['Coupes du monde de rugby — pays organisateurs', ['nouvelle-zélande','nouvelle zelande','australie','afrique du sud','pays de galles','france','angleterre','japon'], 'Sport', 'hard'],
  ['Musées parisiens', ['louvre','orsay','pompidou','rodin','picasso','quai branly','orangerie','petit palais','grand palais','musée de l\'homme','musee de l homme','guimet','carnavalet','musée d\'art moderne','musee d art moderne','cluny'], 'Art', 'medium'],
  ['Opéras célèbres', ['la traviata','carmen','la flûte enchantée','la flute enchantee','don giovanni','les noces de figaro','aïda','aida','nabucco','tosca','la bohème','la boheme','madame butterfly','rigoletto','otello','tannhäuser','tannhauser','parsifal','tristan et isolde'], 'Musique', 'hard'],
  ['Pays bordant la Méditerranée', ['france','espagne','italie','grèce','grece','turquie','syrie','liban','israël','israel','égypte','egypte','libye','tunisie','algérie','algerie','maroc','monaco','malte','chypre','albanie','croatie','slovénie','slovenie','bosnie','monténégro','montenegro'], 'Géographie', 'medium'],
  ['Pays bordant la mer Noire', ['russie','turquie','géorgie','georgie','bulgarie','roumanie','ukraine'], 'Géographie', 'hard'],
  ['Pays insulaires', ['japon','royaume-uni','cuba','islande','madagascar','sri lanka','philippines','indonésie','indonesie','nouvelle-zélande','nouvelle zelande','malte','chypre','maurice','seychelles','comores','maldives','bahamas','jamaïque','jamaique','haïti','haiti','république dominicaine','republique dominicaine'], 'Géographie', 'medium'],
  ['Langues romanes', ['français','francais','italien','espagnol','portugais','roumain','catalan','occitan','galicien','sarde','corse'], 'Divers', 'medium'],
  ['Super-héros DC Comics', ['superman','batman','wonder woman','flash','aquaman','green lantern','cyborg','shazam','green arrow','supergirl','robin','nightwing','batgirl','batwoman'], 'Cinéma', 'easy'],
  ['Anciennes capitales célèbres', ['bonn','bonne','karlsruhe','leningrad','constantinople','istanbul','saint-pétersbourg','saint petersbourg','kyoto','edo','nara','tenochtitlan','cuzco','abomey','timbuktu','tombouctou'], 'Histoire', 'hard'],
  ['Océans et mers', ['pacifique','atlantique','indien','arctique','austral','méditerranée','mediterranee','mer noire','mer rouge','mer du nord','mer baltique','mer caspienne','mer caraïbe','mer caraibe','mer d\'aral'], 'Géographie', 'medium'],
  ['Fleuves du monde', ['nil','amazone','yangzi','mississippi','mekong','congo','niger','gange','brahmapoutre','yenissei','lena','ob','volga','rhin','danube','rhône','rhone','loire','seine','tage','èbre','ebre','pô','po'], 'Géographie', 'medium'],
  ['Désert du monde', ['sahara','gobi','kalahari','namib','atacama','arabie','syrie','thar','taklamakan','mojave','death valley','grand bassin','simpson','victoria','rub al-khali','rub al khali'], 'Géographie', 'hard'],
  ['Grandes chaînes de montagnes', ['alpes','pyrénées','pyrenees','himalaya','andes','rocheuses','oural','atlas','caucase','carpates','appalaches','scandinaves','apennins','zagros','tien shan'], 'Géographie', 'medium'],
  ['Musiciens/compositeurs français', ['berlioz','debussy','ravel','fauré','faure','saint-saëns','saint saens','bizet','gounod','offenbach','satie','poulenc','boulez','messiaen','dutilleux','lully','rameau','couperin'], 'Musique', 'hard'],
  ['Vins français célèbres (régions)', ['bordeaux','bourgogne','champagne','chablis','sancerre','saint-émilion','saint emilion','médoc','medoc','châteauneuf-du-pape','chateauneuf du pape','côtes du rhône','cotes du rhone','alsace','beaujolais','jurançon','juranc on','cahors','gaillac','chinon'], 'Gastronomie', 'hard'],
  ['Cadeaux/Tour de France — Maillots', ['jaune','vert','pois','blanc'], 'Sport', 'medium'],
  ['Acteurs français', ['jean gabin','louis de funès','louis de funes','bourvil','fernandel','jean-paul belmondo','belmondo','alain delon','gérard depardieu','gerard depardieu','jean reno','daniel auteuil','vincent cassel','jean dujardin','omar sy','françois cluzet','francois cluzet','guillaume canet','pierre richard','jacques villeret','patrick bruel'], 'Cinéma', 'medium'],
  ['Actrices françaises', ['brigitte bardot','catherine deneuve','isabelle adjani','isabelle huppert','juliette binoche','marion cotillard','sophie marceau','fanny ardant','nathalie baye','julie delpy','audrey tautou','cécile de france','cecile de france','léa seydoux','lea seydoux','bérénice bejo','berenice bejo'], 'Cinéma', 'medium'],
  ['Navigateurs et explorateurs', ['christophe colomb','vasco de gama','magellan','marco polo','amerigo vespucci','jacques cartier','champlain','bougainville','la pérouse','la perouse','james cook','amundsen','shackleton','livingstone','stanley'], 'Histoire', 'medium'],
  ['Grandes batailles', ['marathon','thermopyles','cannes','cannae','alésia','alesia','hastings','azincourt','crécy','crecy','bouvines','marignan','waterloo','austerlitz','valmy','verdun','somme','stalingrad','normandie','midway'], 'Histoire', 'hard'],
  ['Sportifs français', ['zinedine zidane','zidane','thierry henry','michel platini','platini','raymond kopa','kopa','just fontaine','kylian mbappé','mbappe','karim benzema','benzema','antoine griezmann','griezmann','tony parker','teddy riner','martin fourcade','marie-josé pérec','marie jose perec','yannick noah','laure manaudou','alain prost','jean-pierre rives','jean pierre rives'], 'Sport', 'medium'],
];

for (const [prompt, items, cat, diff] of hotPotatoThemes) {
  if (hpQs.length >= 80) break;
  hpQs.push(makeHotPotato(id('hp', hN++), prompt, items, cat, diff, 'Wikipedia'));
}

hpQs.length = Math.min(hpQs.length, 80);

// ============ MAP (~100) ============
const mapQs = [];
let mN = 1;

// Cities (from capitals) – 90 plus some landmarks
for (const [, capital, , , , lat, lng, diff] of COUNTRIES) {
  if (mapQs.length >= 90) break;
  mapQs.push(makeMap(
    id('mp', mN++),
    `Place ${capital} sur la carte.`,
    capital,
    lat, lng,
    diff,
    diff === 'easy' ? 2500 : diff === 'medium' ? 3000 : 4000,
    `Wikipedia:${capital}`
  ));
}

// Landmarks
const landmarks = [
  ['Tour Eiffel', 48.8584, 2.2945, 'easy', 1500],
  ['Colisée de Rome', 41.8902, 12.4922, 'easy', 2000],
  ['Machu Picchu', -13.1631, -72.545, 'easy', 4000],
  ['Taj Mahal', 27.1751, 78.0421, 'medium', 3000],
  ['Pyramides de Gizeh', 29.9792, 31.1342, 'easy', 2500],
  ['Statue de la Liberté', 40.6892, -74.0445, 'easy', 3000],
  ['Cristo Redentor (Rio)', -22.9519, -43.2105, 'medium', 4000],
  ['Grande Muraille (Badaling)', 40.3587, 116.0171, 'medium', 3500],
  ['Angkor Vat', 13.4125, 103.8667, 'hard', 3500],
  ['Stonehenge', 51.1789, -1.8262, 'medium', 2000],
];
for (const [label, lat, lng, diff, maxKm] of landmarks) {
  if (mapQs.length >= 100) break;
  mapQs.push(makeMap(
    id('mp', mN++),
    `Place ${label} sur la carte.`,
    label, lat, lng, diff, maxKm, `Wikipedia:${label}`
  ));
}

mapQs.length = Math.min(mapQs.length, 100);

// ============ CHRONOLOGY (~100) ============
const chronoQs = [];
let chN = 1;

// Group events by category
const eventsByCat = {};
for (const [year, label, cat] of HISTORICAL_EVENTS) {
  (eventsByCat[cat] ||= []).push([year, label]);
}

// Build decade/century/era groups from HISTORICAL_EVENTS
function makeChronoGroups(events, size, count, cat, baseDiff) {
  const out = [];
  const sorted = events.slice().sort(() => Math.random() - 0.5);
  for (let i = 0; i < count && i * size + size <= sorted.length; i++) {
    out.push(sorted.slice(i * size, i * size + size));
  }
  return out;
}

// Deterministic seeded shuffle so output stable
function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const allHist = HISTORICAL_EVENTS.slice();

// Build several reshuffled passes to produce varied chronology sets; overlap OK as order differs.
let seed = 42;
while (chronoQs.length < 70) {
  const shuffled = seededShuffle(allHist, seed);
  seed += 7;
  const size = chronoQs.length < 20 ? 4 : chronoQs.length < 45 ? 5 : 6;
  let cIdx = 0;
  while (chronoQs.length < 70 && cIdx + size <= shuffled.length) {
    const group = shuffled.slice(cIdx, cIdx + size);
    cIdx += size;
    const diff = size === 4 ? 'easy' : size === 5 ? 'medium' : 'hard';
    const cats = Array.from(new Set(group.map((g) => g[2])));
    const category = cats.length === 1 ? cats[0] : 'Histoire';
    chronoQs.push(makeChronology(
      id('ch', chN++),
      `Remets ces événements dans l'ordre chronologique.`,
      group, category, diff, 'Wikipedia'
    ));
  }
}

// Specific-theme chronology questions
const chronoThemes = [
  ['Films marquants — du plus ancien au plus récent.', [
    [1941, 'Citizen Kane'], [1972, 'Le Parrain'], [1977, 'La Guerre des étoiles'], [1994, 'Pulp Fiction'], [1999, 'Matrix']
  ], 'Cinéma', 'medium'],
  ['Albums légendaires par année.', [
    [1967, "Sgt. Pepper's (Beatles)"], [1973, 'Dark Side of the Moon'], [1982, 'Thriller'], [1991, 'Nevermind'], [2011, '21 (Adele)']
  ], 'Musique', 'medium'],
  ['Inventions par ordre.', [
    [1876, 'Téléphone'], [1879, 'Ampoule électrique'], [1903, 'Avion (Wright)'], [1969, 'Internet (ARPANET)'], [1989, 'World Wide Web']
  ], 'Technologie', 'medium'],
  ['Découvertes scientifiques.', [
    [1543, 'Héliocentrisme (Copernic)'], [1687, 'Gravitation (Newton)'], [1859, 'Évolution (Darwin)'], [1905, 'Relativité (Einstein)'], [1953, 'Structure ADN']
  ], 'Sciences', 'hard'],
  ['Empires et civilisations.', [
    [-509, 'République romaine'], [-221, 'Unification de la Chine (Qin)'], [476, 'Chute Rome d\'Occident'], [1453, 'Chute Constantinople'], [1806, 'Fin du Saint-Empire']
  ], 'Histoire', 'hard'],
  ['Explorations majeures.', [
    [1271, 'Marco Polo part'], [1492, 'Colomb découvre l\'Amérique'], [1498, 'Vasco de Gama en Inde'], [1519, 'Magellan commence son tour'], [1911, 'Amundsen au pôle Sud']
  ], 'Histoire', 'medium'],
  ['Rois de France célèbres.', [
    [800, 'Couronnement de Charlemagne'], [987, 'Hugues Capet'], [1226, 'Louis IX'], [1515, 'François Ier à Marignan'], [1682, 'Louis XIV à Versailles']
  ], 'Histoire', 'hard'],
  ['Technologies numériques.', [
    [1971, 'Premier micro-processeur'], [1981, 'IBM PC'], [1991, 'Web public'], [2007, 'iPhone'], [2022, 'ChatGPT']
  ], 'Technologie', 'medium'],
  ['Écrivains — naissance.', [
    [1265, 'Dante'], [1564, 'Shakespeare'], [1622, 'Molière'], [1802, 'Victor Hugo'], [1871, 'Proust']
  ], 'Littérature', 'hard'],
  ['Peintres — naissance.', [
    [1452, 'Léonard de Vinci'], [1606, 'Rembrandt'], [1853, 'Van Gogh'], [1881, 'Picasso'], [1904, 'Dalí']
  ], 'Art', 'medium'],
  ['Coupes du monde de foot — par an.', [
    [1930, 'Uruguay'], [1966, 'Angleterre'], [1998, 'France'], [2014, 'Allemagne'], [2022, 'Argentine']
  ], 'Sport', 'medium'],
  ['Événements du XXe siècle.', [
    [1914, 'WW1 commence'], [1929, 'Krach'], [1945, 'WW2 finit'], [1969, 'Lune'], [1989, 'Mur de Berlin']
  ], 'Histoire', 'easy'],
  ['JO d\'été par ville.', [
    [1896, 'Athènes'], [1924, 'Paris'], [1992, 'Barcelone'], [2008, 'Pékin'], [2024, 'Paris']
  ], 'Sport', 'medium'],
  ['Naissance de personnalités.', [
    [1769, 'Napoléon'], [1809, 'Darwin'], [1879, 'Einstein'], [1929, 'Martin Luther King'], [1955, 'Steve Jobs']
  ], 'Histoire', 'medium'],
  ['Révolutions.', [
    [1776, 'Indépendance américaine'], [1789, 'Révolution française'], [1848, 'Printemps des peuples'], [1917, 'Révolution russe'], [1979, 'Révolution iranienne']
  ], 'Histoire', 'medium'],
  ['Catastrophes modernes.', [
    [1906, 'Séisme San Francisco'], [1912, 'Titanic'], [1986, 'Tchernobyl'], [2004, 'Tsunami océan Indien'], [2011, 'Fukushima']
  ], 'Histoire', 'medium'],
  ['Pandémies.', [
    [1347, 'Peste noire'], [1520, 'Variole aux Amériques'], [1918, 'Grippe espagnole'], [1981, 'Début du SIDA'], [2020, 'Covid-19']
  ], 'Histoire', 'medium'],
  ['Conquête spatiale.', [
    [1957, 'Spoutnik'], [1961, 'Gagarine'], [1969, 'Apollo 11'], [1981, 'Navette spatiale'], [1998, 'Début ISS']
  ], 'Technologie', 'medium'],
  ['Musique pop.', [
    [1958, 'Naissance de Michael Jackson'], [1964, 'Beatles en Amérique'], [1977, 'Saturday Night Fever'], [1987, 'U2 – The Joshua Tree'], [2008, 'Lady Gaga – The Fame']
  ], 'Musique', 'hard'],
  ['Prix Nobel célèbres.', [
    [1903, 'Marie Curie (physique)'], [1921, 'Einstein (physique)'], [1954, 'Hemingway (littérature)'], [1993, 'Mandela (paix)'], [2014, 'Malala Yousafzai (paix)']
  ], 'Histoire', 'hard'],
  ['Géographie : indépendances.', [
    [1776, 'USA'], [1804, 'Haïti'], [1947, 'Inde'], [1960, 'Plusieurs pays africains'], [1991, 'Pays baltes']
  ], 'Histoire', 'medium'],
  ['Cinéma français.', [
    [1895, 'Premier film des Lumière'], [1959, 'À bout de souffle'], [1966, 'La Grande Vadrouille'], [2001, 'Amélie Poulain'], [2011, 'Intouchables']
  ], 'Cinéma', 'hard'],
  ['Musique classique.', [
    [1685, 'Naissance de Bach'], [1756, 'Naissance de Mozart'], [1770, 'Naissance de Beethoven'], [1810, 'Naissance de Chopin'], [1840, 'Naissance de Tchaïkovski']
  ], 'Musique', 'hard'],
  ['Traités importants.', [
    [1648, 'Westphalie'], [1815, 'Vienne'], [1919, 'Versailles'], [1957, 'Rome (CEE)'], [1992, 'Maastricht']
  ], 'Histoire', 'hard'],
  ['Constructions monumentales.', [
    [-2560, 'Pyramide de Khéops'], [80, 'Colisée'], [1345, 'Notre-Dame finie'], [1889, 'Tour Eiffel'], [2010, 'Burj Khalifa']
  ], 'Histoire', 'medium'],
  ['Philosophes — naissance.', [
    [-470, 'Socrate'], [-427, 'Platon'], [-384, 'Aristote'], [1596, 'Descartes'], [1844, 'Nietzsche']
  ], 'Littérature', 'hard'],
  ['Présidents français.', [
    [1959, 'De Gaulle'], [1974, 'Giscard d\'Estaing'], [1981, 'Mitterrand'], [2007, 'Sarkozy'], [2017, 'Macron']
  ], 'Histoire', 'easy'],
  ['Jeux vidéo emblématiques.', [
    [1972, 'Pong'], [1985, 'Super Mario Bros'], [1994, 'PlayStation'], [2006, 'Wii'], [2017, 'Nintendo Switch']
  ], 'Technologie', 'medium'],
  ['Séries mondiales.', [
    [1959, 'La Quatrième Dimension'], [1999, 'Les Sopranos'], [2008, 'Breaking Bad'], [2011, 'Game of Thrones'], [2016, 'Stranger Things']
  ], 'Cinéma', 'medium'],
  ['Prix Goncourt.', [
    [1903, 'Premier Goncourt'], [1933, 'Malraux – La Condition humaine'], [1984, 'Duras – L\'Amant'], [2006, 'Littell – Les Bienveillantes'], [2022, 'Sarr']
  ], 'Littérature', 'hard'],
];

for (const [prompt, events, cat, diff] of chronoThemes) {
  if (chronoQs.length >= 100) break;
  chronoQs.push(makeChronology(id('ch', chN++), prompt, events, cat, diff, 'Wikipedia'));
}

chronoQs.length = Math.min(chronoQs.length, 100);

// ----------------------------------------------------------------------------
// Output
// ----------------------------------------------------------------------------

const write = (name, data) => {
  const path = resolve(SEED_DIR, `wikipedia-${name}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`wrote ${data.length}\t${path}`);
};

write('classic', classicQs);
write('estimation', estQs);
write('speed-elim', seQs);
write('list-turns', ltQs);
write('hot-potato', hpQs);
write('map', mapQs);
write('chronology', chronoQs);

const total = classicQs.length + estQs.length + seQs.length + ltQs.length + hpQs.length + mapQs.length + chronoQs.length;
console.log(`TOTAL: ${total} questions`);
