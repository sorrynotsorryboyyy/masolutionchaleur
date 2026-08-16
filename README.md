# masolutionchaleur.fr

Landing d'acquisition de leads pour les travaux de chauffage (pompe à chaleur,
chaudière, poêle à granulés, chauffe-eau thermodynamique). Le visiteur décrit son
projet en quelques étapes et choisit d'être **rappelé** par un professionnel ou de
recevoir des devis par email.

Site statique : HTML + CSS compilé + JavaScript vanilla, sans dépendance au
runtime et sans framework côté client.

---

## Avant la mise en ligne

Deux points **doivent** être renseignés, sinon le site ne fonctionne pas
correctement ou n'est pas conforme.

### 1. Clé du formulaire (sinon aucun lead n'est reçu)

Sans cette clé, le parcours se déroule normalement mais **les demandes ne sont
envoyées nulle part** — elles sont seulement journalisées dans la console.

1. Créer une clé gratuite sur [web3forms.com](https://web3forms.com) (aucun compte
   requis, la clé arrive par email — 250 envois/mois inclus).
2. Ouvrir `js/script.js` et remplacer :

```js
var CLE_FORMULAIRE = 'VOTRE_CLE_WEB3FORMS';
```

La clé est **publique par conception** : elle ne permet que d'envoyer vers votre
adresse email, jamais de lire des données. Sa présence dans le dépôt est sans
risque.

### 2. Adresse du siège social

Obligatoire (article 6 III de la LCEN). Remplacer
`[adresse complète — obligatoire]` dans :

- `mentions-legales.html`
- `confidentialite.html`

---

## Développement

```bash
npm install          # une seule fois
npm run watch        # recompile le CSS à chaque modification
```

Servir le dossier via un serveur HTTP local (pas en `file://`, sinon la police
est bloquée par CORS) :

```bash
npx serve .
```

### Compiler le CSS

```bash
npm run build        # génère css/style.css (minifié)
```

> `css/style.css` est **versionné volontairement** : Vercel déploie le dossier tel
> quel sans lancer de build. Après toute modification de `src/input.css`, de
> `tailwind.config.js` ou des classes dans le HTML, relancer `npm run build` et
> committer le CSS régénéré.

---

## Déploiement (Vercel)

Projet statique, aucune configuration de build nécessaire :

- **Framework preset** : Other
- **Build command** : *(laisser vide)*
- **Output directory** : `.` (racine)

`vercel.json` définit les en-têtes de sécurité et la mise en cache longue durée
des polices et images.

**Hébergement hors UE** : Vercel étant une société américaine, la politique de
confidentialité mentionne le transfert de données hors Union européenne encadré
par les clauses contractuelles types. En cas de migration vers un hébergeur
français, cette section est à mettre à jour.

---

## Structure

```
index.html              landing + tunnel de captation (6 étapes)
merci.html              confirmation après envoi
mentions-legales.html   mentions légales
confidentialite.html    politique de confidentialité (RGPD)
404.html                page d'erreur

src/input.css           source Tailwind (à éditer)
css/style.css           CSS compilé (généré — ne pas éditer à la main)
js/script.js            tunnel, validation, envoi des leads
i/                      logo, icônes, illustrations
fonts/                  Manrope (auto-hébergée, aucune requête externe)
```

---

## Où arrivent les leads

`submitLead()` dans `js/script.js` est le **point de sortie unique**. Le lead
part par email au format lisible, avec une copie JSON brute en pièce jointe du
message (champ `donnees_brutes`) réutilisable si vous passez plus tard à un CRM
ou une base de données.

Si l'envoi échoue, une seconde tentative est effectuée automatiquement, puis le
lead est archivé dans le `localStorage` du visiteur sous la clé
`msc-leads-echoues` — une demande payée en publicité n'est ainsi jamais perdue
silencieusement.

---

## Conformité

- Consentement explicite à la transmission des données, case non pré-cochée.
- **Consentement distinct** pour le démarchage téléphonique, exigé uniquement si
  le visiteur demande à être rappelé.
- Les deux consentements sont **horodatés** et transmis avec le lead : c'est la
  preuve exigible en cas de contrôle, et ce qui rend le lead revendable.
- Le visiteur choisit lui-même le nombre de professionnels destinataires (1 à 3).
- Aucun logo officiel (MaPrimeRénov', RGE, Qualibat) n'est reproduit : ces
  marques sont réservées aux organismes et entreprises certifiés. Les dispositifs
  sont uniquement cités en texte.
