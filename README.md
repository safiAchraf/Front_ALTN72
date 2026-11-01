# Trackwise — Frontend

React + TypeScript + Vite. Le frontend utilise réellement l’API Spring Boot du dossier frère `ALTN72_springboot`.

1. Démarrer le backend avec `run-demo.ps1` dans son dossier.
2. `npm ci`, puis `npm run dev` ici pour développer ; Vite transmet `/api` à `http://localhost:8080`.
3. `npm run build` pour vérifier TypeScript et produire `dist`.

Pour utiliser l’application complète à http://localhost:8080, lancer `build.ps1` puis `run-demo.ps1` depuis le backend. Identifiants locaux dans `.demo-credentials` du backend ; profils `responsable` et `agent`.

Le frontend n’embarque aucun identifiant ni mot de passe. Cookie de session même origine, CSRF, erreurs françaises, filtres cumulables et actualisation toutes les minutes. Le backend contrôle les droits.

Les instructions détaillées et les limites sont dans le `journal.md` backend.
