/* ==========================================================================
   masolutionchaleur.fr — tunnel de captation de leads
   Vanilla JS, sans dépendance.
   ========================================================================== */

(function () {
    'use strict';

    var TOTAL_ETAPES = 6;
    var DELAI_AUTO = 350;          // temps de confirmation visuelle avant avance
    var CLE_STOCKAGE = 'msc-lead';

    var tunnel = document.getElementById('tunnel');
    var form = document.getElementById('formLead');
    if (!tunnel || !form) return;

    var barre = document.getElementById('barreProgression');
    var compteur = document.getElementById('etapeCourante');
    var btnRetour = document.getElementById('btnRetour');
    var btnSuivant = document.getElementById('btnSuivant');
    var blocCreneau = document.getElementById('blocCreneau');
    var blocConsentRappel = document.getElementById('blocConsentementRappel');
    var listeJours = document.getElementById('listeJours');
    var aideCoordonnees = document.getElementById('aideCoordonnees');
    var etapes = form.querySelectorAll('.etape');

    var etapeActive = 1;
    var dernierFocus = null;
    var minuteurAuto = null;

    /* ----------------------------------------------------------------------
       Point de sortie unique.
       V1 : aucun backend — le payload est journalisé puis l'utilisateur est
       redirigé. Pour brancher un endpoint réel (webhook, CRM, Formspree),
       seule cette fonction est à modifier : elle doit renvoyer une promesse.
       ---------------------------------------------------------------------- */
    // Clé publique Web3Forms. Conçue pour être exposée côté client : elle ne
    // permet que d'envoyer vers VOTRE adresse email, jamais de lire quoi que ce
    // soit. À obtenir sur https://web3forms.com (gratuit, 250 envois/mois).
    var CLE_FORMULAIRE = 'VOTRE_CLE_WEB3FORMS';

    function submitLead(payload) {
        // Tant que la clé n'est pas renseignée, on journalise sans bloquer le
        // parcours — utile en développement local.
        if (!CLE_FORMULAIRE || CLE_FORMULAIRE === 'VOTRE_CLE_WEB3FORMS') {
            console.warn('[LEAD NON ENVOYÉ] Clé Web3Forms absente :', payload);
            return Promise.resolve();
        }

        var estRappelLead = payload.modeContact === 'rappel';

        // Corps lisible dans la boîte mail, sans avoir à déchiffrer du JSON
        var lignes = [
            'NOUVELLE DEMANDE — ' + payload.projet,
            '',
            '── CONTACT ──',
            'Nom       : ' + payload.prenom + ' ' + payload.nom,
            'Téléphone : ' + payload.telephone,
            'Email     : ' + payload.email,
            'Code postal : ' + payload.codePostal,
            '',
            '── PROJET ──',
            'Équipement : ' + payload.projet,
            'Logement   : ' + payload.typeLogement + ', ' + payload.surface + ' m²',
            'Statut     : ' + payload.statut,
            'Chauffage actuel : ' + payload.energie,
            'Délai      : ' + payload.delai,
            '',
            '── CONTACT SOUHAITÉ ──',
            'Mode : ' + (estRappelLead ? 'RAPPEL TÉLÉPHONIQUE' : 'Devis par email'),
        ];

        if (estRappelLead) {
            lignes.push('Créneau : ' + payload.jourRappel + ' — ' + payload.creneauRappel);
        }

        lignes.push('Nombre de pros souhaité : ' + payload.nombrePros);
        lignes.push('');
        lignes.push('── CONSENTEMENTS (preuve RGPD) ──');
        lignes.push('Transmission des données : OUI le ' + payload.dateConsentement);
        if (estRappelLead) {
            lignes.push('Démarchage téléphonique  : OUI le ' + payload.dateConsentementRappel);
        }

        var corps = new FormData();
        corps.append('access_key', CLE_FORMULAIRE);
        corps.append('subject', 'Lead ' + payload.projet + ' — ' + payload.codePostal +
            (estRappelLead ? ' (RAPPEL ' + payload.creneauRappel + ')' : ''));
        corps.append('from_name', 'Ma Solution Chaleur');
        corps.append('message', lignes.join('\n'));
        // Répondre à l'email ouvre directement une réponse au prospect
        corps.append('email', payload.email);
        // Copie brute : sert d'archive exploitable si vous passez à un CRM
        corps.append('donnees_brutes', JSON.stringify(payload));

        return fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: corps
        }).then(function (r) {
            if (!r.ok) throw new Error('Envoi impossible (HTTP ' + r.status + ')');
            return r.json();
        }).then(function (data) {
            if (!data.success) throw new Error(data.message || 'Envoi refusé');
        });
    }

    /* ----------------------------------------------------------------------
       Accès aux champs
       ---------------------------------------------------------------------- */

    // elements.namedItem plutôt que l'accès nommé direct (form.champ), qui
    // n'est pas supporté par tous les environnements.
    function champ(nom) {
        return form.elements.namedItem(nom);
    }

    function valeur(nom) {
        var el = champ(nom);
        if (!el) return '';
        // Un groupe de radios renvoie une RadioNodeList, pas un élément
        if (el instanceof RadioNodeList || (el.length && !el.tagName)) {
            var coche = form.querySelector('[name="' + nom + '"]:checked');
            return coche ? coche.value : '';
        }
        return el.value;
    }

    function valeurRadio(nom) {
        var coche = form.querySelector('[name="' + nom + '"]:checked');
        return coche ? coche.value : '';
    }

    function estRappel() {
        return valeurRadio('modeContact') === 'rappel';
    }

    /* ----------------------------------------------------------------------
       Validation
       ---------------------------------------------------------------------- */

    var REGEX = {
        email: /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i,
        // Numéros français : 10 chiffres commençant par 0, ou format +33
        telephone: /^(?:(?:\+|00)33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}$/,
        codePostal: /^\d{5}$/
    };

    function afficherErreur(nom, visible) {
        var msg = form.querySelector('[data-erreur="' + nom + '"]');
        if (msg) msg.classList.toggle('visible', visible);

        var el = form.querySelector('[name="' + nom + '"]');
        if (el && el.type !== 'radio' && el.type !== 'checkbox') {
            el.classList.toggle('invalide', visible);
            el.setAttribute('aria-invalid', visible ? 'true' : 'false');
        }
    }

    function validerEtape(numero) {
        var erreurs = [];

        if (numero === 1) {
            if (!valeurRadio('projet')) erreurs.push('projet');
        }

        if (numero === 2) {
            if (!valeur('typeLogement')) erreurs.push('typeLogement');

            var brut = valeur('surface');
            var surface = parseInt(brut, 10);
            if (!brut || isNaN(surface) || surface < 5 || surface > 2000) {
                erreurs.push('surface');
            }

            if (!valeur('statut')) erreurs.push('statut');
            if (!valeur('energie')) erreurs.push('energie');
        }

        if (numero === 3) {
            if (!valeurRadio('delai')) erreurs.push('delai');
        }

        if (numero === 4) {
            if (!valeurRadio('modeContact')) {
                erreurs.push('modeContact');
            } else if (estRappel()) {
                // Jour et créneau exigés uniquement sur la branche rappel
                if (!valeurRadio('jourRappel')) erreurs.push('jourRappel');
                if (!valeurRadio('creneauRappel')) erreurs.push('creneauRappel');
            }

            // Garde-fou : le nombre est pré-coché en HTML, mais on vérifie au
            // cas où le markup évoluerait.
            if (!valeurRadio('nombrePros')) erreurs.push('nombrePros');
        }

        if (numero === 5) {
            if (!valeur('prenom').trim()) erreurs.push('prenom');
            if (!valeur('nom').trim()) erreurs.push('nom');
            if (!REGEX.codePostal.test(valeur('codePostal').trim())) erreurs.push('codePostal');
            if (!REGEX.email.test(valeur('email').trim())) erreurs.push('email');
            if (!REGEX.telephone.test(valeur('telephone').trim())) erreurs.push('telephone');
        }

        if (numero === 6) {
            var accord = champ('consentement');
            if (!accord || !accord.checked) erreurs.push('consentement');

            // Le démarchage téléphonique exige un consentement distinct
            if (estRappel()) {
                var accordTel = champ('consentementRappel');
                if (!accordTel || !accordTel.checked) erreurs.push('consentementRappel');
            }
        }

        return erreurs;
    }

    function nettoyerErreurs(numero) {
        var etape = form.querySelector('.etape[data-etape="' + numero + '"]');
        if (!etape) return;
        etape.querySelectorAll('.erreur-msg').forEach(function (msg) {
            msg.classList.remove('visible');
        });
        etape.querySelectorAll('.invalide').forEach(function (el) {
            el.classList.remove('invalide');
            el.setAttribute('aria-invalid', 'false');
        });
    }

    /* ----------------------------------------------------------------------
       Créneaux de rappel — 5 prochains jours ouvrés
       ---------------------------------------------------------------------- */

    var JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    var MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

    function genererJours() {
        if (!listeJours) return;

        var maintenant = new Date();
        var curseur = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());

        // Passé 18h, le jour même n'est plus proposable
        if (maintenant.getHours() >= 18) {
            curseur.setDate(curseur.getDate() + 1);
        }

        var html = '';
        var trouves = 0;
        var garde = 0;

        while (trouves < 5 && garde < 20) {
            var jour = curseur.getDay();
            if (jour !== 0 && jour !== 6) {
                var id = 'j-' + trouves;
                var libelle = JOURS[jour] + ' ' + curseur.getDate();
                var complet = JOURS[jour] + ' ' + curseur.getDate() + ' ' + MOIS[curseur.getMonth()];
                var iso = curseur.getFullYear() + '-' +
                    String(curseur.getMonth() + 1).padStart(2, '0') + '-' +
                    String(curseur.getDate()).padStart(2, '0');

                html += '<div>' +
                    '<input type="radio" name="jourRappel" id="' + id + '" value="' + complet +
                    '" data-iso="' + iso + '" class="sr-only-focusable">' +
                    '<label for="' + id + '" class="choix-ligne !bg-white !justify-center !px-2 !py-3">' +
                    libelle + '</label>' +
                    '</div>';
                trouves++;
            }
            curseur.setDate(curseur.getDate() + 1);
            garde++;
        }

        listeJours.innerHTML = html;
    }

    // Affiche ou masque le sélecteur de créneau selon le mode retenu
    function majAffichageCreneau() {
        var rappel = estRappel();

        if (blocCreneau) {
            blocCreneau.classList.toggle('hidden', !rappel);
            if (rappel) blocCreneau.classList.add('animate-apparition');
        }

        if (blocConsentRappel) {
            blocConsentRappel.classList.toggle('hidden', !rappel);
        }

        if (aideCoordonnees) {
            aideCoordonnees.textContent = rappel
                ? 'Pour que le professionnel puisse vous rappeler au créneau choisi.'
                : 'Pour que les professionnels puissent vous transmettre leurs devis.';
        }

        // Le libellé du nombre de pros dépend du mode retenu
        var libelleNb = document.getElementById('libelleNombrePros');
        if (libelleNb && valeurRadio('modeContact')) {
            libelleNb.textContent = rappel
                ? 'Combien de professionnels peuvent vous rappeler ?'
                : 'Combien de devis souhaitez-vous recevoir ?';
        }

        // Sur la branche email, on purge les choix de créneau et leurs erreurs
        if (!rappel) {
            form.querySelectorAll('[name="jourRappel"], [name="creneauRappel"]').forEach(function (r) {
                r.checked = false;
            });
            afficherErreur('jourRappel', false);
            afficherErreur('creneauRappel', false);
            afficherErreur('consentementRappel', false);
        }
    }

    /* ----------------------------------------------------------------------
       Navigation entre étapes
       ---------------------------------------------------------------------- */

    // Récapitulatif affiché à la dernière étape : rassure avant l'engagement
    function majRecap() {
        var liste = document.getElementById('recap');
        if (!liste) return;

        var lignes = [];
        var projet = valeurRadio('projet');
        var nb = valeurRadio('nombrePros');

        if (projet) lignes.push(projet);
        if (valeur('codePostal')) lignes.push('Code postal ' + valeur('codePostal').trim());

        if (estRappel()) {
            var j = valeurRadio('jourRappel');
            var c = valeurRadio('creneauRappel');
            if (j && c) lignes.push('Rappel ' + j.toLowerCase() + ', ' + c.toLowerCase());
        } else if (valeurRadio('modeContact')) {
            lignes.push('Devis par email sous 24 à 48 h');
        }

        if (nb) {
            lignes.push('Par ' + nb + ' professionnel' + (nb > 1 ? 's' : '') + ' maximum');
        }

        liste.innerHTML = lignes.map(function (l) {
            return '<li class="flex gap-2"><span class="text-vertc">✓</span><span>' + l + '</span></li>';
        }).join('');
    }

    function afficherEtape(numero) {
        etapeActive = numero;
        clearTimeout(minuteurAuto);
        if (numero === TOTAL_ETAPES) majRecap();

        etapes.forEach(function (etape) {
            var actif = parseInt(etape.dataset.etape, 10) === numero;
            etape.classList.toggle('hidden', !actif);
            etape.classList.toggle('active', actif);
            if (actif) etape.classList.add('animate-apparition');
        });

        barre.style.width = (numero / TOTAL_ETAPES) * 100 + '%';
        compteur.textContent = numero;

        btnRetour.hidden = numero === 1;
        btnSuivant.textContent = numero === TOTAL_ETAPES ? 'Recevoir mes devis' : 'Continuer';

        var titre = form.querySelector('.etape:not(.hidden) h3');
        if (titre) {
            titre.setAttribute('tabindex', '-1');
            titre.focus();
        }

        sauvegarder();
    }

    function etapeSuivante() {
        var erreurs = validerEtape(etapeActive);

        nettoyerErreurs(etapeActive);
        erreurs.forEach(function (nom) {
            afficherErreur(nom, true);
        });

        if (erreurs.length) {
            var premier = form.querySelector('.etape:not(.hidden) [name="' + erreurs[0] + '"]');
            if (premier) premier.focus();
            return;
        }

        if (etapeActive < TOTAL_ETAPES) {
            afficherEtape(etapeActive + 1);
        } else {
            envoyer();
        }
    }

    /* ----------------------------------------------------------------------
       Avance automatique sur les étapes de choix pur
       ---------------------------------------------------------------------- */

    function planifierAvance() {
        clearTimeout(minuteurAuto);
        minuteurAuto = setTimeout(function () {
            if (!validerEtape(etapeActive).length) etapeSuivante();
        }, DELAI_AUTO);
    }

    /* ----------------------------------------------------------------------
       Persistance — un tunnel fermé par erreur ne perd pas les réponses
       ---------------------------------------------------------------------- */

    var CHAMPS_MEMO = ['typeLogement', 'surface', 'statut', 'energie',
        'prenom', 'nom', 'codePostal', 'email', 'telephone'];

    function sauvegarder() {
        try {
            var data = { etape: etapeActive };
            CHAMPS_MEMO.forEach(function (n) { data[n] = valeur(n); });
            ['projet', 'delai', 'modeContact', 'jourRappel', 'creneauRappel',
                'nombrePros'].forEach(function (n) {
                    data[n] = valeurRadio(n);
                });
            sessionStorage.setItem(CLE_STOCKAGE, JSON.stringify(data));
        } catch (e) {
            /* mode privé ou stockage plein : la persistance est optionnelle */
        }
    }

    function restaurer() {
        try {
            var brut = sessionStorage.getItem(CLE_STOCKAGE);
            if (!brut) return null;
            var data = JSON.parse(brut);

            CHAMPS_MEMO.forEach(function (n) {
                var el = champ(n);
                if (el && data[n]) el.value = data[n];
            });

            ['projet', 'delai', 'modeContact', 'creneauRappel', 'nombrePros'].forEach(function (n) {
                if (!data[n]) return;
                form.querySelectorAll('[name="' + n + '"]').forEach(function (r) {
                    if (r.value === data[n]) r.checked = true;
                });
            });

            majAffichageCreneau();
            return data;
        } catch (e) {
            return null;
        }
    }

    function oublier() {
        try {
            sessionStorage.removeItem(CLE_STOCKAGE);
        } catch (e) { /* sans effet */ }
    }

    /* ----------------------------------------------------------------------
       Envoi
       ---------------------------------------------------------------------- */

    function envoyer() {
        // Honeypot : rempli uniquement par un robot. On simule un succès
        // pour ne pas renseigner le bot sur le filtrage.
        var piege = champ('site-web');
        if (piege && piege.value) {
            oublier();
            window.location.href = 'merci.html';
            return;
        }

        btnSuivant.disabled = true;
        btnSuivant.textContent = 'Envoi en cours…';

        var rappel = estRappel();
        var horodatage = new Date().toISOString();
        var jourCoche = form.querySelector('[name="jourRappel"]:checked');

        var payload = {
            projet: valeurRadio('projet'),
            typeLogement: valeur('typeLogement'),
            surface: valeur('surface'),
            statut: valeur('statut'),
            energie: valeur('energie'),
            delai: valeurRadio('delai'),
            modeContact: valeurRadio('modeContact'),
            // Nombre de professionnels autorisés à contacter le prospect :
            // détermine combien de fois le lead peut être transmis.
            nombrePros: parseInt(valeurRadio('nombrePros'), 10) || 1,
            prenom: valeur('prenom').trim(),
            nom: valeur('nom').trim(),
            codePostal: valeur('codePostal').trim(),
            email: valeur('email').trim(),
            telephone: valeur('telephone').trim(),
            consentement: champ('consentement').checked,
            dateConsentement: horodatage,
            source: window.location.hostname || 'local'
        };

        // Les champs de rappel n'existent que sur cette branche
        if (rappel) {
            payload.jourRappel = valeurRadio('jourRappel');
            payload.jourRappelISO = jourCoche ? jourCoche.dataset.iso : '';
            payload.creneauRappel = valeurRadio('creneauRappel');
            payload.consentementRappel = champ('consentementRappel').checked;
            payload.dateConsentementRappel = horodatage;
        }

        // Filet de sécurité : un lead qui échoue à partir est un lead payé et
        // perdu. On le conserve localement pour pouvoir le récupérer.
        function archiverEchec(err) {
            try {
                var file = JSON.parse(localStorage.getItem('msc-leads-echoues') || '[]');
                file.push({ payload: payload, erreur: String(err), date: new Date().toISOString() });
                localStorage.setItem('msc-leads-echoues', JSON.stringify(file.slice(-50)));
            } catch (e) { /* stockage indisponible */ }
        }

        submitLead(payload)
            .then(function () {
                oublier();
                window.location.href = 'merci.html';
            })
            .catch(function (err) {
                console.error('[LEAD ÉCHOUÉ]', err, payload);
                archiverEchec(err);

                // Une seule nouvelle tentative avant de solliciter l'utilisateur
                return submitLead(payload).then(function () {
                    oublier();
                    window.location.href = 'merci.html';
                }).catch(function (err2) {
                    console.error('[LEAD ÉCHOUÉ — 2e tentative]', err2);
                    btnSuivant.disabled = false;
                    btnSuivant.textContent = 'Recevoir mes devis';
                    alert("L'envoi n'a pas abouti. Merci de réessayer dans un instant, "
                        + "ou de nous écrire à contact@masolutionchaleur.fr");
                });
            });
    }

    /* ----------------------------------------------------------------------
       Ouverture / fermeture du tunnel
       ---------------------------------------------------------------------- */

    function preselectionner(slug) {
        if (!slug) return;

        var correspondances = {
            'pompe-a-chaleur': 'Pompe à chaleur',
            'chaudiere': 'Chaudière',
            'poele-granules': 'Poêle à granulés',
            'chauffe-eau-thermo': 'Chauffe-eau thermodynamique'
        };

        var libelle = correspondances[slug];
        if (!libelle) return;

        form.querySelectorAll('[name="projet"]').forEach(function (r) {
            if (r.value === libelle) r.checked = true;
        });
    }

    function ouvrirTunnel(options) {
        options = options || {};
        dernierFocus = document.activeElement;

        var choixHero = document.querySelector('#homeSelection input:checked');
        preselectionner(options.solution || (choixHero ? choixHero.value : ''));

        // Un CTA « Être rappelé » présélectionne le mode et ouvre à l'étape 4
        if (options.mode === 'rappel') {
            var radioRappel = document.getElementById('m-rappel');
            if (radioRappel) radioRappel.checked = true;
            majAffichageCreneau();
        }

        tunnel.classList.remove('hidden');
        tunnel.classList.add('flex');
        document.body.style.overflow = 'hidden';
        majBarreMobile();

        var depart = 1;
        if (options.mode === 'rappel') {
            depart = 4;
        } else if (valeurRadio('projet')) {
            depart = 2;
        }
        afficherEtape(depart);
    }

    function fermerTunnel() {
        clearTimeout(minuteurAuto);
        tunnel.classList.add('hidden');
        tunnel.classList.remove('flex');
        document.body.style.overflow = '';
        sauvegarder();
        majBarreMobile();
        if (dernierFocus) dernierFocus.focus();
    }

    document.querySelectorAll('[data-ouvrir-tunnel]').forEach(function (el) {
        el.addEventListener('click', function (e) {
            e.preventDefault();
            ouvrirTunnel({
                solution: el.dataset.solution || '',
                mode: el.dataset.mode || ''
            });
        });
    });

    document.querySelectorAll('[data-fermer-tunnel]').forEach(function (el) {
        el.addEventListener('click', fermerTunnel);
    });

    tunnel.addEventListener('click', function (e) {
        if (e.target === tunnel) fermerTunnel();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !tunnel.classList.contains('hidden')) {
            fermerTunnel();
        }
    });

    /* ----------------------------------------------------------------------
       Événements du formulaire
       ---------------------------------------------------------------------- */

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        etapeSuivante();
    });

    btnRetour.addEventListener('click', function () {
        if (etapeActive > 1) afficherEtape(etapeActive - 1);
    });

    form.addEventListener('change', function (e) {
        var nom = e.target.name;
        if (nom) afficherErreur(nom, false);

        if (nom === 'modeContact') majAffichageCreneau();

        sauvegarder();
    });

    form.addEventListener('input', function (e) {
        if (e.target.name) afficherErreur(e.target.name, false);
    });

    /* Avance automatique — déclenchée par une action délibérée (clic ou
       Espace/Entrée), jamais par le simple déplacement du focus aux flèches,
       qui doit rester libre pour la navigation clavier. */

    form.addEventListener('click', function (e) {
        var cible = e.target.closest('label');
        if (!cible) return;

        var etape = e.target.closest('.etape');
        if (!etape) return;

        // Étape 4 : « rappel » déplie le sélecteur au lieu d'avancer. On ne
        // poursuit qu'une fois le jour ET le créneau renseignés — ou tout de
        // suite si le visiteur a choisi l'email.
        if (etape.dataset.etape === '4') {
            var input = document.getElementById(cible.getAttribute('for'));
            if (!input) return;

            if (input.name === 'modeContact') {
                if (input.value === 'email') setTimeout(planifierAvance, 0);
                return;
            }

            if (input.name === 'jourRappel' || input.name === 'creneauRappel') {
                setTimeout(planifierAvance, 0);
            }
            return;
        }

        if (etape.hasAttribute('data-auto')) setTimeout(planifierAvance, 0);
    });

    form.addEventListener('keyup', function (e) {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        if (e.target.type !== 'radio') return;

        var etape = e.target.closest('.etape');
        if (!etape) return;

        if (etape.dataset.etape === '4') {
            if (e.target.name === 'modeContact') {
                if (e.target.value === 'email') planifierAvance();
            } else if (e.target.name === 'jourRappel' || e.target.name === 'creneauRappel') {
                planifierAvance();
            }
            return;
        }

        if (etape.hasAttribute('data-auto')) planifierAvance();
    });

    // Une carte du hero ouvre directement le tunnel
    document.querySelectorAll('#homeSelection input').forEach(function (radio) {
        radio.addEventListener('change', function () {
            ouvrirTunnel({ solution: radio.value });
        });
    });

    /* ----------------------------------------------------------------------
       Menu mobile
       ---------------------------------------------------------------------- */

    var burger = document.getElementById('burger');
    var navMobile = document.getElementById('nav-mobile');

    if (burger && navMobile) {
        burger.addEventListener('click', function () {
            var ouvert = navMobile.classList.toggle('hidden');
            burger.setAttribute('aria-expanded', ouvert ? 'false' : 'true');
        });

        navMobile.querySelectorAll('a').forEach(function (lien) {
            lien.addEventListener('click', function () {
                navMobile.classList.add('hidden');
                burger.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* ----------------------------------------------------------------------
       Barre d'action mobile
       Masquée tant que le CTA du hero est visible (doublon inutile), puis
       glissée à l'écran. Masquée aussi quand le tunnel est ouvert.
       ---------------------------------------------------------------------- */

    var barreMobile = document.getElementById('barreMobile');
    var ctaHero = document.querySelector('.btn-lg');

    function majBarreMobile() {
        if (!barreMobile) return;

        // Le tunnel ouvert prime : la barre ne doit pas flotter par-dessus
        if (!tunnel.classList.contains('hidden')) {
            barreMobile.classList.add('translate-y-full');
            return;
        }

        var depasse = true;
        if (ctaHero) {
            var r = ctaHero.getBoundingClientRect();
            depasse = r.bottom < 0;   // le CTA du hero est sorti par le haut
        }
        barreMobile.classList.toggle('translate-y-full', !depasse);
    }

    if (barreMobile) {
        window.addEventListener('scroll', majBarreMobile, { passive: true });
        window.addEventListener('resize', majBarreMobile, { passive: true });
        majBarreMobile();
    }

    /* ----------------------------------------------------------------------
       Initialisation
       ---------------------------------------------------------------------- */

    genererJours();
    restaurer();

})();
