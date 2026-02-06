import dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { getTwitchToken } from "./twitchToken.js";

(async () => {
  const token = await getTwitchToken();
  console.log(token);
})();