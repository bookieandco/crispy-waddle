/**
 * Run only from the authorized persistent host, never inside an HTTP route.
 * Example:
 * TRUCKEROS_COMMUNITY_DATABASE_PATH=/srv/truckeros/community.sqlite \
 * TRUCKEROS_MODERATOR_BOOTSTRAP_SECRET='<32+ character high-entropy secret>' \
 * TRUCKEROS_MODERATOR_EMAIL='operator@example.test' pnpm moderator:bootstrap
 */
import {SqliteTruckerCommunity} from "../src/community/SqliteCommunityStore.js";
const dbPath=process.env.TRUCKEROS_COMMUNITY_DATABASE_PATH;
const secret=process.env.TRUCKEROS_MODERATOR_BOOTSTRAP_SECRET;
const email=process.env.TRUCKEROS_MODERATOR_EMAIL;
if(!process.stdin.isTTY)throw Error("Offline bootstrap requires a direct interactive terminal");
if(!dbPath||!dbPath.startsWith("/")||dbPath.startsWith("/tmp/")||
   !secret||secret.length<32||!email)throw Error("Missing secure bootstrap settings");
const db=new SqliteTruckerCommunity(dbPath,{moderatorBootstrapSecret:secret});
try{
  db.grantModeratorOffline(email,secret);
  process.stdout.write("Moderator role granted for an existing account. No secret printed.\n");
}finally{db.close();}
