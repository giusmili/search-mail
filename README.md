
<h1>Insight Engine</h1>
<p>Vérification d'adresse email & recherche de profil LinkedIn par IA</p>

![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=flat-square&logo=vite&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Framer Motion](https://img.shields.io/badge/Motion-0055FF?style=flat-square&logo=framer&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini_2.0-8E75B2?style=flat-square&logo=googlegemini&logoColor=white) ![DeepSeek](https://img.shields.io/badge/DeepSeek-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)

</div>

---

## Sujet

**Insight Engine** est une application full-stack qui permet d'analyser une adresse email selon deux axes :

- **Vérification technique** : validation du format, résolution des enregistrements MX via DNS, détection des domaines jetables — avec un score de confiance de 0 à 100.
- **Recherche de profil LinkedIn** : utilise l'API Gemini (Google Search grounding) pour identifier le profil LinkedIn réel associé à l'email, sans spéculation ni profil inventé.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19, TypeScript, Tailwind CSS v4, Motion (Framer) |
| Backend | Express.js, Node.js, tsx |
| Build | Vite 6 |
| IA frontend | Google Gemini 2.0 Flash + Google Search grounding |
| IA backend | DeepSeek API (fallback) |
| Vérification email | Node.js `dns.resolveMx` |
| Icônes | Lucide React |

---

## Arborescence

```
proj-verifemail-&-profil-finder/
├── src/
│   ├── App.tsx          # Interface React principale
│   ├── main.tsx         # Point d'entrée React
│   ├── index.css        # Styles globaux
│   └── vite-env.d.ts    # Types Vite (import.meta.env)
├── public/
│   └── asset/           # Assets statiques
├── .env.local           # Variables d'environnement (clés API)
├── .gitignore
├── index.html
├── package.json
├── server.ts            # Serveur Express (vérification email + proxy IA)
├── tsconfig.json
└── vite.config.ts
```

---

## Installation

**Prérequis :** Node.js 18+

```bash
npm install
```

Configurer les clés API dans `.env.local` :

```env
AI_API_KEY=xxxxxxxxxxxxxxxxxxxxx
AI_API_URL=xxxxxxxxxxxxxxxxxxxx
AI_MODEL
```

```bash
npm run dev
```

L'application est disponible sur un port `http://localhost:3000`.

---
## Voici le chemin complet de la promise :                                                                         
```js                                                                                                                 
  /api/search-profiles est géré dans server.ts:108 par un serveur Express. Le flux est le suivant :               
                                                                                                                  
  App.tsx (fetch POST /api/search-profiles)                                                                       
    └─> server.ts:108 (route Express)                                                                             
          ├─ 1. Appel Serper API (Google Search) — 2 requêtes parallèles :                                        
          │     ├─ `"<email>" site:linkedin.com`  → résultats LinkedIn
          │     └─ `"<email>"`                     → résultats web généraux
          │
          └─ 2. Appel AI API (DeepSeek par défaut, configurable via .env)
                → analyse les URLs/snippets trouvés par Serper
                → retourne les profils LinkedIn correspondants
                → réponse JSON : tableau de profils ou { profiles: [] }

  Variables d'env nécessaires (server.ts:146-149) :
  - SERPER_API_KEY — sans elle, retourne { profiles: [], serperMissing: true } immédiatement
  - AI_API_KEY — clé pour l'IA (DeepSeek ou autre)
  - AI_API_URL — URL de l'API IA (défaut: https://api.deepseek.com/v1/chat/completions)
  - AI_MODEL — modèle à utiliser (défaut: deepseek-chat)
```

<div align="center">
  <sub>Avril 2026</sub>
</div>
