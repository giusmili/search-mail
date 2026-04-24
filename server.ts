import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

type SerperResult = { title: string; link: string; snippet: string };

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // Email verification endpoint
  app.post("/api/verify-email", async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidFormat = emailRegex.test(email);

      if (!isValidFormat) {
        return res.json({
          valid: false,
          syntax: false,
          domain: false,
          disposable: false,
          score: 0,
          reason: "Format invalide",
        });
      }

      const domain = email.split("@")[1];

      let hasMx = false;
      try {
        const mxRecords = await resolveMx(domain);
        hasMx = mxRecords && mxRecords.length > 0;
      } catch {
        hasMx = false;
      }

      const disposableDomains = [
        "temp-mail.org", "guerrillamail.com", "10minutemail.com",
        "mailinator.com", "yopmail.com", "throwawaymail.com",
        "tempmail.com", "dispostable.com", "maildrop.cc",
        "mailnesia.com", "sharklasers.com", "getairmail.com",
        "trashmail.com", "anonbox.net", "getnada.com", "tempmailaddress.com",
        "pichis.org", "mintemail.com", "harakirimail.com", "mytrashmail.com",
        "mail-temporaire.fr",
      ];
      const isDisposable = disposableDomains.includes(domain.toLowerCase());

      let score = 0;
      if (isValidFormat) score += 30;
      if (hasMx) score += 50;
      if (!isDisposable) score += 20;
      if (isDisposable) score -= 10;
      score = Math.max(0, Math.min(100, score));

      res.json({
        valid: hasMx && !isDisposable,
        syntax: isValidFormat,
        domain: hasMx,
        disposable: isDisposable,
        score,
        details: { domain, mx: hasMx },
      });
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({ error: "Erreur lors de la vérification" });
    }
  });

  // Serper helper: one Google search, returns organic results
  async function serperSearch(q: string): Promise<SerperResult[]> {
    const key = process.env.SERPER_API_KEY;
    if (!key) return [];
    try {
      const resp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": key, "Content-Type": "application/json" },
        body: JSON.stringify({ q, num: 6, gl: "fr" }),
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        console.error("[serper] HTTP error:", resp.status, await resp.text());
        return [];
      }
      const data = await resp.json() as any;
      return data.organic || [];
    } catch (e) {
      console.error("[serper]", e);
      return [];
    }
  }

  // LinkedIn profile search: searches for the exact email address, no name speculation
  app.post("/api/search-profiles", async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    try {
      // Without Serper we cannot do real searches — refuse to speculate
      if (!process.env.SERPER_API_KEY) {
        return res.json({ profiles: [], serperMissing: true });
      }

      // Two searches: exact email on LinkedIn, then exact email anywhere on the web
      const [linkedinResults, webResults] = await Promise.all([
        serperSearch(`"${email}" site:linkedin.com`),
        serperSearch(`"${email}"`),
      ]);

      console.log(
        `[search] email="${email}" -> ${linkedinResults.length} linkedin hits, ${webResults.length} web hits`,
      );

      const linkedInUrls = [...new Set([
        ...linkedinResults.filter(r => r.link.includes("linkedin.com/in/")).map(r => r.link),
        ...webResults.filter(r => r.link.includes("linkedin.com/in/")).map(r => r.link),
      ])].slice(0, 5);

      const webSnippets = [
        ...linkedinResults.map(r => `[${r.title}] ${r.snippet}`),
        ...webResults.map(r => `[${r.title}] ${r.snippet}`),
      ].slice(0, 10).join("\n");

      // No real data found — return empty, no AI speculation
      if (linkedInUrls.length === 0 && !webSnippets) {
        return res.json([]);
      }

      const apiUrl = process.env.AI_API_URL || "https://api.deepseek.com/v1/chat/completions";
      const apiKey = process.env.AI_API_KEY;
      const model = process.env.AI_MODEL || "deepseek-chat";
      if (!apiKey) return res.status(500).json({ error: "AI_API_KEY non configurée" });

      const urlBlock = linkedInUrls.length > 0
        ? `\nURLs LinkedIn trouvées par recherche Google :\n${linkedInUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`
        : "";

      const snippetBlock = webSnippets
        ? `\nRésultats web :\n${webSnippets}`
        : "";

      const aiResp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: `Tu es un expert OSINT. À partir des résultats de recherche Google fournis, identifie les profils LinkedIn qui correspondent à l'adresse email donnée.
RÈGLE STRICTE : retourne UNIQUEMENT les profils issus des URLs et snippets fournis. N'invente AUCUN profil.
Si les données ne permettent pas d'identifier un profil réel, retourne {"profiles": []}.
Retourne {"profiles": [...]} — chaque profil : name, headline, url (doit être une des URLs fournies), location (optionnel), relevanceStatus ("high"|"medium"|"low"), matchReason.`,
            },
            {
              role: "user",
              content: `Email à identifier : "${email}"
${urlBlock}${snippetBlock}

Analyse UNIQUEMENT les URLs et snippets ci-dessus. N'invente pas de profils supplémentaires.`,
            },
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!aiResp.ok) {
        const errText = await aiResp.text();
        console.error("[ai] HTTP error:", aiResp.status, errText);
        return res.status(502).json({ error: `Erreur API IA (${aiResp.status}) — vérifiez la clé AI_API_KEY` });
      }

      const data = await aiResp.json() as any;

      if (data.error) {
        console.error("[ai] API error:", data.error);
        return res.status(502).json({ error: `Erreur API IA : ${typeof data.error === "string" ? data.error : (data.error.message || JSON.stringify(data.error))}` });
      }

      const content = data.choices?.[0]?.message?.content || '{"profiles":[]}';

      let profiles = [];
      try {
        const parsed = JSON.parse(content);
        profiles = Array.isArray(parsed) ? parsed : (parsed.profiles || parsed.results || []);
      } catch {
        profiles = [];
      }

      res.json(profiles);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ error: "Erreur lors de la recherche de profils" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
