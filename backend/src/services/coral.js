import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Highly realistic mock data for sandbox mode
const MOCK_MARGINS = [
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
    ai_features_clicked: 3200,
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
  }
];

export class CoralService {
  constructor() {
    this.useSandbox = true;
    this.envVars = {};
  }

  setSandboxMode(enabled) {
    this.useSandbox = enabled;
    console.log(`[CoralService] Sandbox mode set to: ${enabled}`);
  }

  getSandboxMode() {
    return this.useSandbox;
  }

  setCredentials(env) {
    this.envVars = env;
  }

  async query(sql) {
    if (this.useSandbox) {
      console.log('[CoralService] Executing mock query (sandbox)...');
      if (sql.toLowerCase().includes('stripe') || sql.toLowerCase().includes('margin')) {
        return MOCK_MARGINS;
      }
      return [];
    }

    console.log(`[CoralService] Executing live Coral CLI query: ${sql}`);
    try {
      const env = {
        ...process.env,
        ...this.envVars,
      };

      const escapedSql = sql.replace(/"/g, '\\"');
      const command = `coral sql --format json "${escapedSql}"`;
      
      const { stdout, stderr } = await execAsync(command, { env });
      
      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      return JSON.parse(stdout.trim());
    } catch (error) {
      console.error('[CoralService] CLI execution failed:', error.message);
      throw new Error(`Coral query failed: ${error.message}. Is the Coral CLI installed and configured?`);
    }
  }
}

export const coralService = new CoralService();
