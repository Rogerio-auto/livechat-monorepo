
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env explicitly
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function run() {
  // Import pg.ts dynamically after loading env vars
  const db = (await import("./pg.ts")).default;
  
  const companyId = 'd56a5396-22df-486a-8fea-a82138e1f614';
  console.log("Testing getSubscription for company:", companyId);

  try {
    const row = await db.oneOrNone(
      `SELECT 
        s.*,
        to_jsonb(p.*) as plan_details
      FROM public.subscriptions s
      INNER JOIN public.plans p ON p.id = s.plan_id
      WHERE s.company_id = $1
      LIMIT 1`,
      [companyId]
    );
    console.log("Result:", row);
    
    if (row) {
        const result = {
            ...row,
            plan: typeof row.plan_details === "string" ? JSON.parse(row.plan_details) : row.plan_details,
        };
        if ('plan_details' in result) {
            delete (result as any).plan_details;
        }
        console.log("Processed Result:", result);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit();
  }
}

run();
