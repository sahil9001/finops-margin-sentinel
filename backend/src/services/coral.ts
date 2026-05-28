import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);

function getCoralBinaryPath(): string {
  // 1. Check environment variable
  if (process.env.CORAL_PATH) {
    return process.env.CORAL_PATH;
  }
  
  // 2. Check default install.sh location: ~/.local/bin/coral
  const homePath = path.join(os.homedir(), '.local', 'bin', 'coral');
  if (fs.existsSync(homePath)) {
    return homePath;
  }
  
  // 3. Fallback to global command
  return 'coral';
}

export interface MarginRow {
  email: string;
  customer_name: string;
  monthly_revenue: number;
  total_token_cost: number;
  ai_features_clicked: number;
  net_margin: number;
  status: 'healthy' | 'warning' | 'leak';
}

// Highly realistic mock data for sandbox mode
const MOCK_MARGINS: MarginRow[] = [
  {
    email: 'alex@acme.com',
    customer_name: 'Acme Corporation',
    monthly_revenue: 1200,
    total_token_cost: 1540,
    ai_features_clicked: 45200,
    net_margin: -340,
    status: 'leak'
  },
  {
    email: 'billing@globex.io',
    customer_name: 'Globex Corp',
    monthly_revenue: 2500,
    total_token_cost: 2100,
    ai_features_clicked: 68100,
    net_margin: 400,
    status: 'healthy'
  },
  {
    email: 'dev@innovate.co',
    customer_name: 'Innovate LLC',
    monthly_revenue: 450,
    total_token_cost: 490,
    ai_features_clicked: 12500,
    net_margin: -40,
    status: 'warning'
  },
  {
    email: 'homer@springfield.gov',
    customer_name: 'Springfield Nuclear',
    monthly_revenue: 800,
    total_token_cost: 150,
    ai_features_clicked: 5200,
    net_margin: 650,
    status: 'healthy'
  },
  {
    email: 'support@cyberdyne.jp',
    customer_name: 'Cyberdyne Systems',
    monthly_revenue: 3000,
    total_token_cost: 3250,
    ai_features_clicked: 92400,
    net_margin: -250,
    status: 'leak'
  },
  {
    email: 'contact@northwind.com',
    customer_name: 'Northwind Traders',
    monthly_revenue: 2500,
    total_token_cost: 3100,
    ai_features_clicked: 98500,
    net_margin: -600,
    status: 'leak'
  },
  {
    email: 'billing@tyrell.io',
    customer_name: 'Tyrell Corp',
    monthly_revenue: 3000,
    total_token_cost: 950,
    ai_features_clicked: 32000,
    net_margin: 2050,
    status: 'healthy'
  },
  {
    email: 'admin@umbrella.corp',
    customer_name: 'Umbrella Corp',
    monthly_revenue: 1200,
    total_token_cost: 1650,
    ai_features_clicked: 62000,
    net_margin: -450,
    status: 'leak'
  },
  {
    email: 'info@wayne.ent',
    customer_name: 'Wayne Enterprises',
    monthly_revenue: 3000,
    total_token_cost: 3100,
    ai_features_clicked: 88000,
    net_margin: -100,
    status: 'warning'
  },
  {
    email: 'operations@hooli.xyz',
    customer_name: 'Hooli Inc',
    monthly_revenue: 2500,
    total_token_cost: 540,
    ai_features_clicked: 18000,
    net_margin: 1960,
    status: 'healthy'
  }
];

export class CoralService {
  private useSandbox: boolean = true;
  private envVars: Record<string, string> = {};

  constructor() {
    // Enabled by default; toggled via settings
    this.useSandbox = true;
  }

  setSandboxMode(enabled: boolean) {
    this.useSandbox = enabled;
    console.log(`[CoralService] Sandbox mode set to: ${enabled}`);
  }

  getSandboxMode(): boolean {
    return this.useSandbox;
  }

  setCredentials(env: Record<string, string>) {
    this.envVars = env;
  }

  /**
   * Executes a Coral SQL query.
   * In sandbox mode, returns mock SaaS tenant data.
   * In live mode, spawns a child process to run `coral sql --format json`.
   */
  async query<T = any>(sql: string): Promise<T[]> {
    if (this.useSandbox) {
      console.log('[CoralService] Executing mock query (sandbox)...');
      // Simple mock parser to return appropriate tables
      if (sql.toLowerCase().includes('stripe') || sql.toLowerCase().includes('margin')) {
        return MOCK_MARGINS as unknown as T[];
      }
      return [] as T[];
    }

    console.log(`[CoralService] Executing live Coral CLI query: ${sql}`);
    try {
      // Setup child process environment variables (inject user API keys)
      const env = {
        ...process.env,
        ...this.envVars,
      };

      // Execute coral command line tool
      // Escape query to run safely in shell
      const escapedSql = sql.replace(/"/g, '\\"');
      const coralBin = getCoralBinaryPath();
      const command = `${coralBin} sql --format json "${escapedSql}"`;
      
      const { stdout, stderr } = await execAsync(command, { env });
      
      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      // Parse JSON from Coral output. Coral outputs tabular JSON arrays.
      return JSON.parse(stdout.trim()) as T[];
    } catch (error: any) {
      console.error('[CoralService] CLI execution failed:', error.message);
      throw new Error(`Coral query failed: ${error.message}. Is the Coral CLI installed and configured?`);
    }
  }
}

export const coralService = new CoralService();
