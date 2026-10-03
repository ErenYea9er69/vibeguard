// ─────────────────────────────────────────────────
// @vibeguard/types — Shared type definitions
// ─────────────────────────────────────────────────

// ── Scan Target ──────────────────────────────────

export type InputSource = 'local' | 'git' | 'zip' | 'rar';

export interface ScanTarget {
  /** Unique scan identifier */
  id: string;
  /** Original path, URL, or uploaded filename */
  source: string;
  /** How the source was provided */
  inputType: InputSource;
  /** Resolved local path after ingestion */
  localPath: string;
  /** Timestamp when scan started */
  startedAt: string;
}

// ── Framework Detection ──────────────────────────

export type Framework =
  | 'nextjs'
  | 'express'
  | 'fastify'
  | 'firebase'
  | 'supabase'
  | 'remix'
  | 'nuxt'
  | 'sveltekit'
  | 'bolt'
  | 'lovable'
  | 'replit'
  | 'unknown';

export interface FrameworkSignature {
  framework: Framework;
  confidence: number; // 0–1
  version?: string;
  indicators: string[]; // what matched
}

// ── Route / API Mapping ──────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ALL';

export interface RouteInfo {
  /** e.g. /api/todos/:id */
  path: string;
  method: HttpMethod;
  /** File where this route is defined */
  file: string;
  line: number;
  /** Whether auth middleware/check was detected */
  hasAuthCheck: boolean;
  /** Whether an ownership filter was detected (e.g. WHERE user_id = ...) */
  hasOwnershipCheck: boolean;
  /** Parameters (path params, query params) */
  params: string[];
}

// ── Secret Detection ─────────────────────────────

export type SecretType =
  | 'api_key'
  | 'service_role_key'
  | 'private_key'
  | 'database_url'
  | 'jwt_secret'
  | 'oauth_secret'
  | 'stripe_key'
  | 'openai_key'
  | 'aws_key'
  | 'generic_token';

export interface ExposedSecret {
  type: SecretType;
  /** Partial value for display (first 8 chars + masked) */
  maskedValue: string;
  /** Full value for attack confirmation */
  rawValue: string;
  /** Where it was found */
  file: string;
  line: number;
  /** Is this in client-accessible code? */
  isClientExposed: boolean;
  /** The env var name it should be behind */
  suggestedEnvVar: string;
}

// ── Schema / Rules Analysis ──────────────────────

export interface DatabaseSchema {
  type: 'firestore' | 'supabase_rls' | 'prisma' | 'raw_sql' | 'unknown';
  tables: TableInfo[];
  rulesFile?: string;
  hasRLS: boolean;
}

export interface TableInfo {
  name: string;
  fields: FieldInfo[];
  /** Does this table have a user_id / owner_id / author_id field? */
  ownerField?: string;
  /** Is there an RLS policy on this table? */
  hasRowLevelSecurity: boolean;
}

export interface FieldInfo {
  name: string;
  type: string;
  /** Is this field writable from client? */
  clientWritable: boolean;
  /** Is this a sensitive field (role, admin, etc.)? */
  isSensitive: boolean;
}

// ── Recon Report (Phase 2 output) ────────────────

export interface ReconReport {
  scanId: string;
  framework: FrameworkSignature;
  routes: RouteInfo[];
  secrets: ExposedSecret[];
  schema: DatabaseSchema;
  /** Client-side files (JS bundles, public dir) */
  clientFiles: string[];
  /** Server-side files */
  serverFiles: string[];
  /** Timestamp */
  completedAt: string;
}

// ── Attack Types ─────────────────────────────────

export type VulnerabilityType =
  | 'idor'             // Insecure Direct Object Reference
  | 'broken_auth'      // Missing/broken authentication
  | 'mass_exposure'    // Unfiltered list endpoint
  | 'client_secret'    // Secret in client bundle
  | 'role_tampering'   // Client can set own role/permissions
  | 'missing_rls'      // No row-level security
  | 'open_redirect'    // Unvalidated redirect
  | 'ssrf'             // Server-side request forgery
  | 'injection';       // SQL/NoSQL injection

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AttackRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  /** Description of what this request is doing */
  intent: string;
}

export interface AttackResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  /** Time in ms */
  duration: number;
}

