import { z } from "zod";

/** Optional string: empty / whitespace-only values count as "not set". */
const opt = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const httpUrl = opt.refine((v) => v === undefined || /^https?:\/\//i.test(v), {
  message: "must start with http:// or https://",
});

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // ── Required ────────────────────────────────────────────────────────────
  DATABASE_URL: z
    .string({ required_error: "DATABASE_URL is required" })
    .trim()
    .refine((v) => /^postgres(ql)?:\/\//.test(v), { message: "must be a postgres:// URL" }),

  // ── Optional (each one switches a feature on) ───────────────────────────
  AUTH_SECRET: opt, // needed once Auth.js sessions are enabled
  STREAMING_API_URL: httpUrl,
  ANILIST_CLIENT_ID: opt,
  ANILIST_CLIENT_SECRET: opt,
  BLOB_READ_WRITE_TOKEN: opt,
  ASSEMBLYAI_API_KEY: opt,
  FANART_TV_API_KEY: opt,
  OPENAI_API_KEY: opt,
  GROQ_API_KEY: opt,
});

export type Env = z.infer<typeof schema>;

const FEATURES: { name: string; anyOf?: (keyof Env)[]; allOf?: (keyof Env)[] }[] = [
  { name: "Secure sessions & /admin (AUTH_SECRET)", allOf: ["AUTH_SECRET"] },
  { name: "AniList account sync", allOf: ["ANILIST_CLIENT_ID", "ANILIST_CLIENT_SECRET"] },
  { name: "Profile picture/banner uploads", allOf: ["BLOB_READ_WRITE_TOKEN"] },
  { name: "Live captions (AssemblyAI)", allOf: ["ASSEMBLYAI_API_KEY"] },
  { name: "Anime logos (Fanart.tv)", allOf: ["FANART_TV_API_KEY"] },
  { name: "AI captions/translation", anyOf: ["OPENAI_API_KEY", "GROQ_API_KEY"] },
];

export interface EnvReport {
  ok: boolean;
  errors: string[];
  disabled: string[];
  env?: Env;
}

export function checkEnv(source: NodeJS.ProcessEnv = process.env): EnvReport {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "env"}: ${i.message}`),
      disabled: [],
    };
  }
  const env = parsed.data;
  const disabled = FEATURES.filter((f) => {
    const all = (f.allOf ?? []).every((k) => Boolean(env[k]));
    const any = f.anyOf ? f.anyOf.some((k) => Boolean(env[k])) : true;
    return !(all && any);
  }).map((f) => f.name);
  return { ok: true, errors: [], disabled, env };
}

/** Called once on server start (src/instrumentation.ts). Logs a clear report. */
export function reportEnv(): void {
  const r = checkEnv();
  if (!r.ok) {
    console.error("[env] Invalid environment:\n  - " + r.errors.join("\n  - "));
    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment configuration. See [env] log above.");
    }
    return;
  }
  if (r.disabled.length) {
    console.warn("[env] Optional features disabled (env not set): " + r.disabled.join(", "));
  }
  const sec = r.env?.AUTH_SECRET;
  if (sec && (sec.length < 16 || sec === "changeme-in-production")) {
    console.warn("[env] AUTH_SECRET is too short or still the example value — sessions/admin stay disabled. Use: openssl rand -base64 32");
  }
  if (!r.env?.STREAMING_API_URL) {
    console.warn("[env] STREAMING_API_URL not set — falling back to the built-in default.");
  }
}
