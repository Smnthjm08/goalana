import axios from "axios";

export const txLine = axios.create({
  baseURL: "http://txline-dev.txodds.com",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Authorization: "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3ODU3NjkzMzcsInNlc3Npb25JZCI6IjcxNWJmYTdjLTNkZGUtNGFkNS05NGI1LTAxYmU1ZDdlYTIyYSIsInJvbGUiOiJndWVzdCIsIm1heWJlQ2xpZW50SXAiOiIzLjE3Mi4yNC4xMDMifQ.09kvCEBDPTPhtIHjB35Jqvzck59tz3hPPuJ95kY4nmuz7FAMHdywXnuwjaMp41vfylEHhaubmW75r1Lj1z7NAg"
  }
});

// export const createNewGuestSession = async (): Promise<string> => {
//   const res = await txLine.post("/auth/guest/start");
//   return res.data;
// }

export const activateNewSubscription = async (txSignature: string, walletSignature: string, leagues: Number[]): Promise<string> => {
  const res = await txLine.post("api/token/activate", {
    "txSig": txSignature,
    "walletSignature": walletSignature,
    "leagues": leagues
  });

  return res.data;
}