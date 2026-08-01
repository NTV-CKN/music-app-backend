/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const {verifyFirebaseToken} = require("./auth");

exports.helloWorld = onRequest(async (request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  const user = await verifyFirebaseToken(request, response);

  if (!user) {
    return;
  }

  response.send({message: "Hello from Firebase!", user: user.email || user.uid});
});
