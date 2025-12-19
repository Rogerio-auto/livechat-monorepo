
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function setup() {
  console.log("Checking buckets...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }

  const bucketName = "project-attachments";
  const exists = buckets.find(b => b.name === bucketName);

  if (!exists) {
    console.log(`Creating bucket: ${bucketName}`);
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true,
      fileSizeLimit: 52428800, // 50MB
    });
    if (createError) {
      console.error("Error creating bucket:", createError);
    } else {
      console.log("Bucket created successfully.");
    }
  } else {
    console.log(`Bucket ${bucketName} already exists.`);
  }
}

setup();
