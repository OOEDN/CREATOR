import * as firestoreDAL from './services/firestore.js';
async function run() {
  try {
    const act = await firestoreDAL.getAccountByEmail('creator@ooedn.com');
    console.log("Account:", act);
  } catch (e) {
    console.error("FS ERROR:", e);
  }
}
run();
