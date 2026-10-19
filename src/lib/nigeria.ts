// Reference geography for Nigeria: 36 states + FCT, capitals, geopolitical
// zones, the 774 Local Government Areas and INEC polling-unit totals
// (2023 general election register). Coordinates are state-capital centroids
// used to anchor the coverage map.

export type Zone =
  | 'North Central'
  | 'North East'
  | 'North West'
  | 'South East'
  | 'South South'
  | 'South West'

export interface NigerianState {
  name: string
  code: string
  capital: string
  zone: Zone
  lat: number
  lng: number
  pollingUnits: number
  wards: number
  lgas: string[]
}

export const STATES: NigerianState[] = [
  { name: 'Abia', code: 'AB', capital: 'Umuahia', zone: 'South East', lat: 5.5249, lng: 7.4942, pollingUnits: 2675, wards: 184, lgas: ['Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia', 'Osisioma', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umu Nneochi'] },
  { name: 'Adamawa', code: 'AD', capital: 'Yola', zone: 'North East', lat: 9.2035, lng: 12.4954, pollingUnits: 4104, wards: 226, lgas: ['Demsa', 'Fufure', 'Ganye', 'Gayuk', 'Gombi', 'Grie', 'Hong', 'Jada', 'Lamurde', 'Madagali', 'Maiha', 'Mayo Belwa', 'Michika', 'Mubi North', 'Mubi South', 'Numan', 'Shelleng', 'Song', 'Toungo', 'Yola North', 'Yola South'] },
  { name: 'Akwa Ibom', code: 'AK', capital: 'Uyo', zone: 'South South', lat: 5.0377, lng: 7.9128, pollingUnits: 4353, wards: 329, lgas: ['Abak', 'Eastern Obolo', 'Eket', 'Esit Eket', 'Essien Udim', 'Etim Ekpo', 'Etinan', 'Ibeno', 'Ibesikpo Asutan', 'Ibiono-Ibom', 'Ika', 'Ikono', 'Ikot Abasi', 'Ikot Ekpene', 'Ini', 'Itu', 'Mbo', 'Mkpat-Enin', 'Nsit-Atai', 'Nsit-Ibom', 'Nsit-Ubium', 'Obot Akara', 'Okobo', 'Onna', 'Oron', 'Oruk Anam', 'Udung-Uko', 'Ukanafun', 'Uruan', 'Urue-Offong/Oruko', 'Uyo'] },
  { name: 'Anambra', code: 'AN', capital: 'Awka', zone: 'South East', lat: 6.2104, lng: 7.0741, pollingUnits: 5720, wards: 326, lgas: ['Aguata', 'Anambra East', 'Anambra West', 'Anaocha', 'Awka North', 'Awka South', 'Ayamelum', 'Dunukofia', 'Ekwusigo', 'Idemili North', 'Idemili South', 'Ihiala', 'Njikoka', 'Nnewi North', 'Nnewi South', 'Ogbaru', 'Onitsha North', 'Onitsha South', 'Orumba North', 'Orumba South', 'Oyi'] },
  { name: 'Bauchi', code: 'BA', capital: 'Bauchi', zone: 'North East', lat: 10.3158, lng: 9.8442, pollingUnits: 5525, wards: 212, lgas: ['Alkaleri', 'Bauchi', 'Bogoro', 'Damban', 'Darazo', 'Dass', 'Gamawa', 'Ganjuwa', 'Giade', 'Itas/Gadau', "Jama'are", 'Katagum', 'Kirfi', 'Misau', 'Ningi', 'Shira', 'Tafawa Balewa', 'Toro', 'Warji', 'Zaki'] },
  { name: 'Bayelsa', code: 'BY', capital: 'Yenagoa', zone: 'South South', lat: 4.9267, lng: 6.2676, pollingUnits: 2244, wards: 105, lgas: ['Brass', 'Ekeremor', 'Kolokuma/Opokuma', 'Nembe', 'Ogbia', 'Sagbama', 'Southern Ijaw', 'Yenagoa'] },
  { name: 'Benue', code: 'BE', capital: 'Makurdi', zone: 'North Central', lat: 7.7337, lng: 8.5214, pollingUnits: 5016, wards: 276, lgas: ['Ado', 'Agatu', 'Apa', 'Buruku', 'Gboko', 'Guma', 'Gwer East', 'Gwer West', 'Katsina-Ala', 'Konshisha', 'Kwande', 'Logo', 'Makurdi', 'Obi', 'Ogbadibo', 'Ohimini', 'Oju', 'Okpokwu', 'Otukpo', 'Tarka', 'Ukum', 'Ushongo', 'Vandeikya'] },
  { name: 'Borno', code: 'BO', capital: 'Maiduguri', zone: 'North East', lat: 11.8333, lng: 13.15, pollingUnits: 4926, wards: 312, lgas: ['Abadam', 'Askira/Uba', 'Bama', 'Bayo', 'Biu', 'Chibok', 'Damboa', 'Dikwa', 'Gubio', 'Guzamala', 'Gwoza', 'Hawul', 'Jere', 'Kaga', 'Kala/Balge', 'Konduga', 'Kukawa', 'Kwaya Kusar', 'Mafa', 'Magumeri', 'Maiduguri', 'Marte', 'Mobbar', 'Monguno', 'Ngala', 'Nganzai', 'Shani'] },
  { name: 'Cross River', code: 'CR', capital: 'Calabar', zone: 'South South', lat: 4.9757, lng: 8.3417, pollingUnits: 3281, wards: 196, lgas: ['Abi', 'Akamkpa', 'Akpabuyo', 'Bakassi', 'Bekwarra', 'Biase', 'Boki', 'Calabar Municipal', 'Calabar South', 'Etung', 'Ikom', 'Obanliku', 'Obubra', 'Obudu', 'Odukpani', 'Ogoja', 'Yakuur', 'Yala'] },
  { name: 'Delta', code: 'DE', capital: 'Asaba', zone: 'South South', lat: 6.1985, lng: 6.7319, pollingUnits: 5863, wards: 270, lgas: ['Aniocha North', 'Aniocha South', 'Bomadi', 'Burutu', 'Ethiope East', 'Ethiope West', 'Ika North East', 'Ika South', 'Isoko North', 'Isoko South', 'Ndokwa East', 'Ndokwa West', 'Okpe', 'Oshimili North', 'Oshimili South', 'Patani', 'Sapele', 'Udu', 'Ughelli North', 'Ughelli South', 'Ukwuani', 'Uvwie', 'Warri North', 'Warri South', 'Warri South West'] },
  { name: 'Ebonyi', code: 'EB', capital: 'Abakaliki', zone: 'South East', lat: 6.3249, lng: 8.1137, pollingUnits: 2394, wards: 171, lgas: ['Abakaliki', 'Afikpo North', 'Afikpo South', 'Ebonyi', 'Ezza North', 'Ezza South', 'Ikwo', 'Ishielu', 'Ivo', 'Izzi', 'Ohaozara', 'Ohaukwu', 'Onicha'] },
  { name: 'Edo', code: 'ED', capital: 'Benin City', zone: 'South South', lat: 6.335, lng: 5.6037, pollingUnits: 4519, wards: 192, lgas: ['Akoko-Edo', 'Egor', 'Esan Central', 'Esan North-East', 'Esan South-East', 'Esan West', 'Etsako Central', 'Etsako East', 'Etsako West', 'Igueben', 'Ikpoba-Okha', 'Oredo', 'Orhionmwon', 'Ovia North-East', 'Ovia South-West', 'Owan East', 'Owan West', 'Uhunmwonde'] },
  { name: 'Ekiti', code: 'EK', capital: 'Ado-Ekiti', zone: 'South West', lat: 7.6211, lng: 5.2214, pollingUnits: 2445, wards: 177, lgas: ['Ado-Ekiti', 'Efon', 'Ekiti East', 'Ekiti South-West', 'Ekiti West', 'Emure', 'Gbonyin', 'Ido-Osi', 'Ijero', 'Ikere', 'Ikole', 'Ilejemeje', 'Irepodun/Ifelodun', 'Ise/Orun', 'Moba', 'Oye'] },
  { name: 'Enugu', code: 'EN', capital: 'Enugu', zone: 'South East', lat: 6.4584, lng: 7.5464, pollingUnits: 4145, wards: 260, lgas: ['Aninri', 'Awgu', 'Enugu East', 'Enugu North', 'Enugu South', 'Ezeagu', 'Igbo Etiti', 'Igbo Eze North', 'Igbo Eze South', 'Isi Uzo', 'Nkanu East', 'Nkanu West', 'Nsukka', 'Oji River', 'Udenu', 'Udi', 'Uzo-Uwani'] },
  { name: 'FCT', code: 'FC', capital: 'Abuja', zone: 'North Central', lat: 9.0765, lng: 7.3986, pollingUnits: 2822, wards: 62, lgas: ['Abaji', 'Abuja Municipal (AMAC)', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali'] },
  { name: 'Gombe', code: 'GO', capital: 'Gombe', zone: 'North East', lat: 10.2897, lng: 11.1673, pollingUnits: 2218, wards: 114, lgas: ['Akko', 'Balanga', 'Billiri', 'Dukku', 'Funakaye', 'Gombe', 'Kaltungo', 'Kwami', 'Nafada', 'Shongom', 'Yamaltu/Deba'] },
  { name: 'Imo', code: 'IM', capital: 'Owerri', zone: 'South East', lat: 5.485, lng: 7.0351, pollingUnits: 4758, wards: 305, lgas: ['Aboh Mbaise', 'Ahiazu Mbaise', 'Ehime Mbano', 'Ezinihitte', 'Ideato North', 'Ideato South', 'Ihitte/Uboma', 'Ikeduru', 'Isiala Mbano', 'Isu', 'Mbaitoli', 'Ngor Okpala', 'Njaba', 'Nkwerre', 'Nwangele', 'Obowo', 'Oguta', 'Ohaji/Egbema', 'Okigwe', 'Onuimo', 'Orlu', 'Orsu', 'Oru East', 'Oru West', 'Owerri Municipal', 'Owerri North', 'Owerri West'] },
  { name: 'Jigawa', code: 'JI', capital: 'Dutse', zone: 'North West', lat: 11.7564, lng: 9.3388, pollingUnits: 4186, wards: 287, lgas: ['Auyo', 'Babura', 'Biriniwa', 'Birnin Kudu', 'Buji', 'Dutse', 'Gagarawa', 'Garki', 'Gumel', 'Guri', 'Gwaram', 'Gwiwa', 'Hadejia', 'Jahun', 'Kafin Hausa', 'Kaugama', 'Kazaure', 'Kiri Kasama', 'Kiyawa', 'Maigatari', 'Malam Madori', 'Miga', 'Ringim', 'Roni', 'Sule Tankarkar', 'Taura', 'Yankwashi'] },
  { name: 'Kaduna', code: 'KD', capital: 'Kaduna', zone: 'North West', lat: 10.5105, lng: 7.4165, pollingUnits: 8012, wards: 255, lgas: ['Birnin Gwari', 'Chikun', 'Giwa', 'Igabi', 'Ikara', 'Jaba', "Jema'a", 'Kachia', 'Kaduna North', 'Kaduna South', 'Kagarko', 'Kajuru', 'Kaura', 'Kauru', 'Kubau', 'Kudan', 'Lere', 'Makarfi', 'Sabon Gari', 'Sanga', 'Soba', 'Zangon Kataf', 'Zaria'] },
  { name: 'Kano', code: 'KN', capital: 'Kano', zone: 'North West', lat: 12.0022, lng: 8.592, pollingUnits: 11222, wards: 484, lgas: ['Ajingi', 'Albasu', 'Bagwai', 'Bebeji', 'Bichi', 'Bunkure', 'Dala', 'Dambatta', 'Dawakin Kudu', 'Dawakin Tofa', 'Doguwa', 'Fagge', 'Gabasawa', 'Garko', 'Garun Mallam', 'Gaya', 'Gezawa', 'Gwale', 'Gwarzo', 'Kabo', 'Kano Municipal', 'Karaye', 'Kibiya', 'Kiru', 'Kumbotso', 'Kunchi', 'Kura', 'Madobi', 'Makoda', 'Minjibir', 'Nasarawa', 'Rano', 'Rimin Gado', 'Rogo', 'Shanono', 'Sumaila', 'Takai', 'Tarauni', 'Tofa', 'Tsanyawa', 'Tudun Wada', 'Ungogo', 'Warawa', 'Wudil'] },
  { name: 'Katsina', code: 'KT', capital: 'Katsina', zone: 'North West', lat: 12.9908, lng: 7.6018, pollingUnits: 6652, wards: 361, lgas: ['Bakori', 'Batagarawa', 'Batsari', 'Baure', 'Bindawa', 'Charanchi', 'Dandume', 'Danja', 'Dan Musa', 'Daura', 'Dutsi', 'Dutsin-Ma', 'Faskari', 'Funtua', 'Ingawa', 'Jibia', 'Kafur', 'Kaita', 'Kankara', 'Kankia', 'Katsina', 'Kurfi', 'Kusada', "Mai'Adua", 'Malumfashi', 'Mani', 'Mashi', 'Matazu', 'Musawa', 'Rimi', 'Sabuwa', 'Safana', 'Sandamu', 'Zango'] },
  { name: 'Kebbi', code: 'KB', capital: 'Birnin Kebbi', zone: 'North West', lat: 12.4539, lng: 4.1975, pollingUnits: 3756, wards: 225, lgas: ['Aleiro', 'Arewa Dandi', 'Argungu', 'Augie', 'Bagudo', 'Birnin Kebbi', 'Bunza', 'Dandi', 'Fakai', 'Gwandu', 'Jega', 'Kalgo', 'Koko/Besse', 'Maiyama', 'Ngaski', 'Sakaba', 'Shanga', 'Suru', 'Wasagu/Danko', 'Yauri', 'Zuru'] },
  { name: 'Kogi', code: 'KO', capital: 'Lokoja', zone: 'North Central', lat: 7.8023, lng: 6.7333, pollingUnits: 3508, wards: 239, lgas: ['Adavi', 'Ajaokuta', 'Ankpa', 'Bassa', 'Dekina', 'Ibaji', 'Idah', 'Igalamela-Odolu', 'Ijumu', 'Kabba/Bunu', 'Kogi', 'Lokoja', 'Mopa-Muro', 'Ofu', 'Ogori/Magongo', 'Okehi', 'Okene', 'Olamaboro', 'Omala', 'Yagba East', 'Yagba West'] },
  { name: 'Kwara', code: 'KW', capital: 'Ilorin', zone: 'North Central', lat: 8.4966, lng: 4.5421, pollingUnits: 2372, wards: 193, lgas: ['Asa', 'Baruten', 'Edu', 'Ekiti', 'Ifelodun', 'Ilorin East', 'Ilorin South', 'Ilorin West', 'Irepodun', 'Isin', 'Kaiama', 'Moro', 'Offa', 'Oke Ero', 'Oyun', 'Pategi'] },
  { name: 'Lagos', code: 'LA', capital: 'Ikeja', zone: 'South West', lat: 6.6018, lng: 3.3515, pollingUnits: 13325, wards: 245, lgas: ['Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere'] },
  { name: 'Nasarawa', code: 'NA', capital: 'Lafia', zone: 'North Central', lat: 8.4939, lng: 8.5156, pollingUnits: 3256, wards: 147, lgas: ['Akwanga', 'Awe', 'Doma', 'Karu', 'Keana', 'Keffi', 'Kokona', 'Lafia', 'Nasarawa', 'Nasarawa Egon', 'Obi', 'Toto', 'Wamba'] },
  { name: 'Niger', code: 'NI', capital: 'Minna', zone: 'North Central', lat: 9.6139, lng: 6.5569, pollingUnits: 4950, wards: 274, lgas: ['Agaie', 'Agwara', 'Bida', 'Borgu', 'Bosso', 'Chanchaga', 'Edati', 'Gbako', 'Gurara', 'Katcha', 'Kontagora', 'Lapai', 'Lavun', 'Magama', 'Mariga', 'Mashegu', 'Mokwa', 'Munya', 'Paikoro', 'Rafi', 'Rijau', 'Shiroro', 'Suleja', 'Tafa', 'Wushishi'] },
  { name: 'Ogun', code: 'OG', capital: 'Abeokuta', zone: 'South West', lat: 7.1475, lng: 3.3619, pollingUnits: 5042, wards: 236, lgas: ['Abeokuta North', 'Abeokuta South', 'Ado-Odo/Ota', 'Ewekoro', 'Ifo', 'Ijebu East', 'Ijebu North', 'Ijebu North East', 'Ijebu Ode', 'Ikenne', 'Imeko Afon', 'Ipokia', 'Obafemi Owode', 'Odeda', 'Odogbolu', 'Ogun Waterside', 'Remo North', 'Sagamu', 'Yewa North', 'Yewa South'] },
  { name: 'Ondo', code: 'ON', capital: 'Akure', zone: 'South West', lat: 7.2571, lng: 5.2058, pollingUnits: 3933, wards: 203, lgas: ['Akoko North-East', 'Akoko North-West', 'Akoko South-East', 'Akoko South-West', 'Akure North', 'Akure South', 'Ese Odo', 'Idanre', 'Ifedore', 'Ilaje', 'Ile Oluji/Okeigbo', 'Irele', 'Odigbo', 'Okitipupa', 'Ondo East', 'Ondo West', 'Ose', 'Owo'] },
  { name: 'Osun', code: 'OS', capital: 'Osogbo', zone: 'South West', lat: 7.7827, lng: 4.5418, pollingUnits: 3763, wards: 332, lgas: ['Aiyedaade', 'Aiyedire', 'Atakunmosa East', 'Atakunmosa West', 'Boluwaduro', 'Boripe', 'Ede North', 'Ede South', 'Egbedore', 'Ejigbo', 'Ife Central', 'Ife East', 'Ife North', 'Ife South', 'Ifedayo', 'Ifelodun', 'Ila', 'Ilesa East', 'Ilesa West', 'Irepodun', 'Irewole', 'Isokan', 'Iwo', 'Obokun', 'Odo Otin', 'Ola Oluwa', 'Olorunda', 'Oriade', 'Orolu', 'Osogbo'] },
  { name: 'Oyo', code: 'OY', capital: 'Ibadan', zone: 'South West', lat: 7.3775, lng: 3.947, pollingUnits: 6390, wards: 351, lgas: ['Afijio', 'Akinyele', 'Atiba', 'Atisbo', 'Egbeda', 'Ibadan North', 'Ibadan North-East', 'Ibadan North-West', 'Ibadan South-East', 'Ibadan South-West', 'Ibarapa Central', 'Ibarapa East', 'Ibarapa North', 'Ido', 'Irepo', 'Iseyin', 'Itesiwaju', 'Iwajowa', 'Kajola', 'Lagelu', 'Ogbomosho North', 'Ogbomosho South', 'Ogo Oluwa', 'Olorunsogo', 'Oluyole', 'Ona Ara', 'Orelope', 'Ori Ire', 'Oyo East', 'Oyo West', 'Saki East', 'Saki West', 'Surulere'] },
  { name: 'Plateau', code: 'PL', capital: 'Jos', zone: 'North Central', lat: 9.8965, lng: 8.8583, pollingUnits: 4989, wards: 207, lgas: ['Barkin Ladi', 'Bassa', 'Bokkos', 'Jos East', 'Jos North', 'Jos South', 'Kanam', 'Kanke', 'Langtang North', 'Langtang South', 'Mangu', 'Mikang', 'Pankshin', "Qua'an Pan", 'Riyom', 'Shendam', 'Wase'] },
  { name: 'Rivers', code: 'RI', capital: 'Port Harcourt', zone: 'South South', lat: 4.8156, lng: 7.0498, pollingUnits: 6866, wards: 319, lgas: ['Abua/Odual', 'Ahoada East', 'Ahoada West', 'Akuku-Toru', 'Andoni', 'Asari-Toru', 'Bonny', 'Degema', 'Eleme', 'Emohua', 'Etche', 'Gokana', 'Ikwerre', 'Khana', 'Obio/Akpor', 'Ogba/Egbema/Ndoni', 'Ogu/Bolo', 'Okrika', 'Omuma', 'Opobo/Nkoro', 'Oyigbo', 'Port Harcourt', 'Tai'] },
  { name: 'Sokoto', code: 'SO', capital: 'Sokoto', zone: 'North West', lat: 13.0059, lng: 5.2476, pollingUnits: 3935, wards: 244, lgas: ['Binji', 'Bodinga', 'Dange Shuni', 'Gada', 'Goronyo', 'Gudu', 'Gwadabawa', 'Illela', 'Isa', 'Kebbe', 'Kware', 'Rabah', 'Sabon Birni', 'Shagari', 'Silame', 'Sokoto North', 'Sokoto South', 'Tambuwal', 'Tangaza', 'Tureta', 'Wamako', 'Wurno', 'Yabo'] },
  { name: 'Taraba', code: 'TA', capital: 'Jalingo', zone: 'North East', lat: 8.8937, lng: 11.3596, pollingUnits: 3597, wards: 168, lgas: ['Ardo Kola', 'Bali', 'Donga', 'Gashaka', 'Gassol', 'Ibi', 'Jalingo', 'Karim Lamido', 'Kurmi', 'Lau', 'Sardauna', 'Takum', 'Ussa', 'Wukari', 'Yorro', 'Zing'] },
  { name: 'Yobe', code: 'YO', capital: 'Damaturu', zone: 'North East', lat: 11.7479, lng: 11.9608, pollingUnits: 2889, wards: 178, lgas: ['Bade', 'Bursari', 'Damaturu', 'Fika', 'Fune', 'Geidam', 'Gujba', 'Gulani', 'Jakusko', 'Karasuwa', 'Machina', 'Nangere', 'Nguru', 'Potiskum', 'Tarmuwa', 'Yunusari', 'Yusufari'] },
  { name: 'Zamfara', code: 'ZA', capital: 'Gusau', zone: 'North West', lat: 12.1704, lng: 6.6641, pollingUnits: 3529, wards: 147, lgas: ['Anka', 'Bakura', 'Birnin Magaji/Kiyaw', 'Bukkuyum', 'Bungudu', 'Gummi', 'Gusau', 'Kaura Namoda', 'Maradun', 'Maru', 'Shinkafi', 'Talata Mafara', 'Tsafe', 'Zurmi'] },
]

export const ZONES: Zone[] = [
  'North Central',
  'North East',
  'North West',
  'South East',
  'South South',
  'South West',
]

export const NIGERIA_CENTER: [number, number] = [9.082, 8.6753]

// National totals are INEC's published figures. Per-state polling-unit and
// ward numbers above are working estimates to be reconciled against the
// official INEC register when polling units are imported (see PLAN.md).
export const TOTALS = {
  states: STATES.length,
  lgas: STATES.reduce((n, s) => n + s.lgas.length, 0),
  wards: 8809,
  pollingUnits: 176846,
}

export function getState(name: string) {
  return STATES.find((s) => s.name === name)
}
