require('dotenv').config();
const { Client } = require("appwrite");

const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_PROJECT_ID);

client.ping()
    .then(() => console.log("[appwrite] Pinged successfully!"))
    .catch(err => console.error("[appwrite] Ping failed:", err));

module.exports = { client };
