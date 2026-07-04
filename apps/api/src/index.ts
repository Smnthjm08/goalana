import express from "express"
import cors from "cors"
import { activateNewSubscription } from "./lib/txline-client"

const app = express();
const port = 8080

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }))

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" })
})

app.post("/api/v1/admin/txline/activate", async (req, res) => {
  try {
    const { txSig, walletSignature, leagues } = req.body;
    console.log("tx", txSig)
    console.log("wallet", walletSignature)
    console.log("leagues", leagues)

    const result = await activateNewSubscription(txSig, walletSignature, leagues)

    return res.json({ result })
  } catch (error) {
    console.log(">>>> error! ", error);
    return res.status(500).json({ error })
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}...`)
})
