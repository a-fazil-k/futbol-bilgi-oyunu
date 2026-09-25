const { Client } = require("appwrite");

const client = new Client()
    .setEndpoint("https://fra.cloud.appwrite.io/v1")
    .setProject("6ab635d20002717b9c3f");

client.ping()
    .then(() => console.log("[appwrite] Pinged successfully!"))
    .catch(err => console.error("[appwrite] Ping failed:", err));

module.exports = { client };
