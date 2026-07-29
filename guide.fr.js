/* Miroir français du contenu de coaching (guide.js). Noms de jeu (Batomon,
 * dresseurs, trinkets, objets) volontairement conservés en ANGLAIS. */
(function () {
  const G = window.GUIDE;
  if (!G) return;
  G.FR = {
    DAYS: [
      { day: 1, title: 'Fondations — achète du tempo, pas des rêves',
        plan: [
          'Dépense tout. L’or qui dort au jour 1 est une défaite au jour 2 (pas d’intérêts de base ; seul Piggy Bank en paie).',
          'Meilleurs achats j1 : des Communs pas chers au texte auto-scalant — Bambudo (+35 Dmg/cast, permanent), la ligne Emperooze via Dribblet, Mosslug, Bumblebolt (starter Shock).',
          'Si ton dresseur donne une unité (Monster Ranger — 61,4% de WR réel), construis autour de sa fusion : une copie gratuite tous les 2 jours.',
          'Prends les graines d’évolution MAINTENANT : Dribblet/Scorchimp/Panbud ont besoin d’un gros stock pour évoluer (N3 = 9 copies avec la règle de fusion 3), donc chaque copie précoce compte — commence à les accumuler dès j4-6.',
        ],
        lineup: 'Ton seul vrai attaquant en haut-milieu (les couronnes visent cette case plus tard). Soigneur/utilitaire sur la rangée du bas.',
        items: 'Utilise tes usages d’objets sur les objets à 0$ (Cake, Feast, tickets). Ne termine jamais la journée avec des rerolls gratuits inutilisés.',
        warning: 'Ne saute PAS d’achat pour « économiser pour un Rare » — les défaites j1 coûtent des vies et du tempo.' },
      { day: 2, title: 'Paires — lance ta première fusion',
        plan: [
          'Priorité n°1 : accumule les copies de tes unités j1 — TROIS identiques font un niveau 2 (deux ne fusionnent pas), et un niveau 2 précoce gagne les combats sur les stats seules dès j3-4.',
          'Boards Bug : chaque Bug acheté nourrit Guardiant (+7 Dmg), Cinderfly et Shogapede (+10% vitesse). Bug Catcher (59,9% WR) rend le premier Bug de chaque manche GRATUIT.',
          'Runs Chef (57,9% WR) : les mono-types deviennent Feu — prends des corps à brûlure tôt (Magmite, ligne Scorchimp).',
          'Ne vends rien sauf banc plein — les copies sont du carburant de fusion.',
        ],
        lineup: 'Garde les attaquants là où ils connectent ; les textes « derrière/au-dessus » regardent la position — lis-les avant de verrouiller.',
        items: 'Green Stone sur un Commun en rab si la boutique est sèche. Fake Coin/Lucky Coin = valeur gratuite.',
        warning: 'Musician (55,4% WR) : garde EXACTEMENT un Électrik. Un deuxième coupe le +150% Shock.' },
      { day: 3, title: 'Première fenêtre de niveau 2',
        plan: [
          'Fusionne ton meilleur trio au niveau 2 — 3 copies du même niveau se combinent en UNE (deux copies ne fusionnent PAS). Les évolutions de niveau 3 (Dribblet→Emperooze, Scorchimp→Sunsage, Panbud→Bambudo) sautent une bande de puissance entière mais le N3 demande 9 copies (ou des objets de montée de niveau), donc c’est un engagement plus profond.',
          'Dès qu’une espèce est niveau 3, ses pré-évolutions disparaissent de ta boutique (0.7.4) — mais le N3 = neuf copies, donc engage-toi à fond sur cette espèce ou utilise des objets de montée de niveau (Upgrade Disc).',
          'Commence à t’engager sur un archétype : regarde ce que la boutique te tend (poison → package Chemist ; boucliers → mur Roche).',
          'Cadeau trinket ? Prends l’économie ou Treasure Map tôt : Treasure Map monte ton PROCHAIN cadeau d’un tier de rareté.',
        ],
        lineup: 'Les chaînes de triggers s’allument : Cicadence sous un Bug, Dryadell sous un Grass, Voltalith → retiré du jeu, ignore les vieux guides.',
        items: 'Basic Candy (30$) force le niveau 3 si la boutique refuse de coopérer.',
        warning: 'N’arrive pas au jour 4 avec 3 demi-paires — choisis deux lignes et finance-les.' },
      { day: 4, title: 'Décision de rang de boutique',
        plan: [
          'Soit tu montes le rang (Apex Bait 20$, trinket Market License, départ Rich Lady) pour pêcher des Rares/Super Rares — soit tu le DESCENDS exprès (Basic Bait 0$) pour finir tes fusions Commun/Peu commun.',
          'Descendre le rang est le play sous-coté si tu as encore besoin de copies pour une évolution ou un push niveau 4.',
          'Bons Rares : Ironcore (charge les Électrik), Formiqueen (aura de vitesse des Communs), Lignite (multiplicateur de brûlure), Aristobat (poison multicast).',
          'Purple Egg d’Egg Breeder éclot demain (5 jours) — garde une case libre.',
        ],
        lineup: 'La logique de profondeur se durcit : la colonne de DROITE est le front (côté ennemi) et prend les coups. Boucliers à droite, casters qui montent à GAUCHE (derrière).',
        items: 'Les tickets de rareté (Gray/Green/Blue) forcent une boutique entière d’une seule rareté — creuse pour tes copies exactes.',
        warning: 'Arrête d’acheter des unités uniques « parce qu’elles ont l’air fortes » — chaque achat hors fusion doit avoir un métier (économie, pièce de trigger, graine d’évolution).' },
      { day: 5, title: 'Assemblage du moteur',
        plan: [
          'Ton board doit nommer sa win condition aujourd’hui : rampe Brûlure / Poison quadratique / ampli Shock / forteresse Bouclier / chaîne Multicast / boule de neige Économie.',
          'Achète les ACTIVATEURS maintenant, les payoffs ensuite : Noxalith nourrit le poison au-dessus, Magmalith la brûlure (au-dessus), Boomagon la vitesse (allié à sa DROITE), Zephyrex le Multicast devant.',
          'Données trinkets réelles pour cette phase : Silver Watch, Warhorn, Meteorite très solides (onglet Trinkets, trié par WR réel).',
          'Swim Coach (56,5% WR) reçoit une unité Eau gratuite par jour — Torrantler transformera le flux en mitrailleuse.',
        ],
        lineup: 'Les payoffs d’adjacence (Aster, Noxnimbus, Formiqueen) veulent les cases centrales — maximum de voisins.',
        items: 'Coffee (5$) double les « On Battle Start » pour un combat — garde-le pour un badge risqué.',
        warning: 'Perdre exprès n’est jamais gratuit (vies), mais une défaite planifiée pendant l’assemblage bat la vente de ton moteur pour une victoire.' },
      { day: 6, title: 'Transition Rare → Super Rare',
        plan: [
          'Le rang de boutique doit faire apparaître les Super Rares. Cibles premium : Shelldra (auto-multicast), Coalem (buffé), Aegistruct (copie de bouclier), Prismagon (scaling arc-en-ciel), Wishwash (trinket gratuit).',
          'Les conversations niveau 4 commencent : la 4e copie de ton carry vaut souvent plus que n’importe quelle nouvelle unité (N4 = Multicast ou pics ~×8).',
          'VIP Pass retire Commun/Peu commun de ta boutique — prends-le seulement APRÈS tes fusions.',
          'Runs Mad Scientist : demain, toute l’équipe active devient des Légendaires N1 aléatoires — investis dans des CASES remplies, pas des niveaux.',
        ],
        lineup: 'Check Celestia : si l’ennemi joue des porteurs Ongoing (Gaiadrasil/Lignite/Fumungus), Celestia désactive leur rangée.',
        items: 'Recruiting Flyer (90$) = un Peu commun niveau 3 instantané ; plus fort quand il complète un package de type.',
        warning: 'Rythme championnat : vise un board stable de 5-6 unités avec 1-2 niveaux 3+ à la fin du jour 6.' },
      { day: 7, title: 'Fenêtre Légendaire / jour Mad Scientist',
        plan: [
          'Les Légendaires arrivent en boutique : Torrantler (moteur Eau), Gaiadrasil (miroir de dégâts), Galvanine (buffé), Stellagon (+2 Multicast aux sans-capacité), Draconarch (60$ — le rêve ×24 au N4).',
          'MAD SCIENTIST : la transformation tombe aujourd’hui — remplis les SIX cases AVANT.',
          'Tech Stellagon : les stat-sticks sans capacité (Joltail, Magmite, Velocect, Blazewing) se mettent à double-caster.',
          'Lootbox (30$) : Légendaire aléatoire — meilleure conversion or→puissance ce jour précis.',
        ],
        lineup: 'Draconarch veut des voisins « On Battle Start » (Emperooze, Coalem, Aegistruct) — il les re-déclenche à chaque cast.',
        items: 'Rare Candy (40$) : n’importe quel N1 → +1. Ultra Candy (60$) : pousse un N3 au N4 — garde-le pour ton vrai carry.',
        warning: 'Ne casse pas un moteur qui marche pour un Légendaire aléatoire — un noyau N3 synergique bat un Légendaire N1 esseulé.' },
      { day: 8, title: 'Push niveau 4',
        plan: [
          'Les pics N4 gagnent les championnats : Draconarch ×24 Multicast, Celestia 3120 dégâts, Aristobat poison ×8, Basilord recharge 1s.',
          'Check ligne Ignit : Ignit→Flarilisk→Basilord évolue SUR VICTOIRE — il lui faut des séries de wins ; si tu perds, ça cale.',
          'Les cadeaux trinkets doivent être des payoffs. WR réels : Excalibur 76,1%, Master Crown 74,9%, Ultra Duplicator 73,1%, Holy Grail 72,2%, Zenith Stone 69,4%.',
          'Note Zenith Stone : +80% sur TOUS les gains de stats — multiplie tes unités qui montent (Bambudo, Thorntail, Prismagon, Omnichrome).',
        ],
        lineup: 'Check couronnes : Power/Haste/Winged/Master Crown visent le HAUT-MILIEU. Ton carry y siège, point.',
        items: 'Shiny Berry (1$) : rend une unité SHINY (+~20% + capacité améliorée) ET rembourse un usage. Achat quasi obligatoire.',
        warning: 'Dresseur Gamer : le Mythique gratuit + 30$ tombent demain (j9) — ne vends pas les cases que tu voudras garder.' },
      { day: 9, title: 'Accès Mythique / puissance de clôture',
        plan: [
          'Les Mythiques passent par dresseurs, trinkets, événements — pas la boutique normale. Mystic Incense en force un dans ta prochaine boutique.',
          'Omnichrome (80$) vole 240%+ des stats de leur meilleure unité au N3 — il scale avec LEUR board, jamais un pick mort.',
          'Build objets Faebloom : les Mythical Items apparaissent en boutique ; les alliés adjacents gagnent +Dmg par objet Mythique utilisé (Shopkeeper turbo-charge le tout).',
          'Riglet dévore l’allié devant lui demain — nourris-le avec ce que tu veux voir Rigalord dupliquer.',
        ],
        lineup: 'Rigalord invoque ses copies sur la rangée du BAS — garde des cases basses libres le jour où il arrive.',
        items: 'Crimson Gift (70$) = trinket Mythique aléatoire. Magic Lasso (50$) copie le haut-milieu ennemi pour le prochain combat — scout, puis vole.',
        warning: 'Le championnat est à 10 badges — compte badges et vies ; un pivot gourmand au j9 jette des runs finies.' },
      { day: 10, title: 'Championnat / décision Extended',
        plan: [
          'Badge 10 = championnat. Gagne avec ton carry N3+ pour la Medal Batopedia ; avec un Shiny pour la Star.',
          'Mode Extended (0.7.2) : les runs continuent jusqu’au jour 40 — plafond de stats 999 999 999 (0.7.4). Les scalers quadratiques (Poison, Omnichrome, rampes Bambudo/Thorntail) règnent sur le long terme.',
          'Boutiques post-10 : Crimson Ticket (50$) reroll une boutique 100% Mythique ; Research Notes inonde de Légendaires.',
          'Stack de Duplicators (Ultra Duplicator 73,1% WR) + Treasure Map transforme chaque cadeau en multiples trinkets top-tier.',
        ],
        lineup: 'Check final — carry couronné haut-milieu, batteries « On Battle Start » adjacentes à Draconarch, unités Ongoing loin des rangées Celestia ennemies.',
        items: 'Dépense jusqu’à zéro avant le combat final. L’or non dépensé ne gagne rien.',
        warning: 'Deux Légendaires shiny N4 = board « game over » connu — si tu vois les pièces, mise tout.' },
    ],
    MECHANICS: [
      ['Board', '2 rangées × 3 colonnes, vue de côté : les ennemis sont à DROITE. « Devant » = voisin de droite (même rangée), « derrière » = voisin de GAUCHE, « au-dessus » = case de la rangée du haut, même colonne. Les couronnes visent le HAUT-MILIEU ; Nana Berry le bas-droite ; Speed Crest la colonne de droite (front).'],
      ['Niveaux', 'Fusion 3 pour 1 : 3 copies = N2, 9 = N3 (les évolutions se déclenchent au N3). Deux copies ne fusionnent PAS — elles restent des corps séparés. Le N4 vient uniquement des objets/bonbons de montée de niveau (Upgrade Disc, etc.), jamais de la fusion. Stats N1→N3 ×1/×2/×3 ; le N4 ajoute du Multicast ou des pics ~×8.'],
      ['Règle boutique', 'Une espèce au N3 → ses pré-évolutions n’apparaissent plus (0.7.4). Le N3 demande 9 copies (règle de fusion 3), donc sécurise les copies voulues avant de t’engager aussi profondément.'],
      ['Shinies', '~+20% de stats, souvent une capacité en plus/améliorée, sprite dédié. Sources : rolls rares en boutique, dresseuse Lucky Girl, objet Shiny Berry, trinket Rainbow Pearl. 80 espèces sur 88 en ont un.'],
      ['Brûlure', 'Tick = stacks toutes les 0,5s, perd 1 stack par tick. Frontloadé, décroît.'],
      ['Poison', 'Tick = stacks chaque seconde, ne décroît JAMAIS. Quadratique avec la durée du combat.'],
      ['Shock', 'Ampli permanent : les coups directs sur la cible gagnent +stacks. Dégâts directs uniquement.'],
      ['Bouclier vs statuts', 'Les dégâts de statut sont réduits de 25% contre les boucliers ; le Poison ne traverse plus le bouclier (0.6.0).'],
      ['Ordre du même tick', 'Bouclier → Dégâts → Statuts → Soin (0.7.3). Le soin résout en dernier — il peut sauver d’un létal du même tick.'],
      ['Vitesse de recharge', '+100% = cast deux fois plus souvent. Remplace toute réduction plate (maj 11 juin). Plancher 0,1s ; l’UI marque le seuil de 1s.'],
      ['Multicast', 'Cast N fois d’affilée, à 0,1s d’intervalle. LA mécanique du niveau 4.'],
      ['Objets quotidiens', 'Usages d’objets limités par jour. Berroon (+1/début de combat), Tote Bag (+2), Lucky Coin/Nana Berry/Shiny Berry (remboursent 1) étendent la limite.'],
      ['Plafond de stats', '999 999 999 (0.7.4). Le mode Extended va jusqu’au jour 40 (0.7.2).'],
      ['Durée de run', '10 badges = championnat. Stickers Batopedia : Trophy (victoire), Medal (victoire à N3+), Star (victoire avec un Shiny).'],
    ],
    DATA_NOTE: 'Les pourcentages dresseurs & trinkets sont des données Master RÉELLES scrapées de batodex.com (pick rate par run, win rate par manche). Les scores des monstres sont un modèle heuristique transparent (maths DPS/statuts + scaling + synergie + ajustements patch) — Batodex ne publie pas de win rates par monstre. Jeu de données patch 0.8.4.',
    EXPLAINER: `
    <details class="card" style="margin-bottom:14px;font-size:12.5px">
      <summary style="cursor:pointer;font-weight:700">📖 Comment lire ces chiffres (WR, pick rate, lift en pp, confiance)</summary>
      <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;color:#c6cbdc">
        <div><b style="color:var(--accent)">Win rate par manche (WR)</b> — sur toutes les manches où l’unité/le combo était sur le board, le % gagné. Compté <b>une fois par manche</b> (2 copies ne comptent pas double ; les copies ont leur propre colonne).</div>
        <div><b style="color:var(--accent)">Pick rate</b> — % des runs classées (pas des manches) qui l’ont alignée au moins une fois.</div>
        <div><b style="color:var(--accent)">Lift (pp = points de pourcentage)</b> — l’excédent de WR au-dessus d’une base honnête :<br>
          · <b>Combos de monstres</b> : WR du combo − moyenne des WR individuels des membres. Positif = vraie synergie, pas juste « des bonnes unités empilées ».<br>
          · <b>Combos dresseur</b> : WR avec ce dresseur − WR du même combo sous n’importe quel dresseur → l’apport du dresseur.<br>
          · <b>Trinket + monstres</b> : WR en portant le trinket − WR du board en général → l’apport du trinket.<br>
          · <b>Sets de trinkets</b> : WR portés ensemble − moyenne de chacun porté seul.<br>
          Exemple : 84,9% de WR avec +13,8pp de lift = le combo gagne ~14 points de plus que ce que ses pièces isolées annoncent.</div>
        <div><b style="color:var(--accent)">Confiance</b> — ● ≥300 manches (fiable) · ◐ 100–299 (signal solide) · ○ &lt;100 (indice seulement). Survole un WR pour son intervalle de confiance à 95%. Monte les filtres « manches min » pour ne garder que le béton.</div>
        <div><b style="color:var(--accent)">Couleurs de WR (échelle loot)</b> — <span class="wr-low">&lt;50% rouge</span> · <span class="wr-ok">50–55% vert</span> · <span class="wr-good">55–60% bleu</span> · <span class="wr-great">60–65% violet</span> · <span class="wr-elite">65%+ arc-en-ciel</span>. Bandes absolues ; dans cet échantillon de gagnants la base est ~66,5%, donc bleu/violet = « sous la moyenne du top » — l’arc-en-ciel est le minimum d’une vraie compo.</div>
        <div><b style="color:var(--red)">Biais d’échantillon — à lire avant de comparer</b> — ces données = <b>~40 meilleurs joueurs Master uniquement</b>. Ils gagnent ~66,5% des manches : compare les lignes <i>entre elles</i>, jamais à 50%. Les évolueurs par victoire (Ignit → Flarilisk → Basilord) ont une inflation mécanique en plus : ils évoluent <i>parce que</i> le joueur gagne.</div>
      </div>
    </details>`,
  };

  // FR mirrors for build prose (names/cores stay; text swapped at render time)
  G.FR.BUILDS = {
    burn: { how: 'Le Chef convertit les mono-types en Feu (+2 Brûlure chacun). Magmalith pompe de la brûlure permanente vers l’allié au-dessus, Lignite transforme chaque stack de brûlure en +15 dégâts plats. Scorchimp→Sunsage donne de la vitesse à toute la ligne Feu. En fin de partie, la chaîne de victoire d’Ignit devient Basilord : 450 Brûlure à 1s de recharge au N4.', dayplan: 'J1-2 copies de Scorchimp + corps Magmite · J3 Sunsage en ligne · J4-5 colonne Magmalith/Lignite · J6+ Ignit dès que tu enchaînes les wins · J8 Ultra Candy sur le carry.', counters: 'La brûlure décroît — les gros boards Soin/Bouclier (Aster, murs Coalem) épuisent une brûlure mal jouée. Garde Lignite comme assurance dégâts plats.' },
    poison: { how: 'Le poison ne décroît jamais et tick chaque seconde — dégâts quadratiques avec la durée. Chemist ajoute +1 Poison à TOUS les Toxic par montée de niveau (ça compose). Noxalith nourrit +3 Poison permanent au-dessus, Thorntail convertit chaque application alliée en +6 dégâts permanents, Aristobat N4 = 16 poison ×8 multicast, Cobrex se charge à chaque tick. Fumungus tape en bonus du poison ennemi.', dayplan: 'J1-2 corps Venopuff/Spinarai · J3-4 monte N’IMPORTE quoi (les stacks Chemist) · J5 colonne Noxalith + Thorntail · J7 Cobrex · J8+ les combats durent, tu gagnes aux maths.', counters: 'Runerock/Sirenade purgent les stacks ; les boards burst finissent avant que la courbe paie. Rappel (0.7.3) : le bouclier absorbe les statuts à 75% — départs lents contre les murs Roche.' },
    shock: { how: 'Musician : EXACTEMENT un Électrik = +150% Shock. Le Shock amplifie en permanence chaque coup direct sur la cible. Un seul carry Électrik (Galvanine en fin de course : +50% vitesse et +2 Shock par cast, auto-boule de neige) soutenu par des frappeurs non-Électrik. Ironcore le charge (Steel, légal), Clawnetic se charge sur chaque application de Shock, Pylong double le Shock de l’allié derrière lui — mais Pylong est Électrik : uniquement si tu abandonnes le bonus exprès.', dayplan: 'J1 Bumblebolt/Joltail (choisis UNE ligne) · J3 revends l’Électrik en trop avant de casser le bonus · J5 Ironcore · J7 Galvanine + stack complet de couronnes haut-milieu.', counters: 'Le Shock ne booste que les dégâts DIRECTS — les boards 100% statuts s’en fichent. Un Knockout sur ton carry unique est catastrophique : tech Cherubble Protect.' },
    wall: { how: 'Empile du Bouclier jusqu’à l’indestructible, puis laisse Stalagrove convertir 15% de chaque bouclier reçu en dégâts. Coalem (buffé 0.8.0 : 450/900/1350) se déclenche tout seul au début du combat ; Aegistruct copie les boucliers adjacents ; Geminiss multiplie la rangée. Les statuts sont réduits de 25% dans le bouclier et le Poison ne le traverse plus (0.6.0) — les murs sont réels.', dayplan: 'J1-2 paires de Pebbler · J3 Cherubble Protect · J5 Stalagrove AVANT les gros boucliers · J6-7 mur Coalem/Aegistruct · Runerock répond aux boards poison.', counters: 'Anti-soin pur ou coups massifs uniques (Celestia N4, trains Draconarch). Lent à conclure — associe un vrai carry.' },
    multicast: { how: 'Draconarch ré-active les « On Battle Start » des alliés adjacents À CHAQUE cast, et au N4 il cast ×24. Entoure-le de batteries de début de combat (Emperooze, Coalem, effets Warhorn, Omnichrome !). Boomagon nourrit de la vitesse permanente l’allié à sa DROITE (flèche in-game) — gare Boomagon juste à GAUCHE de Draconarch, Dracana/les chargeurs accélèrent la boucle, Saberhorn/Zephyrex distribuent du +1 Multicast, Stellagon donne +2 aux stat-sticks. Repeater Charm + Coffee doublent toutes les ouvertures.', dayplan: 'J1-3 Communs tempo (la ligne Emperooze sert de batterie) · J5 rails Boomagon/Dracana · J7 Draconarch (60$) · J8-9 couronnes + Repeater Charm · J10 le ×24 fait brrr.', counters: 'Snipes Knockout sur Draconarch ; Celestia qui coupe tes supports Ongoing. Garde Cherubble Protect ou une rangée leurre.' },
    econ: { how: 'Gildshell gagne de la Sell Value permanente à chaque combat ; la version SHINY tape en bonus 0,5× sa Sell Value — ton compte en banque devient une arme. Gold Powder (+20/jour) le nourrit direct. Plunderbird imprime de l’or par cast, Berroon monte ta limite d’objets, Wishwash paie un trinket par combat. Convertis le trésor en bonbons et couronnes.', dayplan: 'J1-2 paires de Gildshell (PRIE pour le shiny ; Shiny Berry sinon) · J3-4 Piggy Bank + trinkets d’or · J6 tu sur-achètes tout le monde · J8+ Goldora frappe des trinkets Légendaires par allié Légendaire.', counters: 'Le tempo brut te tue vers j4-6 — garde une vraie ligne de front. Le build, c’est la boutique, pas le board.' },
    water: { how: 'Swim Coach (56,5% WR réel) te donne une unité Eau gratuite chaque jour. Torrantler (buffé 0.8.0) déclenche TOUS les alliés Eau adjacents quand il cast — au centre, chaque cast devient une salve. Aster pompe du Soin permanent, Emperooze (via Dribblet) est une batterie gratuite, Shelldra s’auto-multicast toutes les 4 secondes et adore être déclenché tôt.', dayplan: 'J1 paires de Dribblet · J3 Emperooze · J4-5 Aster + fusions Eau quotidiennes gratuites · J7 Torrantler au centre · J9 un 2e Torrantler ne compte PAS comme adjacent (il s’exclut) — diversifie.', counters: 'La pression brûlure va plus vite que le sustain early ; les rangées Celestia coupent les supports Ongoing. La purge Sirenade couvre les matchups statuts.' },
    items: { how: 'Shopkeeper stocke les objets un tier au-dessus avec 15% de remise. Berroon monte la limite quotidienne à chaque début de combat ; Tote Bag/Lucky Coin/Nana Berry/Shiny Berry REMBOURSENT des usages ; Echo Bell double chaque objet à 0$. Craghorn gagne +20 Dégâts ET Bouclier par objet utilisé. Faebloom débloque les Mythical Items en boutique et paie +10% dégâts par objet Mythique aux adjacents — la boucle s’auto-alimente.', dayplan: 'J1-3 Berroon + Craghorn et chaque objet 0$ · J4 Echo Bell en cadeau prioritaire · J6+ limite 5-6 objets/jour · J9 Faebloom convertit l’habitude en win condition.', counters: 'Demande des jours de setup — les boards agressifs punissent. 0.8.3 a limité Echo Bell aux objets 0$ : budgète en conséquence.' },
    bugchain: { how: 'LE moteur mesuré du top classement : le trio Cicadence+Gildshell+Guardiant tourne à 86-89% de WR réel. Chaque Bug acheté nourrit Guardiant (+7 Dmg) et accélère Cinderfly/Shogapede (+10% vitesse). Cicadence re-déclenche le Bug AU-DESSUS de lui à chaque cast — mets-y ton Bug le plus gras. Formiqueen donne +33% de vitesse aux Communs adjacents, Brawlmantis convertit les victoires en dégâts permanents. Bug Catcher rend le premier Bug de chaque manche GRATUIT — le moteur se paie tout seul.', dayplan: 'J1 Guardiant + des Bugs (un gratuit par manche !) · J2-3 Gildshell + Cicadence dessous · J4 vitesse Shogapede/Cinderfly · J5+ Formiqueen centre-bas · chaque achat compose.', counters: 'Les Communs plafonnent — convertis l’avance en closer Légendaire vers j8, sinon les rangées Celestia coupent tes triggers.' },
    toxweb: { how: 'Puffloon apparaît dans 24% de TOUTES les runs du top (69,5% WR, souvent en double — 1,9 copie en moyenne). Il se déclenche quand un allié Toxic adjacent se déclenche : enchaîne Noxnimbus (+2 Poison par cast aux Toxic adjacents) et chaque Puffloon en une toile où un cast cascade dans tout le cluster. Chemist compose +1 Poison sur TOUS les Toxic par montée de niveau. Aristobat transforme le poison stacké en lance à incendie ; Fumungus tape en bonus du poison ennemi.', dayplan: 'J1-2 corps Venopuff/Spinarai · J3 PREMIER Puffloon (achète chaque copie) · J4-5 toile Noxnimbus · J6 deuxième cluster Puffloon · J7+ payoff Cobrex/Fumungus.', counters: 'Purges Runerock/Sirenade ; le burst finit le combat avant que le quadratique paie. Garde la toile ADJACENTE — un Puffloon isolé est un Puffloon mort.' },
    knockout: { how: 'Les grenades (Stingarde/Galvanade/Infernade) déposent un énorme coup puis se Knockout — burst d’ouverture pur. Reapra (70,4% WR réel) snipe l’ennemi EN FACE à chaque cast : gare-le en face de leur carry. Dirgefin Knockout TOUS les Communs des deux côtés — dévastateur contre les swarms pendant que ton board joue des Rares. Le Protect de Cherubble garde ton carry en vie.', dayplan: 'J1-2 grenades pour des wins tempo · J4 revends-les quand ça faiblit, Dirgefin entre · J6 Reapra en face de leur carry (glisse-le sur la bonne rangée !) · J8 Cherubble protège le closer.', counters: 'Le Knockout ne fait rien aux boards qui te sur-statent — c’est du contrôle, pas du scaling. Pivote l’avance vers un closer A-tier vers j8.' },
    devour: { how: 'Riglet dévore l’allié juste DEVANT lui au début du jour suivant et devient Rigalord — qui invoque ensuite des copies exactes de l’unité dévorée sur la rangée du bas à chaque combat. Nourris-le avec ton unité la plus stackée : un Bambudo qui banque +35 Dmg/cast depuis six jours devient une armée de Bambudos stackés. Zenith Stone (+80% sur tous les gains) rend l’engraissement obscène. Aerophim donne ensuite du +Multicast à la rangée d’invocations.', dayplan: 'J1-4 engraisse Bambudo (stacks permanents) · J7-8 obtiens Riglet · place l’unité engraissée DEVANT Riglet la veille · J9+ Rigalord imprime des monstres. Laisse les cases du bas LIBRES.', counters: 'Téléphoné et lent — un mauvais dévorage (mauvaise unité devant !) ruine la run. Celestia coupe les triggers de la rangée des invocations.' },
    omni: { how: 'Omnichrome vole 80/160/240% (N4 : 2400%) des stats de la meilleure unité ennemie au début du combat, en permanence — il scale avec LEUR board, donc ne périme jamais. Entoure-le de batteries On Battle Start (Emperooze, Coalem) et laisse Draconarch re-déclencher le vol à chaque cast (×24 au N4 = tu deviens 24 copies de leur carry). Prismagon banque +10 Dmg par type unique pendant ce temps. Celestia coupe leurs réponses Ongoing.', dayplan: 'J1-5 n’importe quel core tempo solide (ligne Emperooze idéale) · J7 Mystic Incense via les cadeaux Treasure Hunter · J9 Omnichrome entre · J10+ Draconarch transforme un vol en vingt-quatre.', counters: 'Avant j9 tu es un board normal — ne sacrifie pas le tempo pour le rêve. Les miroirs (leur Omnichrome) deviennent bizarres.' },
  };

  // FR blurbs for item tiers (S/A/B/C), aligned by item id
  G.FR.ITEM_TIERS = {
    shiny_berry: 'Rend une unité SHINY (+~20% + souvent capacité améliorée) et rembourse un usage. Gratuit. Achat à vue.',
    ultra_candy: 'N3 → N4 à la demande. Les pics N4 (×24 Draconarch, 3120 Celestia) finissent les parties.',
    rare_candy: 'N’importe quel N1 monte, sans limite de rareté. Du tempo en bouteille.',
    magic_mirror: 'Copie simple d’un N3 aléatoire (120$) — une case de produit fini instantanée.',
    coffee: 'Double tous les « On Battle Start » du prochain combat. 5$ pour voler un combat de badge.',
    crimson_gift: 'Trinket Mythique aléatoire 70$ — la table de WR réels dit que les Mythiques portent (Excalibur 76,1%).',
    golden_gift: 'Trinket Légendaire aléatoire 50$.',
    lootbox: 'Monstre Légendaire aléatoire 30$ — au mieux à partir du jour 7.',
    recruiting_flyer: 'Peu commun N3 instantané — complète les packages de type à la demande.',
    tote_bag: '+2 usages d’objets aujourd’hui — la carte moteur des builds objets.',
    apex_bait: 'Rang de boutique +1 pour 20$ — outil de timing pour la fenêtre Super Rare du j6.',
    basic_candy: 'Montée aléatoire d’un N1 Commun/Peu commun, 30$.',
    voucher: 'Monstre aléatoire de la boutique actuelle 5$ — pari à carburant de fusion.',
    golden_ticket: 'Reroll 100% Légendaire — gratuit, j7+.',
    crimson_ticket: 'Reroll 100% Mythique 50$ — pêche d’endgame.',
    blue_ticket: 'Reroll 100% Rare — creuse évolutions/fusions.',
    gold_powder: '+20 Sell Value par jour — carburant du Gildshell shiny, sinon passe.',
    coupon: 'Boutique −5$ par monstre. Argent gratuit les jours d’achat.',
    black_feather: '+1 Multicast, 30$ — premium sur les boards mono-carry.',
    feast: 'Équipe +5 dégâts, gratuit.',
    lucky_coin: '+3$ ET rembourse l’usage. Clique toujours.',
    nana_berry: 'Bas-droite +5% vitesse, rembourse l’usage. Clique toujours.',
    cake: 'Deux unités aléatoires +5 dégâts. Correct, gratuit.',
    fake_coin: 'Reroll gratuit. Correct.',
    gray_chip: 'Pari « victoire au prochain combat », +5$.',
    green_stone: 'Commun → Peu commun aléatoire.',
    battery_pack: 'Électrik +1 Shock — mono-shock uniquement.',
    hot_pepper: 'Feu +1 Brûlure — boards brûlure uniquement.',
    black_sludge: 'Toxic +1 Poison — boards poison uniquement.',
    mystic_pearl: 'Eau +10 Soin.',
    shiny_pebble: 'Roche +20 Bouclier.',
    basic_bait: 'DESCEND le rang de boutique — tech de niche pour creuser les fusions, gratuit.',
    red_coin: '+20$ contre une VIE. Désespoir uniquement.',
    focus_pill: 'Sans-capacité +15% vitesse (nerf 0.8.0) — boards Stellagon.',
    dowsing_rod: 'Choisis un trinket Commun 15$ — passe en général.',

  };
})();