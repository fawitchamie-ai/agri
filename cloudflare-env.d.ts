declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    AUTH_DEMO_ONLY?: string;
    ADMIN_USER_IDS?: string;
    ADMIN_EMAILS?: string;
    CROP_COMPUTE_URL?: string;
    CROP_COMPUTE_TOKEN?: string;
  }
}

interface ImportMeta { readonly env?: {readonly DEV?:boolean} }
