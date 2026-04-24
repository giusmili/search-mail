import { useState } from "react";
import {
  Search,
  Linkedin,
  Globe,
  ExternalLink,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || "" });

interface VerificationResult {
  valid: boolean;
  syntax: boolean;
  domain: boolean;
  disposable: boolean;
  score: number;
  reason?: string;
  details?: {
    domain: string;
    mx: boolean;
  };
}

interface LinkedInProfile {
  name: string;
  headline: string;
  url: string;
  location?: string;
  relevanceStatus: 'high' | 'medium' | 'low';
  matchReason?: string;
}

export default function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!input.trim()) return;

    setError(null);
    setLoading(true);
    setSearching(true);
    setResult(null);
    setProfiles([]);

    try {
      const response = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input }),
      });
      
      const verificationData = await response.json();
      if (verificationData.error) throw new Error(verificationData.error);
      
      // Update result immediately so the technical fingerprint shows data
      setResult(verificationData);

      await findLinkedInProfiles(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setSearching(false);
    } finally {
      setLoading(false);
    }
  };

  const cleanLinkedInUrl = (url: string): string => {
    if (!url) return "";
    try {
      // Double decoding for nested Google Search redirects
      let decodedUrl = decodeURIComponent(url);
      if (decodedUrl.includes('%')) decodedUrl = decodeURIComponent(decodedUrl);
      
      // If it's a google search redirect, extract the actual target URL
      const googleMatch = decodedUrl.match(/[?&]url=([^&]+)/);
      if (googleMatch) decodedUrl = decodeURIComponent(googleMatch[1]);

      // Detect regional subdomains (fr.linkedin.com, etc) and handle /in/ or /pub/
      // This regex captures only the unique slug
      const profileMatch = decodedUrl.match(/(?:linkedin\.com\/(?:in|pub)\/)([^/?#& ]+)/i);
      
      if (profileMatch && profileMatch[1]) {
        // Clean the slug (remove trailing slashes or spaces)
        let slug = profileMatch[1].trim().replace(/\/$/, "");
        return `https://www.linkedin.com/in/${slug}`;
      }
      
      // Handle legacy /profile/view?id= formats
      const idMatch = decodedUrl.match(/[?&]id=([^& ]+)/);
      if (decodedUrl.includes('linkedin.com/profile/view') && idMatch) {
         return `https://www.linkedin.com/in/${idMatch[1].trim()}`;
      }

      // Fallback: Strip everything after ? or # and ensure https
      if (url.startsWith("http")) {
        let clean = url.split("?")[0].split("#")[0].replace(/\/$/, "");
        // Force www and https
        clean = clean.replace(/^(https?:\/\/)?([a-z]{2}\.)?linkedin\.com/i, "https://www.linkedin.com");
        return clean;
      }
      
      return url;
    } catch (e) {
      // In case of any error, returning the original stripped of query params is safer than nothing
      return url.split("?")[0];
    }
  };
  const findLinkedInProfiles = async (query: string) => {
    try {
      const prompt = `Recherche le profil LinkedIn correspondant à l'adresse email : "${query}".
Utilise Google Search pour trouver des résultats réels. N'invente aucun profil.
Retourne UNIQUEMENT un tableau JSON (sans markdown, sans texte autour) avec les profils trouvés, ou [] si aucun résultat.
Format strict : [{"name":"...","headline":"...","url":"https://www.linkedin.com/in/slug","location":"...","relevanceStatus":"high|medium|low","matchReason":"..."}]`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text ?? "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      const parsed: any[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

      const data = parsed.map(p => ({
        ...p,
        url: cleanLinkedInUrl(p.url),
      })) as LinkedInProfile[];

      setProfiles(data);
    } catch (err) {
      console.error("LinkedIn search error:", err);
    } finally {
      setSearching(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#1A1A1A] font-sans selection:bg-black selection:text-white pb-24 relative">
      
      {/* Global Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#F9F8F6]/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-6"
          >
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin stroke-[1px] opacity-20" />
              <RefreshCw className="w-8 h-8 animate-spin absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 stroke-[1px]" />
            </div>
            <div className="text-center space-y-2">
              <p className="font-serif italic text-2xl tracking-tight">Indexation intelligente en cours...</p>
              <p className="text-[10px] uppercase tracking-[0.4em] font-bold opacity-40">Accès aux archives mondiales</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold uppercase tracking-widest px-6 py-3 shadow-md">
          {error}
        </div>
      )}

      <div className="max-w-[1200px] mx-auto p-8 md:p-12 space-y-12">
        
        {/* Editorial Header */}
        <header className="flex flex-col md:flex-row justify-between items-baseline border-b border-[#1A1A1A] pb-6 mb-12">
          <div className="space-y-2">
            <h1 className="text-6xl font-serif italic font-light tracking-tight">Insight Engine</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-60">Verification & Intelligence d'adresse email</p>
          </div>
          <div className="text-right mt-4 md:mt-0 font-mono text-[10px] uppercase tracking-widest leading-relaxed">
{/* <p className="font-bold">REF: AUDIT-{new Date().getFullYear()}-AI</p> */}
            <p className="opacity-60 italic">{new Date().toLocaleDateString('fr-FR', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-12 gap-12">
          
          {/* Left Column: Input & Confidence Score */}
          <section className="md:col-span-4 flex flex-col space-y-12">
            
            {/* Verification Target Input */}
            <div>
              <label className="text-[10px] uppercase tracking-[0.3em] block mb-4 font-bold opacity-50">Verification de mail</label>
              <div className="relative border-b border-[#1A1A1A] group">
                <input
                  type="text"
                  className="w-full bg-transparent py-4 text-xl font-medium focus:outline-none placeholder:opacity-20 placeholder:italic transition-all uppercase tracking-tight"
                  placeholder="Enter email or identity..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={loading}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-2 hover:bg-black hover:text-white transition-all rounded-full disabled:opacity-30"
                >
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Confidence Score Big Display */}
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="confidence"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-10 border border-[#1A1A1A]/10 shadow-[4px_4px_0px_#1A1A1A] flex flex-col items-center justify-center text-center space-y-6"
                >
                  <span className="text-[10px] uppercase tracking-[0.4em] font-bold opacity-40">Confidence Score</span>
                  <div className="text-[140px] font-serif leading-none font-light tracking-tighter relative">
                    {result.score}
                    <span className="text-4xl absolute -top-2 -right-10">%</span>
                  </div>
                  <div className="px-6 py-2 bg-[#1A1A1A] text-white text-[11px] uppercase tracking-[0.2em] font-bold italic rounded-full shadow-lg">
                    {result.valid ? "✓ Identifié" : "⚠ Anomalous"}
                  </div>
                  <p className="text-xs opacity-50 italic max-w-[200px] leading-relaxed">
                    {result.valid 
                      ? "Données très fiables détectées. Les enregistrements professionnels concordent avec les marqueurs techniques." 
                      : "Avertissement : Incohérence des données détectée. Vérification manuelle recommandée."}
                  </p>
                </motion.div>
              ) : (
                <div className="bg-[#F1EFEC]/50 p-10 border border-dashed border-[#1A1A1A]/20 flex flex-col items-center justify-center text-center space-y-4 h-[400px]">
                  <Loader2 className={`w-8 h-8 opacity-20 ${loading ? 'animate-spin opacity-100' : ''}`} />
                  <p className="text-[10px] uppercase tracking-widest opacity-40 font-bold">Awaiting Data Input</p>
                </div>
              )}
            </AnimatePresence>
          </section>

          {/* Right Column: Tech Fingerprint & Intelligence */}
          <section className="md:col-span-8 flex flex-col gap-16">
            
            {/* Technical Audit Section */}
            <div className="space-y-8">
              <h2 className="text-[10px] uppercase tracking-[0.4em] font-bold border-l-4 border-[#1A1A1A] pl-4">Technical Fingerprint</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-0.5 bg-[#1A1A1A]/10 border border-[#1A1A1A]/10">
                <AuditBox 
                  label="Syntax Integrity" 
                  value="Format" 
                  status={result?.syntax ? "Pass" : result ? "Fail" : "Wait"} 
                />
                <AuditBox 
                  label="MX Record Presence" 
                  value="Domain" 
                  status={result?.domain ? "Active" : result ? "Lost" : "Wait"} 
                />
                <AuditBox 
                  label="Identity Auth" 
                  value="Secure" 
                  status={result?.valid ? "High" : result ? "Low" : "Wait"} 
                />
              </div>
            </div>

            {/* LinkedIn Intelligence Mapping */}
            <div className="space-y-8 flex-grow">
              <div className="flex justify-between items-baseline border-b border-[#1A1A1A]/5 pb-4">
                <h2 className="text-[10px] uppercase tracking-[0.4em] font-bold border-l-4 border-[#1A1A1A] pl-4">LinkedIn Intelligence Mapping</h2>
                <span className="text-[10px] italic font-serif opacity-50">
                  {searching ? "Indexing social databases..." : `${profiles.length} potential matches identified`}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <AnimatePresence>
                  {profiles.length > 0 ? (
                    profiles.map((profile, i) => (
                      <motion.div
                        key={profile.url}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white border border-[#1A1A1A]/10 p-8 flex flex-col items-start gap-6 hover:bg-[#F1EFEC] transition-all group grayscale hover:grayscale-0"
                      >
                        <div className="flex items-center gap-4 w-full">
                          <div className="w-16 h-16 bg-emerald-600 text-white rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-serif border border-emerald-700/10 group-hover:scale-105 transition-transform shadow-sm">
                            {profile.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-serif italic text-2xl leading-none">{profile.name}</h3>
                              <RelevanceBadge status={profile.relevanceStatus} />
                            </div>
                            <p className="text-[10px] uppercase tracking-wider font-bold opacity-60 truncate">{profile.headline}</p>
                          </div>
                        </div>
                        {profile.matchReason && (
                          <p className="text-[10px] italic opacity-50 leading-relaxed border-l-2 border-[#1A1A1A]/20 pl-3">
                            {profile.matchReason}
                          </p>
                        )}
                        <div className="w-full pt-4 border-t border-[#1A1A1A]/5 flex justify-between items-center text-[10px] font-bold tracking-widest uppercase">
                          <div className="flex items-center gap-2 opacity-50 italic">
                            <Globe className="w-3 h-3" /> {profile.location || "Global"}
                          </div>
                          <a
                            href={profile.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 hover:underline underline-offset-4"
                          >
                            Répertoire Link <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </motion.div>
                    ))
                  ) : searching ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-[200px] bg-white/30 border border-dashed border-[#1A1A1A]/10 animate-pulse" />
                    ))
                  ) : !loading && result && (
                    <div className="col-span-full py-16 flex flex-col items-center justify-center space-y-4 opacity-30 grayscale">
                      <Linkedin className="w-12 h-12 stroke-[1px]" />
                      <p className="font-serif italic text-xl">Aucun profil LinkedIn trouvé</p>
                      <p className="text-[10px] uppercase tracking-[0.3em] font-bold">Cet email n'apparaît pas publiquement sur LinkedIn</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>
        </main>

        {/* Editorial Footer */}
        <footer className="pt-12 border-t border-[#1A1A1A]/20 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-[0.4em] font-bold opacity-30 gap-4">
          <span>Confidential Intelligence Document</span>
          <div className="flex gap-8">
            <span>© {new Date().getFullYear()} Insight Engine Labs</span>
            <span>Encoded Secure Protocol 0x{Math.floor(Math.random()*1000).toString(16).toUpperCase()}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

function AuditBox({ label, value, status }: { label: string, value: string, status: string }) {
  const isPass = ["Pass", "Active", "High"].includes(status);
  const isFail = ["Fail", "Lost", "Low"].includes(status);
  
  return (
    <div className="bg-white p-8 space-y-6">
      <span className="block text-[9px] uppercase tracking-[0.3em] font-bold opacity-40 leading-none">{label}</span>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-serif leading-none">{value}</span>
        <span className={`text-[10px] font-bold italic uppercase tracking-widest ${isPass ? 'text-green-700' : isFail ? 'text-rose-700' : 'opacity-20'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

function RelevanceBadge({ status }: { status: LinkedInProfile['relevanceStatus'] }) {
  const config = {
    high: "bg-[#1A1A1A] text-white",
    medium: "bg-[#F1EFEC] text-[#1A1A1A] border border-[#1A1A1A]/10",
    low: "bg-transparent text-[#1A1A1A]/40 border border-dashed border-[#1A1A1A]/20",
  };
  return (
    <span className={`text-[8px] px-2 py-0.5 rounded-sm font-bold uppercase tracking-widest ${config[status]}`}>
      {status}
    </span>
  );
}