export interface AttackResult {
  /** Which vulnerability type this attack targets */
  type: VulnerabilityType;
  /** Human-readable name */
  name: string;
  /** What this attack does */
  description: string;
  /** Severity level */
  severity: Severity;
  /** The request sent */
  request: AttackRequest;
  /** The response received */
  response: AttackResponse;
  /** Was the exploit confirmed? (real data returned, real write performed, real key exposed) */
  confirmed: boolean;
  /** What evidence confirmed the exploit */
  evidence: string;
  /** Which route/file is affected */
  target: {
    route?: string;
    file?: string;
    line?: number;
    table?: string;
  };
}

// ── Patch ────────────────────────────────────────

export interface PatchDiff {
  file: string;
  /** Original content */
  before: string;
  /** Patched content */
  after: string;
  /** Line-level diff for display */
  diff: string;
}

export interface PatchResult {
  /** Which attack this patches */
  attackType: VulnerabilityType;
  /** Human description of the fix */
  description: string;
  /** Code changes */
  diffs: PatchDiff[];
  /** Was this patch applied successfully? */
  applied: boolean;
}

// ── Verification ─────────────────────────────────

export interface VerificationResult {
  /** The original confirmed attack */
  originalAttack: AttackResult;
  /** The patch that was applied */
  patch: PatchResult;
  /** Result of re-running the same attack */
  reattackResult: AttackResult;
  /** Did the patch fix the vulnerability? (reattack.confirmed === false) */
  verified: boolean;
  /** How many patch attempts were needed */
  attempts: number;
}

// ── Finding (single vulnerability in the report) ─

export interface Finding {
  /** Unique finding ID */
  id: string;
  /** Vulnerability type */
  type: VulnerabilityType;
  /** Human-readable title */
  title: string;
  /** What this vulnerability allows an attacker to do */
  impact: string;
  /** Severity */
  severity: Severity;
  /** The confirmed attack (before) */
  attack: AttackResult;
  /** The applied patch */
  patch: PatchResult;
  /** The verification (after) */
  verification: VerificationResult;
}

// ── Final Report ─────────────────────────────────

export interface ScanReport {
  /** Scan metadata */
  scan: ScanTarget;
  /** Recon results */
  recon: ReconReport;
  /** All findings, severity-ordered */
  findings: Finding[];
  /** Summary stats */
  stats: {
    totalAttacks: number;
    confirmedExploits: number;
    patchesApplied: number;
    patchesVerified: number;
    falsePositives: number; // always 0 — that's the pitch
    scanDuration: number; // ms
  };
  /** Timestamp */
  completedAt: string;
}

// ── AI Patch Instruction (for Claude Code, Cursor, etc.) ─

export interface AIPatchInstruction {
  /** Finding reference */
  findingId: string;
  /** Vulnerability type */
  vulnerabilityType: VulnerabilityType;
  /** Severity */
  severity: Severity;
  /** Natural language instruction for the coding AI */
  instruction: string;
  /** Specific files to modify */
  files: Array<{
    path: string;
    action: 'modify' | 'create' | 'delete';
    description: string;
  }>;
  /** Evidence that the vulnerability exists (the request/response) */
  evidence: {
    request: AttackRequest;
    response: AttackResponse;
  };
}

// ── Pipeline Events (for streaming progress) ─────

export type PipelineStage =
  | 'ingestion'
  | 'recon'
  | 'attack'
  | 'patch'
  | 'reattack'
  | 'report';

export interface PipelineEvent {
  stage: PipelineStage;
  status: 'started' | 'progress' | 'completed' | 'error';
  message: string;
  data?: unknown;
  timestamp: string;
}

// ── Benchmark (50-app results) ───────────────────

export interface BenchmarkApp {
  name: string;
  framework: Framework;
  description: string;
  /** Known vulnerabilities injected */
  injectedVulns: VulnerabilityType[];
  /** Scan results */
  results?: {
    detected: VulnerabilityType[];
    patched: VulnerabilityType[];
    verified: VulnerabilityType[];
    falsePositives: number;
  };
}

export interface BenchmarkReport {
  apps: BenchmarkApp[];
  totals: {
    totalApps: number;
    totalInjectedVulns: number;
    totalDetected: number;
    totalPatched: number;
    totalVerified: number;
    catchRate: number; // detected / injected
    fixRate: number;   // verified / detected
    falsePositives: number; // always 0
  };
  timestamp: string;
}
